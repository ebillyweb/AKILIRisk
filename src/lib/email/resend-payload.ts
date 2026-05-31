import type { Attachment, CreateEmailOptions } from "resend";

/** Options accepted by `resend.emails.send` — used by logo attachment helpers. */
export type ResendEmailPayload = CreateEmailOptions;

export type ResendEmailAttachment = Attachment;
