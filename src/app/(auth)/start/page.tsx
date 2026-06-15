"use client";

import { useState, FormEvent, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { submitInviteCode } from "@/lib/actions/invite";
import { cn } from "@/lib/utils";

const BOX_COUNT = 6;

export default function StartAssessmentPage() {
  const router = useRouter();
  const [values, setValues] = useState<string[]>(() => Array(BOX_COUNT).fill(""));
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const code = values.join("").trim();

  const setValueAt = useCallback((index: number, value: string) => {
    const char = value.replace(/[^A-Za-z0-9]/g, "").slice(-1).toUpperCase();
    setValues((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < BOX_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !values[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [values]
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const chars = e.clipboardData
      .getData("text")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, BOX_COUNT);
    setValues((prev) => {
      const next = [...prev];
      for (let i = 0; i < chars.length; i++) next[i] = chars[i];
      return next;
    });
    const nextFocus = Math.min(chars.length, BOX_COUNT - 1);
    inputRefs.current[nextFocus]?.focus();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!code) return;
    setIsLoading(true);
    const result = await submitInviteCode(code);
    setIsLoading(false);
    if (result.redirectUrl) {
      router.push(result.redirectUrl);
      return;
    }
    if (result.error) setError(result.error);
  };

  return (
    <AuthPanel
      eyebrow="Personal Risk Profile"
      title="Enter invite code"
      description="Your advisor has provided a 6-character invite code (letters and numbers) to start the assessment. Enter it below to create your account and begin."
      footer={
        <div className="flex flex-col">
          <span>
            Already have an account?{" "}
            <a
              href="/signin/magic-link"
              className="font-semibold text-foreground hover:underline"
            >
              Sign in
            </a>
          </span>
          <div className="mt-3 border-t section-divider pt-3">
            <span>
              Looking for an advisor?{" "}
              <a
                href="/request-review"
                className="font-semibold text-foreground hover:underline"
              >
                Request a review here
              </a>
            </span>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label id="code-label">6-character invite code (letters and numbers)</Label>
          <div
            className="flex justify-center gap-2"
            role="group"
            aria-labelledby="code-label"
          >
            {Array.from({ length: BOX_COUNT }, (_, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="text"
                maxLength={1}
                value={values[i]}
                onChange={(e) => setValueAt(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                autoComplete="one-time-code"
                disabled={isLoading}
                className={cn(
                  "h-11 w-11 min-w-0 rounded-xl border border-input bg-card/80 text-center text-lg font-mono font-semibold uppercase tracking-wider shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-all duration-200 outline-none",
                  "focus-visible:border-brand/50 focus-visible:ring-[3px] focus-visible:ring-brand/20",
                  "focus-visible:bg-gradient-to-br focus-visible:from-brand/15 focus-visible:via-background focus-visible:to-brand/5",
                  "disabled:pointer-events-none disabled:opacity-50"
                )}
                aria-label={`Character ${i + 1} of ${BOX_COUNT}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Enter one letter or number per box. Paste supported.
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={isLoading || !code}>
          {isLoading ? "Checking…" : "Continue to create account"}
        </Button>
      </form>
    </AuthPanel>
  );
}
