"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Mic, Keyboard } from "lucide-react";
import toast from "react-hot-toast";

import { AudioRecorder } from "@/components/intake/AudioRecorder";
import { QuestionDisplay } from "@/components/intake/QuestionDisplay";
import { StepIndicator } from "@/components/intake/StepIndicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  facilitatedGetIntakeInterview,
  facilitatedGetIntakeScriptQuestions,
  facilitatedSaveIntakeResponse,
  facilitatedSubmitIntake,
  facilitatedUpdateIntakeProgress,
} from "@/lib/actions/facilitated-intake-actions";
import { useIntakeInterview } from "@/lib/hooks/useIntakeInterview";
import { isInterviewResponseComplete } from "@/lib/intake/is-response-complete";
import { useIntakeStore, type InterviewResponse } from "@/lib/intake/store";
import type { IntakeQuestion } from "@/lib/intake/types";
import { facilitatedPillarsPath } from "@/lib/facilitated/paths";

interface FacilitatedIntakeWizardProps {
  sessionId: string;
  interviewId: string;
}

export function FacilitatedIntakeWizard({
  sessionId,
  interviewId,
}: FacilitatedIntakeWizardProps) {
  const router = useRouter();
  const [scriptQuestions, setScriptQuestions] = useState<IntakeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [typedSaving, setTypedSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [responseTab, setResponseTab] = useState<"record" | "type">("record");
  const [typedDraft, setTypedDraft] = useState("");

  const {
    currentQuestion,
    currentIndex,
    totalQuestions,
    canGoNext,
    canGoPrev,
    goToNext,
    goToPrev,
    isLastQuestion,
    getResponseForQuestion,
  } = useIntakeInterview(interviewId, scriptQuestions);

  const { setResponse, setCurrentQuestion, replaceResponses, responses } = useIntakeStore();

  const loadIntakeData = useCallback(
    async (isRetry = false) => {
      setLoadError(null);
      if (isRetry) {
        setScriptQuestions([]);
        replaceResponses({});
        setCurrentQuestion(0);
      }
      setLoading(true);
      try {
        const [scriptResult, interviewResult] = await Promise.all([
          facilitatedGetIntakeScriptQuestions(sessionId),
          facilitatedGetIntakeInterview(sessionId),
        ]);

        if (!scriptResult.success) {
          const message = scriptResult.error ?? "Could not load intake questions";
          setLoadError(message);
          toast.error(message);
          return;
        }

        const script = [...scriptResult.questions];
        if (script.length === 0) {
          const message = "No intake questions are configured for this environment.";
          setLoadError(message);
          toast.error(message);
          return;
        }

        setScriptQuestions(script);

        if (interviewResult.success && interviewResult.interview) {
          const interview = interviewResult.interview;
          const maxIdx = Math.max(0, script.length - 1);
          const idx = Math.min(interview.currentQuestionIndex ?? 0, maxIdx);
          setCurrentQuestion(idx);

          const scriptIds = new Set(script.map((q) => q.id));
          const nextResponses: Record<string, InterviewResponse> = {};
          for (const response of interview.responses ?? []) {
            if (!scriptIds.has(response.questionId)) continue;
            nextResponses[response.questionId] = {
              audioUrl: response.audioUrl || undefined,
              audioDuration: response.audioDuration || 0,
              transcription: response.transcription || undefined,
              transcriptionEditedAt: undefined,
              status:
                response.transcriptionStatus === "COMPLETED" ||
                (!response.audioUrl && Boolean(response.transcription?.trim()))
                  ? "completed"
                  : "pending",
            };
          }
          replaceResponses(nextResponses);
        } else {
          setCurrentQuestion(0);
          replaceResponses({});
        }
      } catch (error) {
        console.error(error);
        const message = "Failed to load intake";
        setLoadError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, replaceResponses, setCurrentQuestion],
  );

  useEffect(() => {
    void loadIntakeData();
  }, [loadIntakeData]);

  const currentResponse = currentQuestion
    ? getResponseForQuestion(currentQuestion.id)
    : undefined;

  useEffect(() => {
    if (!currentQuestion) return;
    const r = getResponseForQuestion(currentQuestion.id);
    setResponseTab(r?.audioUrl ? "record" : r?.transcription?.trim() ? "type" : "record");
    setTypedDraft(r?.transcription ?? "");
  }, [currentQuestion, getResponseForQuestion, currentResponse?.audioUrl, currentResponse?.transcription]);

  const submitIntake = useCallback(async () => {
    setSubmitting(true);
    try {
      const result = await facilitatedSubmitIntake(sessionId);
      if (!result.success) {
        toast.error(result.error ?? "Failed to submit intake");
        return;
      }
      toast.success("Intake submitted");
      router.push(facilitatedPillarsPath(sessionId));
    } finally {
      setSubmitting(false);
    }
  }, [router, sessionId]);

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    if (!currentQuestion || uploading || submitting || typedSaving) return;

    const questionId = currentQuestion.id;
    const recordedOnLastQuestion = isLastQuestion;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("audio", blob);
      formData.append("questionId", questionId);
      formData.append("facilitatedSessionId", sessionId);

      const uploadResponse = await fetch(`/api/intake/${interviewId}/audio`, {
        method: "POST",
        body: formData,
      });
      if (!uploadResponse.ok) throw new Error("Failed to upload audio");

      const uploadData = await uploadResponse.json();
      setResponse(questionId, {
        audioUrl: uploadData.audioUrl,
        audioDuration: duration,
        status: "pending",
      });

      try {
        const transcribeResponse = await fetch(`/api/intake/${interviewId}/transcribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, facilitatedSessionId: sessionId }),
        });

        if (transcribeResponse.ok) {
          const transcribeData = await transcribeResponse.json();
          setResponse(questionId, {
            audioUrl: uploadData.audioUrl,
            audioDuration: duration,
            transcription: transcribeData.transcription,
            status: "completed",
          });
        } else {
          setResponse(questionId, {
            audioUrl: uploadData.audioUrl,
            audioDuration: duration,
            status: "completed",
          });
        }
      } catch {
        setResponse(questionId, {
          audioUrl: uploadData.audioUrl,
          audioDuration: duration,
          status: "completed",
        });
      }

      if (recordedOnLastQuestion) {
        await submitIntake();
      } else {
        toast.success("Response saved");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to save response");
    } finally {
      setUploading(false);
    }
  };

  const handleTypedSave = async () => {
    if (!currentQuestion || !typedDraft.trim()) return;
    setTypedSaving(true);
    try {
      const result = await facilitatedSaveIntakeResponse(sessionId, {
        interviewId,
        questionId: currentQuestion.id,
        transcription: typedDraft.trim(),
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to save response");
        return;
      }
      setResponse(currentQuestion.id, {
        transcription: typedDraft.trim(),
        status: "completed",
      });
      toast.success("Response saved");
    } finally {
      setTypedSaving(false);
    }
  };

  const handleNext = async () => {
    if (!canGoNext || !currentQuestion) return;
    const response = getResponseForQuestion(currentQuestion.id);
    if (!isInterviewResponseComplete(response)) {
      toast.error("Answer this question before continuing");
      return;
    }

    if (isLastQuestion) {
      await submitIntake();
      return;
    }

    goToNext();
    try {
      await facilitatedUpdateIntakeProgress(sessionId, currentIndex + 1);
    } catch {
      // non-blocking
    }
  };

  const completedSteps = useMemo(() => {
    const completed = new Set<number>();
    scriptQuestions.forEach((q, idx) => {
      const r = getResponseForQuestion(q.id);
      if (isInterviewResponseComplete(r)) completed.add(idx);
    });
    return completed;
  }, [scriptQuestions, getResponseForQuestion, responses]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !currentQuestion) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Alert variant="destructive">
          <AlertTitle>Could not load intake</AlertTitle>
          <AlertDescription>{loadError ?? "Intake questions are unavailable."}</AlertDescription>
        </Alert>
        <Button type="button" className="mt-4" onClick={() => void loadIntakeData(true)}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <StepIndicator
        currentIndex={currentIndex}
        totalSteps={totalQuestions}
        completedSteps={completedSteps}
      />

      <QuestionDisplay question={currentQuestion} totalQuestions={totalQuestions} />

      <Card className="p-4 sm:p-6">
        <Tabs value={responseTab} onValueChange={(v) => setResponseTab(v as "record" | "type")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="record" className="gap-2">
              <Mic className="size-4" />
              Record
            </TabsTrigger>
            <TabsTrigger value="type" className="gap-2">
              <Keyboard className="size-4" />
              Type
            </TabsTrigger>
          </TabsList>
          <TabsContent value="record" className="mt-4">
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              disabled={uploading || submitting || typedSaving}
              existingAudioUrl={currentResponse?.audioUrl}
            />
          </TabsContent>
          <TabsContent value="type" className="mt-4 space-y-3">
            <Textarea
              value={typedDraft}
              onChange={(e) => setTypedDraft(e.target.value)}
              rows={6}
              placeholder="Type the client's answer…"
            />
            <Button
              type="button"
              onClick={() => void handleTypedSave()}
              disabled={typedSaving || !typedDraft.trim()}
            >
              {typedSaving ? <Loader2 className="size-4 animate-spin" /> : "Save typed answer"}
            </Button>
          </TabsContent>
        </Tabs>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={goToPrev} disabled={!canGoPrev}>
          <ArrowLeft className="size-4" />
          Previous
        </Button>
        <Button
          type="button"
          onClick={() => void handleNext()}
          disabled={uploading || submitting || typedSaving}
        >
          {isLastQuestion ? "Submit intake" : "Next"}
          {!isLastQuestion && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
