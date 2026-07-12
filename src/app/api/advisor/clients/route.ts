import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withDecryptedEmail } from "@/lib/auth/user-email";
import { resolvePortfolioScope } from "@/lib/enterprise/portfolio-access";
import { resolveUser } from "@/lib/mobile/token";

/** GET /api/advisor/clients — clients in scope with intake status (plan §4.3). */
export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "ADVISOR") {
    return NextResponse.json({ error: "Advisor access required" }, { status: 403 });
  }

  const scope = await resolvePortfolioScope(user.id);
  if (!scope) {
    return NextResponse.json([]);
  }

  // Firm scope (owners/admins, or members when the firm shares client visibility)
  // sees every assignment in the enterprise; otherwise only the advisor's own book.
  const assignmentWhere =
    scope.mode === "firm"
      ? { advisor: { enterpriseId: scope.enterpriseId }, status: "ACTIVE" as const }
      : { advisorId: scope.advisorProfileId, status: "ACTIVE" as const };

  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: assignmentWhere,
    select: {
      client: {
        select: {
          id: true,
          name: true,
          emailCiphertext: true,
          intakeInterviews: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { id: true, status: true, submittedAt: true },
          },
        },
      },
    },
  });

  const clients = assignments.map(({ client }) => {
    const decrypted = withDecryptedEmail(client);
    const interview = decrypted.intakeInterviews[0];
    return {
      id: decrypted.id,
      name: decrypted.name,
      email: decrypted.email,
      intakeStatus: interview?.status ?? "NOT_STARTED",
      submittedAt: interview?.submittedAt?.toISOString() ?? null,
      interviewId: interview?.id ?? null,
    };
  });

  return NextResponse.json(clients);
}
