"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatQuestionTextForDisplay } from "@/lib/assessment/bank/question-bank-display";
import { DeleteQuestionBankButton } from "@/components/admin/DeleteQuestionBankButton";

export type SortableQuestion = {
  questionId: string;
  text: string;
  helpText: string | null;
  learnMore: string | null;
  isVisible: boolean;
  type: string;
};

type SortableQuestionItemProps = {
  question: SortableQuestion;
  index: number;
  totalCount: number;
  riskAreaId: string;
  typeQuery: string;
  reorderDisabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  deleteAction: (formData: FormData) => Promise<void>;
  visibilityAction: (formData: FormData) => Promise<void>;
};

function SortableQuestionItem({
  question,
  index,
  totalCount,
  riskAreaId,
  typeQuery,
  reorderDisabled,
  onMoveUp,
  onMoveDown,
  deleteAction,
  visibilityAction,
}: SortableQuestionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.questionId, disabled: reorderDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between border-b border-border last:border-b-0",
        isDragging && "opacity-50 bg-muted/50 shadow-lg z-50"
      )}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        {!reorderDisabled && (
          <button
            type="button"
            className="mt-1 cursor-grab touch-none text-muted-foreground hover:text-foreground focus:outline-none active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-5" />
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium leading-relaxed text-foreground">
            {formatQuestionTextForDisplay(question.text)}
          </p>
          {question.helpText ? (
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Why this matters
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">
                {formatQuestionTextForDisplay(question.helpText)}
              </p>
            </div>
          ) : null}
          {question.learnMore ? (
            <div className="rounded-lg border-2 border-dashed border-brand/35 bg-brand/5 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                Recommended actions
              </p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {formatQuestionTextForDisplay(String(question.learnMore))}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Badge
          variant={question.isVisible ? "success" : "secondary"}
          className="shrink-0"
        >
          {question.isVisible ? "Visible" : "Hidden"}
        </Badge>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={index === 0 || reorderDisabled}
            aria-label="Move up"
            onClick={onMoveUp}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={index === totalCount - 1 || reorderDisabled}
            aria-label="Move down"
            onClick={onMoveDown}
          >
            <ArrowDown className="size-4" />
          </Button>
        </div>
        <form action={visibilityAction}>
          <input type="hidden" name="questionId" value={question.questionId} />
          <input type="hidden" name="riskAreaId" value={riskAreaId} />
          <input type="hidden" name="isVisible" value={question.isVisible ? "false" : "true"} />
          <Button type="submit" variant="outline" size="sm">
            {question.isVisible ? "Hide" : "Show"}
          </Button>
        </form>
        <Button variant="default" size="sm" asChild>
          <Link
            href={`/admin/assessment/questions/${riskAreaId}/${question.questionId}/edit${typeQuery}`}
          >
            Edit
          </Link>
        </Button>
        <DeleteQuestionBankButton
          formAction={deleteAction}
          questionId={question.questionId}
          extraHidden={[{ name: "riskAreaId", value: riskAreaId }]}
        />
      </div>
    </div>
  );
}

type SortableQuestionListProps = {
  questions: SortableQuestion[];
  riskAreaId: string;
  typeQuery: string;
  reorderDisabled: boolean;
  reorderAction: (questionId: string, newIndex: number) => Promise<{ success: boolean; error?: string }>;
  moveAction: (questionId: string, direction: "up" | "down") => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  visibilityAction: (formData: FormData) => Promise<void>;
};

export function SortableQuestionList({
  questions: initialQuestions,
  riskAreaId,
  typeQuery,
  reorderDisabled,
  reorderAction,
  moveAction,
  deleteAction,
  visibilityAction,
}: SortableQuestionListProps) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.questionId === active.id);
      const newIndex = questions.findIndex((q) => q.questionId === over.id);

      const newQuestions = arrayMove(questions, oldIndex, newIndex);
      setQuestions(newQuestions);

      startTransition(async () => {
        const result = await reorderAction(active.id as string, newIndex);
        if (!result.success) {
          setQuestions(initialQuestions);
          toast.error(result.error ?? "Failed to reorder question");
        } else {
          toast.success("Question order updated");
        }
      });
    }
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const questionId = questions[index]!.questionId;
    const newQuestions = arrayMove(questions, index, index - 1);
    setQuestions(newQuestions);

    startTransition(async () => {
      await moveAction(questionId, "up");
    });
  }

  function handleMoveDown(index: number) {
    if (index === questions.length - 1) return;
    const questionId = questions[index]!.questionId;
    const newQuestions = arrayMove(questions, index, index + 1);
    setQuestions(newQuestions);

    startTransition(async () => {
      await moveAction(questionId, "down");
    });
  }

  if (questions.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No questions in this area yet.
      </p>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={questions.map((q) => q.questionId)}
        strategy={verticalListSortingStrategy}
        disabled={reorderDisabled}
      >
        <div className={cn(isPending && "opacity-60 pointer-events-none")}>
          {questions.map((question, index) => (
            <SortableQuestionItem
              key={question.questionId}
              question={question}
              index={index}
              totalCount={questions.length}
              riskAreaId={riskAreaId}
              typeQuery={typeQuery}
              reorderDisabled={reorderDisabled}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              deleteAction={deleteAction}
              visibilityAction={visibilityAction}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
