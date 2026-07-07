"use client";

import { useCallback, useState, FormEvent } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldHelp, LabelWithHelp } from "@/components/ui/field-help";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileWidget } from "@/components/marketing/TurnstileWidget";
import { submitGovernanceReviewLead } from "@/lib/actions/governance-review-lead";
import { FAMILY_COMPLEXITY_OPTIONS } from "@/lib/governance/family-complexity";
import { INVESTABLE_ASSETS_RANGE_OPTIONS } from "@/lib/governance/investable-assets-range";
import type { FamilyComplexity, InvestableAssetsRange } from "@prisma/client";

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

const CAPTCHA_ENABLED = Boolean(TURNSTILE_SITE_KEY);

const FAMILY_COMPLEXITY_INPUT_PREFIX = "familyComplexity";

export default function RequestGovernanceReviewPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [familyComplexity, setFamilyComplexity] = useState<FamilyComplexity | "">("");
  const [investableAssetsRange, setInvestableAssetsRange] = useState<
    InvestableAssetsRange | ""
  >("");
  const [promptedInterest, setPromptedInterest] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleTokenChange = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!familyComplexity) {
      setError("Please select approximate family complexity.");
      return;
    }
    if (CAPTCHA_ENABLED && !turnstileToken) {
      setError("Please complete the security check.");
      return;
    }
    setIsLoading(true);
    const result = await submitGovernanceReviewLead({
      name,
      email,
      familyComplexity,
      investableAssetsRange: investableAssetsRange || null,
      promptedInterest: promptedInterest || null,
      turnstileToken: turnstileToken ?? undefined,
    });
    setIsLoading(false);
    if (result.success) {
      setSubmittedEmail(email.trim());
      setSuccess(true);
    } else {
      setError(result.error);
    }
  };

  if (success) {
    return (
      <AuthPanel
        title="Request received"
        description="Thank you. Akili Risk Intelligence will be in touch."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your assessment request has been submitted
            {submittedEmail ? (
              <>
                {" "}
                and a confirmation was sent to{" "}
                <span className="font-medium text-foreground">{submittedEmail}</span>.
              </>
            ) : (
              "."
            )}{" "}
            The AKILI team will follow up personally at that address.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Return to home</Link>
          </Button>
        </div>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      eyebrow="Contact"
      title="Request a risk assessment"
      description="No AKILI account or advisor relationship required. Tell us a little about yourself and we will follow up about full risk coverage—often across more than one pillar. This is not the full intake."
      footer={
        <span>
          Already have an account?{" "}
          <Link
            href="/signin?role=client"
            className="font-semibold text-foreground hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Your name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="investableAssetsRange">
            Approximate investable assets{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Select
            value={investableAssetsRange || undefined}
            onValueChange={(value) =>
              setInvestableAssetsRange(value as InvestableAssetsRange)
            }
          >
            <SelectTrigger id="investableAssetsRange" className="w-full">
              <SelectValue placeholder="Select a range" />
            </SelectTrigger>
            <SelectContent>
              {INVESTABLE_ASSETS_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <LabelWithHelp
            title="Approximate family complexity"
            description="A rough sense of how many people and entities are in your wealth picture. Pick the closest fit—we'll confirm details when we follow up."
          >
            Approximate family complexity
          </LabelWithHelp>
          <div
            className="flex flex-col gap-2 pt-1"
            role="radiogroup"
            aria-label="Approximate family complexity"
          >
            {FAMILY_COMPLEXITY_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                className="flex items-center gap-2 rounded-md border border-border/70 bg-background/50 px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <label
                  htmlFor={`${FAMILY_COMPLEXITY_INPUT_PREFIX}-${opt.value}`}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                >
                  <input
                    type="radio"
                    id={`${FAMILY_COMPLEXITY_INPUT_PREFIX}-${opt.value}`}
                    name="familyComplexity"
                    value={opt.value}
                    checked={familyComplexity === opt.value}
                    onChange={() => setFamilyComplexity(opt.value)}
                    className="size-4 shrink-0"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
                <FieldHelp
                  title={opt.label}
                  description={opt.description}
                  triggerLabel={opt.label}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="promptedInterest">
            What prompted your interest in an assessment? (optional)
          </Label>
          <Textarea
            id="promptedInterest"
            value={promptedInterest}
            onChange={(e) => setPromptedInterest(e.target.value)}
            placeholder="A few words or a short note"
            rows={3}
            className="resize-none"
          />
        </div>
        {CAPTCHA_ENABLED ? (
          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEY}
            onTokenChange={handleTokenChange}
          />
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || (CAPTCHA_ENABLED && !turnstileToken)}
        >
          {isLoading ? "Submitting…" : "Submit"}
        </Button>
      </form>
    </AuthPanel>
  );
}
