"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitGovernanceReviewLead } from "@/lib/actions/governance-review-lead";
import type { FamilyComplexity } from "@prisma/client";

const FAMILY_COMPLEXITY_OPTIONS: { value: FamilyComplexity; label: string }[] = [
  { value: "SINGLE_HOUSEHOLD", label: "Single household" },
  { value: "MULTI_GENERATIONAL", label: "Multi-generational" },
  { value: "FAMILY_BUSINESS_INVOLVED", label: "Family business involved" },
];

export default function RequestGovernanceReviewPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [familyOfficeName, setFamilyOfficeName] = useState("");
  const [primaryAdvisor, setPrimaryAdvisor] = useState("");
  const [familyComplexity, setFamilyComplexity] = useState<FamilyComplexity | "">("");
  const [promptedInterest, setPromptedInterest] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!familyComplexity) {
      setError("Please select approximate family complexity.");
      return;
    }
    setIsLoading(true);
    const result = await submitGovernanceReviewLead({
      name,
      email,
      familyOfficeName,
      primaryAdvisor: primaryAdvisor || null,
      familyComplexity,
      promptedInterest: promptedInterest || null,
    });
    setIsLoading(false);
    if (result.success) {
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
            Your assessment request has been submitted. We will contact you at the email you provided.
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
      description="You are a client requesting full risk coverage—often across more than one pillar. Submit this short form and Akili Risk Intelligence will follow up. This is not the full intake."
      footer={
        <span>
          Already have an account?{" "}
          <Link
            href="/signin/magic-link"
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
          <Label htmlFor="familyOfficeName">Family Office / Household Name</Label>
          <Input
            id="familyOfficeName"
            type="text"
            value={familyOfficeName}
            onChange={(e) => setFamilyOfficeName(e.target.value)}
            required
            placeholder="Household or family office name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="primaryAdvisor">Primary Advisor (optional)</Label>
          <Input
            id="primaryAdvisor"
            type="text"
            value={primaryAdvisor}
            onChange={(e) => setPrimaryAdvisor(e.target.value)}
            placeholder="Advisor or firm name"
          />
        </div>
        <div className="space-y-2">
          <Label>Approximate Family Complexity</Label>
          <div className="flex flex-col gap-2 pt-1">
            {FAMILY_COMPLEXITY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-border/70 bg-background/50 px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <input
                  type="radio"
                  name="familyComplexity"
                  value={opt.value}
                  checked={familyComplexity === opt.value}
                  onChange={() => setFamilyComplexity(opt.value)}
                  className="size-4"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
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
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Submitting…" : "Submit"}
        </Button>
      </form>
    </AuthPanel>
  );
}
