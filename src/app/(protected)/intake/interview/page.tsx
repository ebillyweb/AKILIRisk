"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowRight, Loader2, Mic, Keyboard } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { QuestionDisplay } from "@/components/intake/QuestionDisplay";
import { AudioRecorder } from "@/components/intake/AudioRecorder";
import {
  IntakeStructuredAnswer,
  intakeQuestionSupportsAudio,
} from "@/components/intake/IntakeStructuredAnswer";
import { StepIndicator } from "@/components/intake/StepIndicator";
import { useIntakeInterview } from "@/lib/hooks/useIntakeInterview";
import { useIntakeStore, type InterviewResponse } from "@/lib/intake/store";
import { isInterviewResponseComplete } from "@/lib/intake/is-response-complete";
import type { IntakeQuestion } from "@/lib/intake/types";
import {
  getIntakeInterviewAction,
  getIntakeScriptQuestionsAction,
  updateProgress,
  submitIntakeInterviewAction,
  getActiveIntakeInterviewAction,
  getLatestIntakeInterviewAction,
  getClientIntakeAnswersLockedAction,
  saveResponse,
} from "@/lib/actions/intake-actions";

/**
 * Intake Interview Wizard
 *
 * Main interview experience with one question per screen and audio recording.
 */

export default function InterviewPage() {
  const router = useRouter();
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [scriptQuestions, setScriptQuestions] = useState<IntakeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
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
  } = useIntakeInterview(interviewId || "", scriptQuestions);

  const { responses, setResponse, setCurrentQuestion, replaceResponses } = useIntakeStore();

  useEffect(() => {
    async function loadInterview() {
      try {
        const lockResult = await getClientIntakeAnswersLockedAction();
        if (lockResult.success && lockResult.locked) {
          router.push("/intake/review");
          return;
        }

        const activeInterviewResult = await getActiveIntakeInterviewAction();

        if (activeInterviewResult.success && activeInterviewResult.interview) {
          const interview = activeInterviewResult.interview;
          setInterviewId(interview.id);

          const [detailResult, scriptResult] = await Promise.all([
            getIntakeInterviewAction(interview.id),
            getIntakeScriptQuestionsAction(),
          ]);

          if (!scriptResult.success) {
            toast.error(scriptResult.error || "Could not load intake questions");
            router.push("/intake");
            return;
          }

          const script = [...scriptResult.questions];
          setScriptQuestions(script);
          const scriptQuestionIds = new Set(script.map((q) => q.id));

          if (detailResult.success && detailResult.interview) {
            const loadedInterview = detailResult.interview;
            const maxIdx = Math.max(0, script.length - 1);
            const idx = Math.min(loadedInterview.currentQuestionIndex ?? 0, maxIdx);
            setCurrentQuestion(idx);

            const nextResponses: Record<string, InterviewResponse> = {};
            for (const response of loadedInterview.responses ?? []) {
              if (!scriptQuestionIds.has(response.questionId)) continue;
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
        } else {
          const latestResult = await getLatestIntakeInterviewAction();
          if (
            latestResult.success &&
            latestResult.interview?.status === "SUBMITTED"
          ) {
            router.push("/intake/complete");
            return;
          }
          router.push("/intake");
          return;
        }
      } catch (error) {
        console.error("Failed to load interview:", error);
        toast.error("Failed to load interview. Please try again.");
        router.push("/intake");
      } finally {
        setLoading(false);
      }
    }

    loadInterview();
  }, [router, replaceResponses, setCurrentQuestion]);

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
    if (!interviewId || !currentQuestion) return true;

    const trimmed = typedDraft.trim();
    if (!trimmed) return true;

    const result = await saveResponse(interviewId, {
      interviewId,
      questionId: currentQuestion.id,
      transcription: trimmed,
      audioUrl: currentResponse?.audioUrl,
      audioDuration: currentResponse?.audioDuration,
    });

    if (!result.success) {
      const errorMessage =
        ("error" in result && result.error) ||
        ("errors" in result && result.errors
          ? Object.values(result.errors).flat().find(Boolean)
          : undefined) ||
        "Failed to save response";
      toast.error(errorMessage);
      return false;
    }

    setResponse(currentQuestion.id, {
      transcription: trimmed,
      audioUrl: currentResponse?.audioUrl,
      audioDuration: currentResponse?.audioDuration,
      status: "completed",
      skipped: false,
    });
    return true;
  }, [interviewId, currentQuestion, currentResponse, typedDraft, setResponse]);

  const saveSkip = useCallback(async (): Promise<boolean> => {
    if (!interviewId || !currentQuestion) return false;

    const result = await saveResponse(interviewId, {
      interviewId,
      questionId: currentQuestion.id,
      skipped: true,
    });

    if (!result.success) {
      const errorMessage =
        ("error" in result && result.error) ||
        ("errors" in result && result.errors
          ? Object.values(result.errors).flat().find(Boolean)
          : undefined) ||
        "Failed to skip question";
      toast.error(errorMessage);
      return false;
    }

    setResponse(currentQuestion.id, {
      skipped: true,
      status: "completed",
      transcription: undefined,
    });
    setTypedDraft("");
    return true;
  }, [interviewId, currentQuestion, setResponse]);

  const submitInterviewIfLast = useCallback(async () => {
    if (!interviewId) return;
    setSubmitting(true);
    try {
      if (!(await saveCurrentTypedAnswer())) return;
      const submitResult = await submitIntakeInterviewAction(interviewId);
      if (submitResult.success) {
        toast.success("Interview completed successfully!");
        router.push("/intake/complete");
      } else {
        toast.error(submitResult.error || "Failed to submit interview");
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit interview. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [interviewId, router, saveCurrentTypedAnswer]);

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    if (!interviewId || !currentQuestion || uploading || submitting || saving) return;

    const questionId = currentQuestion.id;
    const recordedOnLastQuestion = isLastQuestion;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("audio", blob);
      formData.append("questionId", questionId);

      const uploadResponse = await fetch(`/api/intake/${interviewId}/audio`, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload audio");
      }

      const uploadData = await uploadResponse.json();

      setResponse(questionId, {
        audioUrl: uploadData.audioUrl,
        audioDuration: duration,
        status: "pending",
      });

      try {
        const transcribeResponse = await fetch(`/api/intake/${interviewId}/transcribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ questionId }),
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
          console.warn("Transcription failed, but audio was saved:", await transcribeResponse.text());

          setResponse(questionId, {
            audioUrl: uploadData.audioUrl,
            audioDuration: duration,
            transcription: undefined,
            status: "completed",
          });

          toast("Audio saved. Transcription will be processed later.", { icon: "⚠️" });
        }
      } catch (transcribeError) {
        console.warn("Transcription service error:", transcribeError);

        setResponse(questionId, {
          audioUrl: uploadData.audioUrl,
          audioDuration: duration,
          transcription: undefined,
          status: "completed",
        });

        toast("Audio saved. Transcription will be processed later.", { icon: "⚠️" });
      }

      if (recordedOnLastQuestion) {
        await submitInterviewIfLast();
      } else {
        toast.success("Response saved!");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to save response. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = async () => {
    if (!currentQuestion || uploading || submitting || saving) return;

    setSaving(true);
    try {
      if (!(await saveSkip())) return;

      if (isLastQuestion) {
        await submitInterviewIfLast();
        return;
      }

      goToNext();
      if (interviewId) {
        try {
          await updateProgress(interviewId, currentIndex + 1);
        } catch (error) {
          console.error("Failed to update progress:", error);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (!interviewId || !hasResponseForNav()) return;
    if (!isLastQuestion && !canGoNext) return;

    setSaving(true);
    try {
      if (!(await saveCurrentTypedAnswer())) return;

      if (!isLastQuestion) {
        goToNext();

        try {
          await updateProgress(interviewId, currentIndex + 1);
        } catch (error) {
          console.error("Failed to update progress:", error);
        }
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

  const handleTranscriptionSave = async (transcription: string) => {
    if (!interviewId || !currentQuestion) return;

    const result = await saveResponse(interviewId, {
      interviewId,
      questionId: currentQuestion.id,
      audioUrl: currentResponse?.audioUrl,
      audioDuration: currentResponse?.audioDuration,
      transcription,
    });

    if (!result.success) {
      const errorMessage =
        ("error" in result && result.error) ||
        ("errors" in result && result.errors
          ? Object.values(result.errors).flat().find(Boolean)
          : undefined) ||
        "Failed to save transcript";
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    setResponse(currentQuestion.id, {
      transcription,
      transcriptionEditedAt: new Date().toISOString(),
      status: currentResponse?.status || "completed",
    });
    toast.success("Transcript updated");
  };

  function hasResponseForNav() {
    if (typedDraft.trim()) return true;
    return isInterviewResponseComplete(currentResponse);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading interview...</span>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Interview question not found.</p>
        <Button onClick={() => router.push("/intake")} className="mt-4">
          Return to Intake
        </Button>
      </div>
    );
  }

  const hasResponse = hasResponseForNav();
  const responseBusy = uploading || saving || submitting;
  // A skipped question must stay answerable when revisited — skipping defers a
  // question, it does not lock it. Only in-flight operations disable input.
  const typingDisabled = uploading || submitting || saving;
  const supportsAudio = intakeQuestionSupportsAudio(currentQuestion);

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-8">
      <StepIndicator
        currentIndex={currentIndex}
        totalSteps={totalQuestions}
        completedSteps={
          new Set(
            Object.entries(responses)
              .filter(([, response]) => isInterviewResponseComplete(response))
              .map(([questionId]) => {
                const questionIndex = scriptQuestions.findIndex((q) => q.id === questionId);
                return questionIndex >= 0 ? questionIndex : -1;
              })
              .filter((index) => index >= 0),
          )
        }
      />

      <QuestionDisplay
        question={currentQuestion}
        totalQuestions={totalQuestions}
        scriptPosition={currentIndex + 1}
      />

      <Card className="rounded-3xl p-6 shadow-sm">
        {supportsAudio ? (
          <Tabs
            value={responseTab}
            onValueChange={(v) => setResponseTab(v as "record" | "type")}
            className="gap-4"
          >
            <TabsList className="w-full max-w-md" variant="line">
              <TabsTrigger value="type" className="gap-1.5">
                <Keyboard className="size-4" />
                Type
              </TabsTrigger>
              <TabsTrigger value="record" className="gap-1.5">
                <Mic className="size-4" />
                Voice
              </TabsTrigger>
            </TabsList>

            <TabsContent value="type" className="mt-4 space-y-4">
              <h3 className="font-medium">Type your response</h3>
              <p className="text-sm text-muted-foreground">
                Your answer is saved when you go to the next or previous question.
              </p>
              <Textarea
                value={typedDraft}
                onChange={(e) => setTypedDraft(e.target.value)}
                placeholder="Write your answer here…"
                rows={8}
                disabled={typingDisabled}
                className="min-h-[180px] resize-y text-base"
              />
            </TabsContent>

            <TabsContent value="record" className="mt-4 space-y-4">
              <h3 className="font-medium">Record your response</h3>
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                existingAudioUrl={currentResponse?.audioUrl}
                transcription={currentResponse?.transcription}
                transcriptionEditedAt={currentResponse?.transcriptionEditedAt}
                transcriptionStatus={currentResponse?.status}
                onTranscriptionSave={handleTranscriptionSave}
                disabled={responseBusy}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <IntakeStructuredAnswer
              key={currentQuestion.id}
              question={currentQuestion}
              value={typedDraft}
              disabled={typingDisabled}
              onChange={setTypedDraft}
            />
            <p className="text-sm text-muted-foreground">
              Your answer is saved when you go to the next or previous question.
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

        {uploading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Saving your recording…</span>
          </div>
        )}

        {submitting && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Submitting interview…</span>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => void handlePrevious()}
          disabled={!canGoPrev || responseBusy}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </Button>

        <div className="text-sm text-muted-foreground">
          Question {currentIndex + 1} of {totalQuestions}
        </div>

        {!isLastQuestion ? (
          <Button
            onClick={() => void handleNext()}
            disabled={!hasResponse || responseBusy}
            className="flex items-center gap-2"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={() => void submitInterviewIfLast()}
            disabled={!hasResponse || responseBusy}
          >
            {submitting ? "Submitting…" : "Submit interview"}
          </Button>
        )}
      </div>
    </div>
  );
}
