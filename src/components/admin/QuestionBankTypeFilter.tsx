"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  QUESTION_BANK_FILTER_TYPES,
  QUESTION_BANK_TYPE_LABELS,
} from "@/lib/assessment/bank/question-bank-types";

const ALL_TYPES = "__all__";

export function QuestionBankTypeFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("type") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label
        htmlFor="question-bank-type"
        className="whitespace-nowrap text-sm text-muted-foreground"
      >
        Question type
      </Label>
      <Select
        value={current === "" ? ALL_TYPES : current}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams.toString());
          if (v === ALL_TYPES) next.delete("type");
          else next.set("type", v);
          const qs = next.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        }}
      >
        <SelectTrigger id="question-bank-type" className="h-12 min-w-[12rem] w-[min(100%,18rem)]" aria-label="Filter by question type">
          <SelectValue placeholder="All types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TYPES}>All types</SelectItem>
          {QUESTION_BANK_FILTER_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {QUESTION_BANK_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
