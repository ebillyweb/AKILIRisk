"use server";

/**
 * Round-11 commit 4 (BRD §5.1.AUTH): advisor-side client-auth actions.
 *
 *   - reassignClientEmail({clientId, newEmail})
 *   - reissueClientMagicLink({clientId})
 *
 * Both are advisor-only and ownership-gated through ClientAdvisorAssignment
 * (mirrors the pattern in advisor-intake-waiver-actions.ts). Both audit-log
 * via round-7's writeAudit; the audit redactor hashes email-shaped fields
 * automatically so no extra scrubbing here.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getAdvisorProfileOrThrow,
  requireAdvisorRole,
} from "@/lib/advisor/auth";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import {
  issueMagicLinkToken,
  invalidatePriorMagicLinkTokens,
} from "@/lib/auth/magic-link";
import { decryptUserEmail, findUserByEmail, userEmailWriteData } from "@/lib/auth/user-email";
import { shortEmailHash } from "@/lib/audit/redact";
import { sendMagicLinkEmail } from "@/lib/email";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}
function fail(error: string): ActionResult<never> {
  return { success: false, error };
}

const reassignEmailSchema = z.object({
  clientId: z.string().cuid(),
  newEmail: z.string().email().max(254),
});

const reissueSchema = z.object({
  clientId: z.string().cuid(),
});

function resolvePublicBaseUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "NEXT_PUBLIC_URL is not configured; refusing to send magic-link with localhost link"
    );
    return null;
  }
  return "http://localhost:3000";
}

/** Verify the calling advisor is assigned (status=ACTIVE) to the client.
 *  Returns the assignment + advisor profile + client snapshot, or a
 *  structured failure. Mirrors the gate in advisor-intake-waiver-actions. */
async function gateAssignedClient(clientId: string) {
  const { userId, role, email: actorEmail } = await requireAdvisorRole();
  const profile = await getAdvisorProfileOrThrow(userId);

  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId, advisorId: profile.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!assignment) return { success: false as const, error: "This client is not assigned to you." };

  // Round-11 commit 2.4b: column dropped; only emailCiphertext.
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { id: true, emailCiphertext: true, role: true, deletedAt: true },
  });
  if (!client || client.deletedAt) return { success: false as const, error: "Client not found." };
  if (client.role !== "USER") {
    return { success: false as const, error: "Target account is not a client." };
  }

  return {
    success: true as const,
    actor: { userId, role: role as UserRole, email: actorEmail },
    advisorProfileId: profile.id,
    assignmentId: assignment.id,
    client,
  };
}

/**
 * Update an assigned client's email. The new email must:
 *   - parse as an email
 *   - not collide with another existing User row
 *
 * Audit row captures both the old and new email; the redactor hashes both.
 *
 * Note: we DON'T issue a fresh magic-link automatically here. The advisor
 * UI flows reassign-email then click "Re-issue magic link" as two
 * deliberate actions (separate audit rows, separate confirms).
 */
export async function reassignClientEmail(
  input: { clientId: string; newEmail: string }
): Promise<ActionResult<{ clientId: string; oldEmail: string; newEmail: string }>> {
  try {
    const parsed = reassignEmailSchema.parse(input);
    const gate = await gateAssignedClient(parsed.clientId);
    if (!gate.success) return fail(gate.error);

    const { actor, client } = gate;
    const newEmail = parsed.newEmail.toLowerCase().trim();
    // Round-11 commit 2.4a: derive plaintext from ciphertext rather
    // than the (now-optional) plaintext column.
    const oldEmail = decryptUserEmail(client.emailCiphertext);

    if (newEmail === oldEmail.toLowerCase()) {
      return ok({ clientId: client.id, oldEmail, newEmail });
    }

    // Round-11 commit 2.3 (BRD §5.1.AUTH / phase A): dual-read +
    // dual-write. Collision check looks at both ciphertext and
    // plaintext columns; the update populates both.
    const collision = await findUserByEmail(newEmail, {
      select: { id: true },
    });
    if (collision && collision.id !== client.id) {
      return fail("That email is already in use by another account.");
    }

    await prisma.user.update({
      where: { id: client.id },
      data: userEmailWriteData(newEmail),
    });

    // Invalidate any in-flight magic-link tokens addressed to the old
    // email — they'd lookup against a User row that no longer matches
    // and silently fail at the auth provider, but cleaner to drop them.
    await invalidatePriorMagicLinkTokens(oldEmail);

    // Round-11 commit 2.4a: store hashes directly under non-`email`
    // keys (the redactor's auto-hash rule keys off the suffix `email`,
    // so a key like `emailHash` flows through unmodified). Hashing at
    // the call site keeps this audit row stable across the 2.4b
    // column drop — the call site already has plaintext for both
    // values (oldEmail decrypted above, newEmail is form input).
    await writeAudit({
      actor,
      action: AUDIT_ACTIONS.CLIENT_EMAIL_REASSIGN,
      entityType: "User",
      entityId: client.id,
      beforeData: { emailHash: shortEmailHash(oldEmail) },
      afterData: { emailHash: shortEmailHash(newEmail) },
      metadata: { clientId: client.id },
    });

    revalidatePath(`/advisor/pipeline/${client.id}`);
    revalidatePath("/advisor/pipeline");
    return ok({ clientId: client.id, oldEmail, newEmail });
  } catch (err) {
    logSafeError("reassignClientEmail", err);
    return fail(safeErrorMessage(err, "Failed to update client email"));
  }
}

/**
 * Re-issue a magic link to the client's current email. Invalidates any
 * prior unexpired tokens for the email so the new link supersedes them.
 *
 * Audit metadata captures the new tokenId for cross-reference with
 * AUTH_MAGIC_LINK_REQUEST / AUTH_MAGIC_LINK_SUCCESS rows.
 */
export async function reissueClientMagicLink(
  input: { clientId: string }
): Promise<ActionResult<{ clientId: string; email: string }>> {
  try {
    const parsed = reissueSchema.parse(input);
    const gate = await gateAssignedClient(parsed.clientId);
    if (!gate.success) return fail(gate.error);

    const { actor, client } = gate;
    const baseUrl = resolvePublicBaseUrl();
    if (!baseUrl) return fail("Sign-in is temporarily unavailable.");

    // Round-11 commit 2.4a: derive plaintext from ciphertext rather
    // than the (now-optional) client.email column.
    const clientEmail = decryptUserEmail(client.emailCiphertext);

    await invalidatePriorMagicLinkTokens(clientEmail);
    const issued = await issueMagicLinkToken(clientEmail);
    const verifyUrl = `${baseUrl}/auth/magic-link/verify?token=${issued.rawToken}`;
    // Fire-and-forget the email so the action returns fast; the email
    // helper has its own try/catch and never throws.
    void sendMagicLinkEmail(clientEmail, verifyUrl);

    // metadata.email — auto-redacted to { emailHash: <hash> } by the
    // redactor's email-suffix rule, so it survives the bake window
    // unchanged.
    await writeAudit({
      actor,
      action: AUDIT_ACTIONS.CLIENT_MAGIC_LINK_REISSUE,
      entityType: "User",
      entityId: client.id,
      metadata: {
        clientId: client.id,
        email: clientEmail,
        tokenId: issued.tokenId,
      },
    });

    revalidatePath(`/advisor/pipeline/${client.id}`);
    return ok({ clientId: client.id, email: clientEmail });
  } catch (err) {
    logSafeError("reissueClientMagicLink", err);
    return fail(safeErrorMessage(err, "Failed to re-issue magic link"));
  }
}
