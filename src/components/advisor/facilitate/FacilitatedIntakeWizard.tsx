"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Mic, Keyboard } from "lucide-react";
import toast from "react-hot-toast";

import { AudioRecorder } from "@/components/intake/AudioRecorder";
import {
  IntakeStructuredAnswer,
  intakeQuestionSupportsAudio,
} from "@/components/intake/IntakeStructuredAnswer";
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
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [responseTab, setResponseTab] = useState<"record" | "type">("type");
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
              skipped: response.skipped,
              transcriptionEditedAt: undefined,
              status:
                response.skipped ||
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
    setResponseTab(
      r?.skipped || r?.transcription?.trim()
        ? "type"
        : r?.audioUrl
          ? "record"
          : "type",
    );
    setTypedDraft(r?.skipped ? "" : (r?.transcription ?? ""));
  }, [currentQuestion?.id, getResponseForQuestion]);

  const saveCurrentTypedAnswer = useCallback(async (): Promise<boolean> => {
    if (!currentQuestion) return true;

    const trimmed = typedDraft.trim();
    if (!trimmed) return true;

    const result = await facilitatedSaveIntakeResponse(sessionId, {
      interviewId,
      questionId: currentQuestion.id,
      transcription: trimmed,
    });

    if (!result.success) {
      toast.error(
        result.error ??
          ("errors" in result && result.errors
            ? Object.values(result.errors).flat()[0]
            : "Failed to save response"),
      );
      return false;
    }

    setResponse(currentQuestion.id, {
      transcription: trimmed,
      status: "completed",
      skipped: false,
    });
    return true;
  }, [currentQuestion, interviewId, sessionId, setResponse, typedDraft]);

  const saveSkip = useCallback(async (): Promise<boolean> => {
    if (!currentQuestion) return false;

    const result = await facilitatedSaveIntakeResponse(sessionId, {
      interviewId,
      questionId: currentQuestion.id,
      skipped: true,
    });

    if (!result.success) {
      toast.error(
        result.error ??
          ("errors" in result && result.errors
            ? Object.values(result.errors).flat()[0]
            : "Failed to skip question"),
      );
      return false;
    }

    setResponse(currentQuestion.id, {
      skipped: true,
      status: "completed",
      transcription: undefined,
    });
    setTypedDraft("");
    return true;
  }, [currentQuestion, interviewId, sessionId, setResponse]);

  const submitIntake = useCallback(async () => {
    setSubmitting(true);
    try {
      if (!(await saveCurrentTypedAnswer())) return;
      const result = await facilitatedSubmitIntake(sessionId);
      if (!result.success) {
        toast.error(result.error ?? "Failed to submit intake");
        return;
      }
      toast.success("Intake submitted");
      if ("redirectTo" in result && result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }
      router.push(facilitatedPillarsPath(sessionId));
    } finally {
      setSubmitting(false);
    }
  }, [router, saveCurrentTypedAnswer, sessionId]);

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    if (!currentQuestion || uploading || submitting || saving) return;

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
        skipped: false,
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

  const handleSkip = async () => {
    if (!currentQuestion || responseBusy) return;

    setSaving(true);
    try {
      if (!(await saveSkip())) return;

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
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (!currentQuestion) return;

    const response = getResponseForQuestion(currentQuestion.id);
    const hasAnswer =
      Boolean(typedDraft.trim()) || isInterviewResponseComplete(response);
    if (!hasAnswer) {
      toast.error("Answer or skip this question before continuing");
      return;
    }

    if (!isLastQuestion && !canGoNext) return;

    setSaving(true);
    try {
      if (isLastQuestion) {
        await submitIntake();
        return;
      }

      if (!(await saveCurrentTypedAnswer())) return;

      goToNext();
      try {
        await facilitatedUpdateIntakeProgress(sessionId, currentIndex + 1);
      } catch {
        // non-blocking
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePrevious = async () => {
    if (!canGoPrev) return;

    setSaving(true);
    try {
      if (!(await saveCurrentTypedAnswer())) return;
      goToPrev();
    } finally {
      setSaving(false);
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

  const responseBusy = uploading || submitting || saving;
  const typingDisabled = uploading || submitting || saving || Boolean(currentResponse?.skipped);
  const hasAnswerForNav =
    Boolean(typedDraft.trim()) || isInterviewResponseComplete(currentResponse);

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

  const supportsAudio = intakeQuestionSupportsAudio(currentQuestion);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <StepIndicator
        currentIndex={currentIndex}
        totalSteps={totalQuestions}
        completedSteps={completedSteps}
      />

      <QuestionDisplay
        question={currentQuestion}
        totalQuestions={totalQuestions}
        scriptPosition={currentIndex + 1}
      />

      <Card className="p-4 sm:p-6">
        {supportsAudio ? (
          <Tabs value={responseTab} onValueChange={(v) => setResponseTab(v as "record" | "type")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="type" className="gap-2">
                <Keyboard className="size-4" />
                Type
              </TabsTrigger>
              <TabsTrigger value="record" className="gap-2">
                <Mic className="size-4" />
                Record
              </TabsTrigger>
            </TabsList>
            <TabsContent value="type" className="mt-4 space-y-3">
              <Textarea
                value={typedDraft}
                onChange={(e) => setTypedDraft(e.target.value)}
                rows={6}
                placeholder="Type the client's answer…"
                disabled={typingDisabled}
              />
              <p className="text-xs text-muted-foreground">
                Answer is saved when you go to the next or previous question.
              </p>
            </TabsContent>
            <TabsContent value="record" className="mt-4">
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                disabled={responseBusy}
                existingAudioUrl={currentResponse?.audioUrl}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <IntakeStructuredAnswer
              question={currentQuestion}
              value={typedDraft}
              disabled={typingDisabled}
              onChange={setTypedDraft}
            />
            <p className="text-xs text-muted-foreground">
              Answer is saved when you go to the next or previous question.
            </p>
          </div>
        )}

        <div className="mt-4 text-center">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            disabled={responseBusy}
            onClick={() => void handleSkip()}
          >
            Skip this question
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => void handlePrevious()} disabled={!canGoPrev || responseBusy}>
          <ArrowLeft className="size-4" />
          Previous
        </Button>
        <Button
          type="button"
          onClick={() => void handleNext()}
          disabled={responseBusy || !hasAnswerForNav}
        >
          {isLastQuestion ? "Submit intake" : "Next"}
          {!isLastQuestion && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
