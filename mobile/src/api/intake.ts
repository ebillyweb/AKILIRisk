import * as FileSystem from 'expo-file-system';
import { apiRequest } from './client';
import { IntakeScript } from '@/types';

/** GET /api/intake/script — the question set + status for the current user. */
export async function fetchIntakeScript(): Promise<IntakeScript> {
  const raw = await apiRequest<unknown>('/api/intake/script');
  return IntakeScript.parse(raw);
}

export interface TypedResponsePayload {
  interviewId: string;
  questionId: string;
  text: string;
  updatedAt: string;
}

/** POST /api/intake/response — upsert a typed answer (idempotent). */
export async function putTypedResponse(
  payload: TypedResponsePayload,
  idempotencyKey: string,
): Promise<void> {
  await apiRequest('/api/intake/response', {
    method: 'POST',
    json: { ...payload, mode: 'TYPE' },
    idempotencyKey,
  });
}

export interface PresignResult {
  uploadUrl: string;
  fileKey: string;
}

/** Requests a presigned S3 URL for a voice answer upload. */
export async function presignAudioUpload(
  interviewId: string,
  questionId: string,
): Promise<PresignResult> {
  const raw = await apiRequest<PresignResult>('/api/intake/audio/presign', {
    method: 'POST',
    json: { interviewId, questionId },
  });
  return raw;
}

/** PUTs the local audio file to the presigned S3 URL via a native upload. */
export async function uploadAudio(uploadUrl: string, localUri: string): Promise<void> {
  const res = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': 'audio/m4a' },
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Audio upload failed (${res.status})`);
  }
}

export interface VoiceResponsePayload {
  interviewId: string;
  questionId: string;
  fileKey: string;
  updatedAt: string;
}

/** Confirms a voice answer after the audio object is durable in S3. */
export async function confirmVoiceResponse(
  payload: VoiceResponsePayload,
  idempotencyKey: string,
): Promise<void> {
  await apiRequest('/api/intake/response', {
    method: 'POST',
    json: { ...payload, mode: 'VOICE' },
    idempotencyKey,
  });
}

/** POST /api/intake/submit — finalize once the outbox is drained. */
export async function submitIntake(interviewId: string): Promise<{ referenceId: string }> {
  const raw = await apiRequest<{ referenceId?: string }>('/api/intake/submit', {
    method: 'POST',
    json: { interviewId },
  });
  return { referenceId: raw.referenceId ?? interviewId };
}
