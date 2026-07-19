"use client";

import { useCallback, useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { submitSupportTicket } from "@/lib/actions/support-ticket-actions";
import {
  SUPPORT_TICKET_CATEGORIES,
  type SupportTicketCategory,
} from "@/lib/support/categories";

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

const CAPTCHA_ENABLED = Boolean(TURNSTILE_SITE_KEY);

interface SupportFormProps {
  defaultName: string;
  email: string;
  className?: string;
}

export function SupportForm({
  defaultName,
  email,
  className,
}: SupportFormProps) {
  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState<SupportTicketCategory | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleTokenChange = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!category) {
      setError("Select a category.");
      return;
    }

    if (CAPTCHA_ENABLED && !turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setIsLoading(true);
    const result = await submitSupportTicket({
      name,
      category,
      subject,
      message,
      turnstileToken: turnstileToken ?? undefined,
    });
    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
      setCategory("");
      setSubject("");
      setMessage("");
      setTurnstileToken(null);
      return;
    }

    setError(result.error);
  };

  if (success) {
    return (
      <div className={className}>
        <Alert>
          <AlertDescription>
            Thank you. Your support ticket has been sent. We will respond to{" "}
            <span className="font-medium text-foreground">{email}</span> as soon
            as we can.
          </AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => setSuccess(false)}
        >
          Submit another ticket
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
      data-testid="support-form"
    >
      <div className="space-y-5 rounded-[1.25rem] border border-border/70 bg-card/80 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            Submit a support ticket
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            Tell us what you need help with. We reply to the email on your
            account.
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!CAPTCHA_ENABLED ? (
          <Alert>
            <AlertDescription>
              The support form is not fully configured in this environment
              (missing Turnstile site key). Set{" "}
              <code className="text-xs">NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> and{" "}
              <code className="text-xs">TURNSTILE_SECRET_KEY</code>, or use{" "}
              <code className="text-xs">CONTACT_FORM_SKIP_CAPTCHA=1</code> in
              development only.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="support-name">Name</Label>
          <Input
            id="support-name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Your name"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="support-email">Email</Label>
          <Input
            id="support-email"
            name="email"
            type="email"
            value={email}
            readOnly
            disabled
            autoComplete="email"
          />
          <p className="text-xs text-muted-foreground">
            Replies go to the email address on your account.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="support-category">Category</Label>
          <Select
            value={category || undefined}
            onValueChange={(value) =>
              setCategory(value as SupportTicketCategory)
            }
            disabled={isLoading}
            required
          >
            <SelectTrigger
              id="support-category"
              data-testid="support-form-category"
            >
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORT_TICKET_CATEGORIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="support-subject">Subject</Label>
          <Input
            id="support-subject"
            name="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder="Brief summary of the issue"
            disabled={isLoading}
            data-testid="support-form-subject"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="support-message">Message</Label>
          <Textarea
            id="support-message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={6}
            placeholder="Describe what happened and what you need help with"
            className="min-h-[140px] resize-y"
            disabled={isLoading}
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
          className="w-full sm:w-auto"
          disabled={isLoading || (CAPTCHA_ENABLED && !turnstileToken)}
        >
          {isLoading ? "Sending…" : "Submit ticket"}
        </Button>
      </div>
    </form>
  );
}
