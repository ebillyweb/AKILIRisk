import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assertClientRoleForMutationApi } from '@/lib/client/require-client-role';
import { isAdvisorHubNavRole } from '@/lib/auth-roles';
import { getIntakeInterview, saveIntakeResponse } from '@/lib/data/intake';
import { getFacilitatedSessionForAdvisor } from '@/lib/facilitated/session-access';
import { getIntakeAudioObjectBytes } from '@/lib/s3/intake-audio-uploads';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const roleDenied = assertClientRoleForMutationApi(session);
    const isAdvisor = isAdvisorHubNavRole(session.user.role);

    const { id: interviewId } = await params;
    const body = await request.json();
    const facilitatedSessionId =
      typeof body.facilitatedSessionId === "string" ? body.facilitatedSessionId : null;

    let ownerUserId = session.user.id;
    if (roleDenied && isAdvisor && facilitatedSessionId) {
      const facilitated = await getFacilitatedSessionForAdvisor(
        facilitatedSessionId,
        session.user.id,
      );
      if (
        !facilitated ||
        facilitated.interviewId !== interviewId ||
        facilitated.status !== "INTAKE"
      ) {
        return NextResponse.json(
          { success: false, error: "Interview not found" },
          { status: 404 },
        );
      }
      ownerUserId = facilitated.clientId;
    } else if (roleDenied) {
      return roleDenied;
    }

    const interview = await getIntakeInterview(ownerUserId, interviewId);
    if (!interview) {
      return NextResponse.json(
        { success: false, error: 'Interview not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const { questionId } = body;

    if (!questionId) {
      return NextResponse.json(
        { success: false, error: 'Missing questionId' },
        { status: 400 }
      );
    }

    // Find the response to get audio S3 key
    const existingResponse = interview.responses.find(r => r.questionId === questionId);
    if (!existingResponse?.audioS3Key) {
      return NextResponse.json(
        { success: false, error: 'No audio file found for this question' },
        { status: 400 }
      );
    }

    // Update status to PROCESSING
    await saveIntakeResponse(interviewId, questionId, {
      audioUrl: existingResponse.audioUrl ?? undefined,
      audioS3Key: existingResponse.audioS3Key,
      audioContentType: existingResponse.audioContentType ?? undefined,
      audioDuration: existingResponse.audioDuration ?? undefined,
      transcriptionStatus: 'PROCESSING',
    });

    // Fetch audio bytes from S3 (private bucket; no public-read).
    try {
      const { data: audioBytes } = await getIntakeAudioObjectBytes(
        existingResponse.audioS3Key
      );
      const audioBuffer = Buffer.from(audioBytes);
      const audioMime = existingResponse.audioContentType ?? 'audio/webm';

      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY) {
        // For development: mark as completed with placeholder transcription
        const placeholderTranscription = "[Transcription unavailable - OpenAI API key not configured]";

        await saveIntakeResponse(interviewId, questionId, {
          audioUrl: existingResponse.audioUrl ?? undefined,
          audioDuration: existingResponse.audioDuration ?? undefined,
          transcription: placeholderTranscription,
          transcriptionStatus: 'COMPLETED',
        });

        return NextResponse.json({
          success: true,
          transcription: placeholderTranscription,
        });
      }

      // Send to OpenAI Whisper API with timeout. Match the stored MIME so
      // iOS uploads (audio/mp4) aren't relabeled as webm in transit.
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: audioMime });
      formData.append('file', audioBlob, `${questionId}.webm`);
      formData.append('model', 'whisper-1');

      // Create abort controller for 30 second timeout
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 30000);

      let whisperResponse;
      try {
        whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: formData,
          signal: abortController.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('[Transcribe]', { interviewId, questionId, error: 'Request timed out' });

          await saveIntakeResponse(interviewId, questionId, {
            audioUrl: existingResponse.audioUrl ?? undefined,
            audioDuration: existingResponse.audioDuration ?? undefined,
            transcriptionStatus: 'FAILED',
          });

          return NextResponse.json({
            success: true,
            transcription: "[Transcription timed out - will be retried later]",
          });
        }
        throw fetchError;
      }

      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        console.error('[Transcribe]', { interviewId, questionId, error: 'Whisper API error', status: whisperResponse.status, details: errorText });

        await saveIntakeResponse(interviewId, questionId, {
          audioUrl: existingResponse.audioUrl ?? undefined,
          audioDuration: existingResponse.audioDuration ?? undefined,
          transcriptionStatus: 'FAILED',
        });

        return NextResponse.json({
          success: true,
          transcription: "[Transcription failed - will be retried later]",
        });
      }

      const transcriptionData = await whisperResponse.json();
      const transcription = transcriptionData.text;

      // Update response with transcription
      await saveIntakeResponse(interviewId, questionId, {
        audioUrl: existingResponse.audioUrl ?? undefined,
        audioDuration: existingResponse.audioDuration ?? undefined,
        transcription,
        transcriptionStatus: 'COMPLETED',
      });

      return NextResponse.json({
        success: true,
        transcription,
      });

    } catch (fileError) {
      console.error('[Transcribe]', { interviewId, questionId, error: 'File read error', details: fileError });

      await saveIntakeResponse(interviewId, questionId, {
        audioUrl: existingResponse.audioUrl ?? undefined,
        audioDuration: existingResponse.audioDuration ?? undefined,
        transcriptionStatus: 'FAILED',
      });

      return NextResponse.json({
        success: true,
        transcription: "[Audio file not found - will be retried later]",
      });
    }

  } catch (error) {
    console.error('[Transcribe]', { interviewId: (await params).id, error: 'General transcription error', details: error });
    return NextResponse.json(
      { success: false, error: 'Failed to process transcription' },
      { status: 500 }
    );
  }
}