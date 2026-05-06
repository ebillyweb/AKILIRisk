import "server-only";

import { prisma } from "@/lib/db";
import type { DashboardClient, DashboardMetrics, RiskDistribution } from "./types";
import { decryptUserEmail } from "@/lib/auth/user-email";

export async function getAdvisorDashboardClients(advisorProfileId: string): Promise<DashboardClient[]> {
  // Round-11 commit 2.4b: include `client` (full row) so we read
  // emailCiphertext alongside id/name; decrypt at exit. Prisma's
  // generated type for `include: { client: true }` carries
  // emailCiphertext automatically.
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: {
      advisorId: advisorProfileId,
      status: 'ACTIVE',
    },
    include: {
      client: {
        include: {
          assessments: {
            where: {
              status: 'COMPLETED',
            },
            orderBy: {
              completedAt: 'desc',
            },
            include: {
              scores: {
                orderBy: {
                  calculatedAt: 'desc',
                },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  return assignments.map(assignment => {
    const completedAssessments = assignment.client.assessments;
    const latestAssessment = completedAssessments[0] || null;
    const latestScore = latestAssessment?.scores[0] || null;

    return {
      id: assignment.client.id,
      name: assignment.client.name,
      email: decryptUserEmail(assignment.client.emailCiphertext),
      assignedAt: assignment.assignedAt,
      latestScore: latestScore ? {
        score: latestScore.score,
        riskLevel: latestScore.riskLevel,
        calculatedAt: latestScore.calculatedAt,
        breakdown: latestScore.breakdown,
      } : null,
      assessmentCount: completedAssessments.length,
      latestAssessmentDate: latestAssessment?.completedAt || null,
    };
  });
}

export function getDashboardMetrics(clients: DashboardClient[]): DashboardMetrics {
  const totalClients = clients.length;
  const assessedClients = clients.filter(client => client.latestScore !== null);
  const assessedCount = assessedClients.length;

  const averageScore = assessedCount > 0
    ? assessedClients.reduce((sum, client) => sum + client.latestScore!.score, 0) / assessedCount
    : null;

  const highRiskCount = assessedClients.filter(client =>
    client.latestScore!.riskLevel === 'HIGH' || client.latestScore!.riskLevel === 'CRITICAL'
  ).length;

  return {
    totalClients,
    averageScore,
    highRiskCount,
    assessedCount,
  };
}

export function getRiskDistribution(clients: DashboardClient[]): RiskDistribution {
  const distribution = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  clients.forEach(client => {
    if (client.latestScore) {
      switch (client.latestScore.riskLevel) {
        case 'LOW':
          distribution.low++;
          break;
        case 'MEDIUM':
          distribution.medium++;
          break;
        case 'HIGH':
          distribution.high++;
          break;
        case 'CRITICAL':
          distribution.critical++;
          break;
      }
    }
  });

  return distribution;
}