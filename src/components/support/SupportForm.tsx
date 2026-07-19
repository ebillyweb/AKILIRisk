"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { ImagePlus, Trash2 } from "lucide-react";
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
  SUPPORT_ATTACHMENT_ALLOWED_TYPES,
  SUPPORT_ATTACHMENT_MAX_BYTES,
} from "@/lib/support/attachment";
import {
  SUPPORT_TICKET_CATEGORIES,
  type SupportTicketCategory,
} from "@/lib/support/categories";
import { cn } from "@/lib/utils";

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

const CAPTCHA_ENABLED = Boolean(TURNSTILE_SITE_KEY);

const ACCEPT_ATTR = SUPPORT_ATTACHMENT_ALLOWED_TYPES.join(",");

type PendingAttachment = {
  filename: string;
  contentType: string;
  contentBase64: string;
  previewUrl: string;
  sizeBytes: number;
};

interface SupportFormProps {
  defaultName: string;
  email: string;
  className?: string;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read the image."));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupportForm({
  defaultName,
  email,
  className,
}: SupportFormProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState<SupportTicketCategory | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    };
  }, [attachment?.previewUrl]);

  const clearAttachment = useCallback(() => {
    setAttachment((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const acceptImageFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    setError("");

    if (
      !(SUPPORT_ATTACHMENT_ALLOWED_TYPES as readonly string[]).includes(
        file.type
      )
    ) {
      setError("Attach a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
      setError("Image must be 4 MB or smaller.");
      return;
    }

    try {
      const contentBase64 = await readFileAsBase64(file);
      setAttachment((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return {
          filename: file.name || "pasted-image.png",
          contentType: file.type,
          contentBase64,
          previewUrl: URL.createObjectURL(file),
          sizeBytes: file.size,
        };
      });
    } catch {
      setError("Could not read that image. Try another file.");
    }
  }, []);

  const handleTokenChange = useCallback((token: string | null) => {
    setTurnstileToken(token);
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    void acceptImageFile(e.target.files?.[0]);
  };

  const handlePaste = (e: ClipboardEvent<HTMLElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        e.preventDefault();
        void acceptImageFile(item.getAsFile());
        return;
      }
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    void acceptImageFile(e.dataTransfer.files?.[0]);
  };

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
      attachment: attachment
        ? {
            filename: attachment.filename,
            contentType: attachment.contentType as (typeof SUPPORT_ATTACHMENT_ALLOWED_TYPES)[number],
            contentBase64: attachment.contentBase64,
          }
        : undefined,
    });
    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
      setCategory("");
      setSubject("");
      setMessage("");
      clearAttachment();
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
      onPaste={handlePaste}
    >
      <div className="space-y-5 rounded-[1.25rem] border border-border/70 bg-card/80 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            Submit a support ticket
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            Tell us what you need help with. We reply to the email on your
            account. You can attach or paste a screenshot of a document.
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
            placeholder="Describe what happened and what you need help with. You can also paste a screenshot here (⌘V / Ctrl+V)."
            className="min-h-[140px] resize-y"
            disabled={isLoading}
            onPaste={handlePaste}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={fileInputId}>Screenshot or document image</Label>
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            disabled={isLoading}
            onChange={handleFileChange}
            data-testid="support-form-attachment"
          />
          {attachment ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/60 p-3 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img
                src={attachment.previewUrl}
                alt="Attachment preview"
                className="h-24 w-auto max-w-full rounded-lg border border-border/60 object-contain"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {attachment.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(attachment.sizeBytes)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={clearAttachment}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Remove
              </Button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
                dragActive
                  ? "border-brand bg-brand/5"
                  : "border-border/80 bg-background/40 hover:border-muted-foreground/40",
                isLoading && "pointer-events-none opacity-60"
              )}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDrop={handleDrop}
              onPaste={handlePaste}
              data-testid="support-form-attachment-dropzone"
            >
              <ImagePlus className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                Drop an image, click to browse, or paste a screenshot
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPEG, WebP, or GIF up to 4 MB
              </p>
            </div>
          )}
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
