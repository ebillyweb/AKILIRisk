import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { validatePasswordForSet } from "@/lib/auth/password-policy";
import { getPasswordPolicy } from "@/lib/platform/password-policy-settings";
import {
  applyPasswordUpdate,
  hashPasswordForStorage,
} from "@/lib/auth/password-update";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(1, "New password is required"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from your current password" },
        { status: 400 }
      );
    }

    const policy = await getPasswordPolicy();
    const policyCheck = await validatePasswordForSet(newPassword, policy);
    if (!policyCheck.ok) {
      return NextResponse.json({ error: policyCheck.error }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true, role: true, deletedAt: true },
    });

    if (!user?.password || user.deletedAt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentValid = await bcrypt.compare(currentPassword, user.password);
    if (!currentValid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPasswordForStorage(newPassword);

    await applyPasswordUpdate(user.id, hashedPassword, policy);

    await prisma.session.deleteMany({
      where: { userId: user.id },
    });

    await writeAudit({
      actor: { userId: user.id, role: user.role, email: session.user.email },
      action: AUDIT_ACTIONS.AUTH_PASSWORD_RESET_COMPLETED,
      entityType: "User",
      entityId: user.id,
      metadata: { source: "change_password", sessionsInvalidated: true },
      request: req,
    });

    return NextResponse.json({
      message: "Password updated successfully. Please sign in again.",
      requiresSignIn: true,
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const policy = await getPasswordPolicy();
  return NextResponse.json({
    requirements: {
      minLength: policy.minLength,
      requireUppercase: policy.requireUppercase,
      requireNumber: policy.requireNumber,
    },
    complianceNotice: policy.complianceNotice,
    passwordChangeRequired: Boolean(session.user.passwordChangeRequired),
  });
}
