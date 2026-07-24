"use client";

import { useRouter } from "next/navigation";
import { SortableQuestionList, type SortableQuestion } from "./SortableQuestionList";
import {
  deletePillarQuestion,
  updatePillarQuestionVisibility,
  reorderPillarQuestionToPosition,
  movePillarQuestionOrder,
} from "@/lib/actions/admin-question-bank-actions";

type Props = {
  questions: SortableQuestion[];
  riskAreaId: string;
  typeQuery: string;
  reorderDisabled: boolean;
};

export function SortableQuestionListWrapper({
  questions,
  riskAreaId,
  typeQuery,
  reorderDisabled,
}: Props) {
  const router = useRouter();

  async function handleReorder(
    questionId: string,
    newIndex: number,
  ): Promise<{ success: boolean; error?: string }> {
    const result = await reorderPillarQuestionToPosition(questionId, riskAreaId, newIndex);
    if (result.success) {
      router.refresh();
    }
    return result;
  }

  async function handleMove(questionId: string, direction: "up" | "down"): Promise<void> {
    const formData = new FormData();
    formData.set("questionId", questionId);
    formData.set("riskAreaId", riskAreaId);
    formData.set("direction", direction);
    await movePillarQuestionOrder(formData);
    router.refresh();
  }

  return (
    <SortableQuestionList
      questions={questions}
      riskAreaId={riskAreaId}
      typeQuery={typeQuery}
      reorderDisabled={reorderDisabled}
      reorderAction={handleReorder}
      moveAction={handleMove}
      deleteAction={deletePillarQuestion}
      visibilityAction={updatePillarQuestionVisibility}
    />
  );
}
