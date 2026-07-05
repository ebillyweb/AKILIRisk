"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import {
  findRulePickerQuestion,
  formatRulePickerQuestionLabel,
  type RulePickerQuestion,
} from "@/lib/admin/recommendation-rule-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FieldHelpKey } from "@/lib/field-help/content";
import { LabelWithHelp } from "@/components/ui/field-help";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL_PILLARS = "__all__";

type QuestionPickerProps = {
  id: string;
  label: string;
  value: string;
  questions: RulePickerQuestion[];
  onChange: (questionId: string) => void;
  disabled?: boolean;
  helperText?: string;
  helpKey?: FieldHelpKey;
};

export function QuestionPicker({
  id,
  label,
  value,
  questions,
  onChange,
  disabled = false,
  helperText,
  helpKey = "condition-question",
}: QuestionPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pillarFilter, setPillarFilter] = useState(ALL_PILLARS);
  const [manualId, setManualId] = useState(false);

  const selected = findRulePickerQuestion(questions, value);
  const unknownSelection = Boolean(value) && !selected;

  const pillarOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const question of questions) {
      seen.set(question.pillarId, question.pillarName);
    }
    return [...seen.entries()]
      .map(([pillarId, pillarName]) => ({ pillarId, pillarName }))
      .sort((a, b) => a.pillarName.localeCompare(b.pillarName));
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return questions.filter((question) => {
      if (pillarFilter !== ALL_PILLARS && question.pillarId !== pillarFilter) {
        return false;
      }
      if (!query) return true;
      return (
        question.text.toLowerCase().includes(query) ||
        question.questionId.toLowerCase().includes(query) ||
        question.pillarName.toLowerCase().includes(query)
      );
    });
  }, [pillarFilter, questions, search]);

  return (
    <div className="space-y-2 md:col-span-2">
      <LabelWithHelp htmlFor={id} helpKey={helpKey}>
        {label}
      </LabelWithHelp>

      {!manualId ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className={cn(
                "h-auto min-h-10 w-full justify-between py-2 text-left font-normal",
                !value && "text-muted-foreground",
              )}
            >
              <span className="min-w-0 pr-2">
                {selected ? (
                  <span className="block space-y-1">
                    <span className="block text-sm">{formatRulePickerQuestionLabel(selected)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {selected.pillarName}
                    </span>
                  </span>
                ) : unknownSelection ? (
                  <span className="block space-y-1">
                    <span className="block text-sm">Legacy question reference</span>
                    <span className="block font-mono text-xs text-muted-foreground">{value}</span>
                  </span>
                ) : (
                  "Choose a question…"
                )}
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(100vw-2rem,32rem)] p-0" align="start">
            <div className="space-y-3 border-b p-3">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by question, risk domain, or ID…"
                autoFocus
              />
              <Select value={pillarFilter} onValueChange={setPillarFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All risk domains" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PILLARS}>All risk domains</SelectItem>
                  {pillarOptions.map((pillar) => (
                    <SelectItem key={pillar.pillarId} value={pillar.pillarId}>
                      {pillar.pillarName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              {filteredQuestions.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No questions match your search.
                </p>
              ) : (
                filteredQuestions.map((question) => (
                  <button
                    key={question.questionId}
                    type="button"
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent",
                      question.questionId === value && "bg-accent",
                    )}
                    onClick={() => {
                      onChange(question.questionId);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <span className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-normal">
                        {question.pillarName}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{question.type}</span>
                    </span>
                    <span className="block text-sm">{formatRulePickerQuestionLabel(question)}</span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <Input
          id={id}
          value={value}
          disabled={disabled}
          placeholder="Enter question ID"
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {helperText ? <span>{helperText}</span> : null}
        <button
          type="button"
          className="text-foreground underline-offset-4 hover:underline"
          onClick={() => setManualId((current) => !current)}
          disabled={disabled}
        >
          {manualId ? "Use question picker" : "Enter question ID manually"}
        </button>
      </div>
    </div>
  );
}
