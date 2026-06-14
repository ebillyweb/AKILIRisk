"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContactForm } from "@/lib/actions/contact-form-actions";
import { TurnstileWidget } from "@/components/marketing/TurnstileWidget";
import {
  getContactFormIntentPreset,
  parseContactFormIntent,
  type ContactFormIntent,
} from "@/lib/marketing/contact-form-intent";

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

const CAPTCHA_ENABLED = Boolean(TURNSTILE_SITE_KEY);

interface ContactFormProps {
  className?: string;
  intent?: ContactFormIntent | null;
  audience?: "general" | "sales";
  embedded?: boolean;
  onSuccess?: () => void;
}

export function ContactForm({
  className,
  intent: intentProp = null,
  audience = "general",
  embedded = false,
  onSuccess,
}: ContactFormProps) {
  const searchParams = useSearchParams();
  const intentAppliedRef = useRef(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (intentAppliedRef.current) return;
    const intent =
      intentProp ?? parseContactFormIntent(searchParams.get("intent"));
    const preset = getContactFormIntentPreset(intent);
    if (!preset) return;
    setSubject((current) => (current.trim() ? current : preset.subject));
    setMessage((current) => (current.trim() ? current : preset.message));
    intentAppliedRef.current = true;
  }, [intentProp, searchParams]);

  const handleTokenChange = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (CAPTCHA_ENABLED && !turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setIsLoading(true);
    const result = await submitContactForm({
      name,
      email,
      subject,
      message,
      turnstileToken: turnstileToken ?? undefined,
      audience,
    });
    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setTurnstileToken(null);
      onSuccess?.();
      return;
    }

    setError(result.error);
  };

  if (success) {
    return (
      <div className={className}>
        <Alert>
          <AlertDescription>
            Thank you. Your message has been sent. We will respond to the email
            you provided as soon as we can.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
      data-testid="contact-form"
    >
      <div
        className={
          embedded
            ? "space-y-4"
            : "space-y-5 rounded-[1.25rem] border border-border/70 bg-card/80 p-5 sm:p-6"
        }
      >
        {!embedded ? (
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Send a message</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              Complete the form below and we will email you back at the address you
              provide.
            </p>
          </div>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!CAPTCHA_ENABLED ? (
          <Alert>
            <AlertDescription>
              The contact form is not fully configured in this environment (missing
              Turnstile site key). Set{" "}
              <code className="text-xs">NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> and{" "}
              <code className="text-xs">TURNSTILE_SECRET_KEY</code>, or use{" "}
              <code className="text-xs">CONTACT_FORM_SKIP_CAPTCHA=1</code> in
              development only.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input
            id="contact-name"
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
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-subject">Subject (optional)</Label>
          <Input
            id="contact-subject"
            name="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="How can we help?"
            disabled={isLoading}
            data-testid="contact-form-subject"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-message">Message</Label>
          <Textarea
            id="contact-message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={5}
            placeholder="Your message"
            className="resize-y min-h-[120px]"
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
          {isLoading ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
