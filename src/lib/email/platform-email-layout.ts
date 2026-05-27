import { escapeHtml } from "@/lib/escape-html";
import {
  PLATFORM_EMAIL_BRAND_BLUE,
  PLATFORM_EMAIL_BRAND_NAME,
  PLATFORM_EMAIL_CTA_BG,
  PLATFORM_EMAIL_HEADER_GRADIENT,
  PLATFORM_EMAIL_TAGLINE,
  platformEmailCopyrightYear,
} from "@/lib/email/platform-brand";
import { PLATFORM_EMAIL_LOGO_CID } from "@/lib/email/platform-email-logo";

export type PlatformEmailCta = {
  label: string;
  href: string;
};

export type WrapPlatformEmailOptions = {
  documentTitle: string;
  /** Pre-escaped HTML for the main white content area. */
  bodyHtml: string;
  appOrigin?: string | null;
  /** Pre-escaped footer note; defaults to standard platform footer. */
  footerHtml?: string;
};

function renderLogoBlock(): string {
  return `<img src="cid:${PLATFORM_EMAIL_LOGO_CID}" alt="${escapeHtml(PLATFORM_EMAIL_BRAND_NAME)}" width="220" height="74" style="display:block;margin:0 auto 12px;max-width:220px;height:auto;border:0;" />`;
}

/**
 * Table-based shell for platform (non–advisor-branded) transactional emails.
 * Caller supplies escaped `bodyHtml`; this module only escapes URLs in CTAs and logo src.
 */
export function wrapPlatformEmailContent(options: WrapPlatformEmailOptions): string {
  const title = escapeHtml(options.documentTitle);
  const footer =
    options.footerHtml ??
    `<p style="margin:0;font-size:12px;line-height:1.55;color:#64748b;text-align:center;">© ${platformEmailCopyrightYear()} ${escapeHtml(PLATFORM_EMAIL_BRAND_NAME)}. All rights reserved.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#e8ecf1;font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#e8ecf1;padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.12);border:1px solid #e2e8f0;">
          <tr>
            <td style="background:${PLATFORM_EMAIL_HEADER_GRADIENT};padding:28px 28px 24px;text-align:center;border-bottom:3px solid ${PLATFORM_EMAIL_BRAND_BLUE};">
              ${renderLogoBlock()}
              <div style="color:#94a3b8;font-size:13px;margin-top:4px;line-height:1.45;max-width:28em;margin-left:auto;margin-right:auto;">${escapeHtml(PLATFORM_EMAIL_TAGLINE)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 28px;color:#334155;font-size:15px;line-height:1.65;">
              ${options.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px;background:#f1f5f9;border-top:1px solid #e2e8f0;">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/** Primary platform CTA button (inline styles for email clients). */
export function renderPlatformEmailCta(cta: PlatformEmailCta): string {
  const href = escapeHtml(cta.href);
  const label = escapeHtml(cta.label);
  return `<div style="text-align:center;margin:28px 0 8px;">
    <a href="${href}" style="display:inline-block;padding:14px 28px;border-radius:10px;background:${PLATFORM_EMAIL_CTA_BG};color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;">${label}</a>
  </div>`;
}

/** Fallback URL block under a CTA. */
export function renderPlatformEmailUrlFallback(url: string): string {
  const safe = escapeHtml(url);
  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">Or paste this link into your browser:<br /><span style="word-break:break-all;color:#64748b;">${safe}</span></p>`;
}

/** H1-style headline inside the body area. */
export function renderPlatformEmailHeadline(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;color:#0f172a;font-weight:700;">${escapeHtml(text)}</h1>`;
}

/** Amber security / notice callout. */
export function renderPlatformEmailNotice(title: string, bodyHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:linear-gradient(180deg,#fffbeb 0%,#fef3c7 100%);border-radius:12px;border:1px solid #fcd34d;">
    <tr>
      <td style="padding:16px 18px;">
        <div style="font-size:13px;font-weight:700;color:#b45309;margin:0 0 6px;">${escapeHtml(title)}</div>
        <div style="font-size:14px;color:#78350f;line-height:1.5;margin:0;">${bodyHtml}</div>
      </td>
    </tr>
  </table>`;
}

/** Neutral credentials / info panel. */
export function renderPlatformEmailPanel(title: string, innerHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
    <tr>
      <td style="padding:18px 20px;">
        <div style="font-size:15px;font-weight:600;color:#0f172a;margin:0 0 12px;">${escapeHtml(title)}</div>
        ${innerHtml}
      </td>
    </tr>
  </table>`;
}
