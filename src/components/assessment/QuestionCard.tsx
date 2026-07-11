'use client';

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Question } from "@/lib/assessment/types";
import {
  SingleChoiceCards,
  MultiChoiceCards,
  YesNoCards,
  MaturityScale,
  LikertScale,
  NumericInput,
  ShortTextInput,
  DatePickerInput,
  MonthYearPickerInput,
} from "./AnswerOptions";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QuestionTtsPlayButton } from "@/components/common/QuestionTtsPlayButton";
import { AssessmentQuestionDocumentUpload } from "@/components/assessment/AssessmentQuestionDocumentUpload";
import {
  isAssessmentDocumentUploadAnswer,
  hasDocumentUploadFiles,
  MAX_ASSESSMENT_QUESTION_UPLOADS,
  type AssessmentDocumentUploadAnswer,
} from "@/lib/assessment/question-upload";

/**
 * QuestionCard Component
 *
 * Main wrapper for single question display.
 * Renders question text, inline help, appropriate answer component,
 * and optional skip link for non-required questions.
 */

interface QuestionCardProps {
  question: Question;
  personalizedText?: string; // Personalized question text (overrides question.text)
  currentAnswer: unknown;
  onAnswer: (answer: unknown) => void;
  onSkip?: () => void;
  /** When true, client chose to continue without uploading documents. */
  isSkipped?: boolean;
  /** 1-based index and total for TTS (“Question 3 of 12”). */
  questionPosition: { index: number; total: number };
  /** Pillar / module label read before the question (e.g. “Cyber Risk”). */
  moduleName?: string;
  /** Required for document-upload questions. */
  assessmentId?: string;
}

export function QuestionCard({
  question,
  personalizedText,
  currentAnswer,
  onAnswer,
  onSkip,
  isSkipped = false,
  questionPosition,
  moduleName,
  assessmentId,
}: QuestionCardProps) {
  // Create dynamic validation schema based on question
  const createSchema = () => {
    if (!question.required) {
      return z.object({
        answer: z.unknown().optional(),
      });
    }

    // Required question validation
    switch (question.type) {
      case 'yes-no':
      case 'single-choice':
        return z.object({
          answer: z.union([z.string(), z.number()]).refine(
            (val) => val !== null && val !== undefined,
            { message: "Please select an answer to continue" }
          ),
        });
      case 'multi-choice':
        return z.object({
          answer: z
            .array(z.union([z.string(), z.number()]))
            .min(1, "Please select at least one answer to continue"),
        });
      case 'maturity-scale':
        return z.object({
          answer: z.number({
            message: "Please select an answer to continue",
          }).refine(
            (val) => val !== null && val !== undefined,
            { message: "Please select an answer to continue" }
          ),
        });
      case 'likert':
        return z.object({
          answer: z
            .number({ message: "Please select an answer to continue" })
            .int({ message: "Please select one of the five options" })
            .min(1, { message: "Please select one of the five options" })
            .max(5, { message: "Please select one of the five options" }),
        });
      case 'numeric':
        return z.object({
          answer: z.number({
            message: "Please enter a number to continue",
          }),
        });
      case 'short-text':
        return z.object({
          answer: z.string().min(1, "Please enter an answer to continue"),
        });
      case 'date':
        return z.object({
          answer: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, "Please select a date to continue"),
        });
      case 'month-year':
        return z.object({
          answer: z
            .string()
            .regex(/^\d{4}-\d{2}$/, "Please select a month and year to continue"),
        });
      case 'document-upload':
        if (!question.required) {
          return z.object({
            answer: z
              .array(
                z.object({
                  fileKey: z.string().min(1),
                  fileName: z.string().min(1),
                  fileSize: z.number().positive(),
                  fileMimeType: z.string().min(1),
                })
              )
              .max(
                MAX_ASSESSMENT_QUESTION_UPLOADS,
                `You can upload up to ${MAX_ASSESSMENT_QUESTION_UPLOADS} documents`
              )
              .optional(),
          });
        }
        return z.object({
          answer: z
            .array(
              z.object({
                fileKey: z.string().min(1),
                fileName: z.string().min(1),
                fileSize: z.number().positive(),
                fileMimeType: z.string().min(1),
              })
            )
            .min(1, "Please upload at least one document to continue")
            .max(
              MAX_ASSESSMENT_QUESTION_UPLOADS,
              `You can upload up to ${MAX_ASSESSMENT_QUESTION_UPLOADS} documents`
            )
            .refine(isAssessmentDocumentUploadAnswer, {
              message: "Please upload at least one document to continue",
            }),
        });
      default:
        return z.object({
          answer: z.unknown().refine(
            (val) => val !== null && val !== undefined,
            { message: "Please select an answer to continue" }
          ),
        });
    }
  };

  const {
    setValue,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createSchema()),
    mode: 'onSubmit',
    defaultValues: {
      answer: currentAnswer,
    },
  });

  // Update form when currentAnswer changes (e.g., navigating back to this question)
  useEffect(() => {
    setValue('answer', currentAnswer);
  }, [currentAnswer, setValue]);

  // Handle answer change
  const handleAnswerChange = async (answer: unknown) => {
    setValue('answer', answer);
    onAnswer(answer);
    // Clear validation error when user provides an answer
    await trigger('answer');
  };

  // Render appropriate answer component based on question type
  const renderAnswerComponent = () => {
    const base = { onChange: handleAnswerChange };

    switch (question.type) {
      case 'yes-no':
        return (
          <YesNoCards
            {...base}
            value={currentAnswer != null ? String(currentAnswer) : null}
          />
        );

      case 'single-choice':
        return (
          <SingleChoiceCards
            options={question.options || []}
            {...base}
            value={currentAnswer != null ? (currentAnswer as string | number) : null}
          />
        );

      case 'multi-choice':
        return (
          <MultiChoiceCards
            options={question.options || []}
            {...base}
            value={Array.isArray(currentAnswer) ? (currentAnswer as Array<string | number>) : []}
          />
        );

      case 'maturity-scale':
        return (
          <MaturityScale
            options={question.options || []}
            {...base}
            value={currentAnswer != null ? Number(currentAnswer) : null}
          />
        );

      case 'likert':
        return (
          <LikertScale
            {...base}
            value={currentAnswer != null ? Number(currentAnswer) : null}
          />
        );

      case 'numeric':
        return (
          <NumericInput
            {...base}
            value={currentAnswer != null ? Number(currentAnswer) : null}
          />
        );

      case 'short-text':
        return (
          <ShortTextInput
            {...base}
            value={currentAnswer != null ? String(currentAnswer) : ''}
          />
        );

      case 'date':
        return (
          <DatePickerInput
            {...base}
            value={currentAnswer != null ? String(currentAnswer) : null}
          />
        );

      case 'month-year':
        return (
          <MonthYearPickerInput
            {...base}
            value={currentAnswer != null ? String(currentAnswer) : null}
          />
        );

      case 'document-upload':
        if (!assessmentId) {
          return (
            <div className="text-muted-foreground">
              Document upload is unavailable for this session.
            </div>
          );
        }
        return (
          <AssessmentQuestionDocumentUpload
            assessmentId={assessmentId}
            questionId={question.id}
            value={currentAnswer}
            onChange={(answer: AssessmentDocumentUploadAnswer) => handleAnswerChange(answer)}
          />
        );

      default:
        return (
          <div className="text-muted-foreground">
            Unknown question type: {question.type}
          </div>
        );
    }
  };

  // "Why this matters" / risk-relevance copy, shown only when authored on the
  // question. Prefer the dedicated risk-relevance column, fall back to help text.
  const whyThisMatters = question.riskRelevance ?? question.helpText;

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
      <div className="space-y-4 sm:space-y-5">
        <div className="space-y-3">
          {question.type !== "maturity-scale" ? (
            <p className="editorial-kicker">
              {question.type === "document-upload"
                ? "Optional — attach documents if available"
                : question.required
                  ? "Required Question"
                  : "Optional Question"}
            </p>
          ) : null}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <h2 className="text-2xl font-semibold leading-tight text-balance text-foreground sm:text-4xl">
              {personalizedText || question.text}
            </h2>
            <QuestionTtsPlayButton
              contentKey={question.id}
              endpoint="/api/assessment/tts"
              moduleName={moduleName}
              questionText={personalizedText || question.text}
              context={question.helpText}
              learnMore={question.learnMore}
              questionNumber={questionPosition.index}
              totalQuestions={questionPosition.total}
              className="shrink-0"
            />
          </div>
        </div>

        {question.subCategory && question.type !== "maturity-scale" ? (
          <p className="text-sm uppercase tracking-[0.14em] text-muted-foreground">
            {question.subCategory.replace(/-/g, " ")}
          </p>
        ) : null}

        {whyThisMatters ? (
          <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Why this matters
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {whyThisMatters}
            </p>
          </div>
        ) : null}

      </div>

      <div className="mt-6 sm:mt-8">
        {renderAnswerComponent()}
      </div>

      {errors.answer && (
        <Alert variant="destructive">
          <AlertDescription>{errors.answer.message as string}</AlertDescription>
        </Alert>
      )}

      {onSkip && question.type !== "document-upload" ? (
        <div className="text-center pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            Skip this question
            {!question.required ? (
              <span className="text-xs ml-2 text-muted-foreground">
                (answering improves accuracy)
              </span>
            ) : null}
          </Button>
        </div>
      ) : null}

      {question.type === "document-upload" && onSkip && !isSkipped ? (
        <div className="border-t border-border/60 pt-4 text-center">
          <Button
            type="button"
            variant="outline"
            onClick={onSkip}
            disabled={hasDocumentUploadFiles(currentAnswer)}
          >
            No documents to attach — continue without upload
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Your advisor will see that supporting documents were not provided.
          </p>
        </div>
      ) : null}

      {question.type === "document-upload" && isSkipped ? (
        <p className="text-center text-sm text-muted-foreground">
          Continuing without documents. Upload files above if you change your mind.
        </p>
      ) : null}
    </div>
  );
}
