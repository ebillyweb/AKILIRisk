import "server-only";

import type { LucideIcon } from "lucide-react";
import {
  Globe,
  Shield,
  Lock,
  Umbrella,
  Scale,
  Users,
  Landmark,
  Receipt,
  ScrollText,
  Cpu,
} from "lucide-react";
import { loadAdvisorMethodologyPillars } from "@/lib/methodology/methodology-queries";

const PILLAR_ICONS: Record<string, LucideIcon> = {
  governance: Scale,
  "cyber-digital": Lock,
  "physical-security": Shield,
  insurance: Umbrella,
  "geographic-environmental": Globe,
  "reputational-social": Users,
  "liquidity-cash": Landmark,
  "tax-exposure": Receipt,
  "estate-succession": ScrollText,
  "family-governance-behavioral": Cpu,
};

export type AdvisorPillarShortcut = {
  id: string;
  name: string;
  summary: string;
  icon: LucideIcon;
};

/** Active methodology pillars for advisor intelligence shortcuts (from DB). */
export async function loadAdvisorPillarShortcuts(
  advisorProfileId: string,
): Promise<AdvisorPillarShortcut[]> {
  const pillars = await loadAdvisorMethodologyPillars(advisorProfileId);

  return pillars
    .filter((pillar) => pillar.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((pillar) => ({
      id: pillar.slug,
      name: pillar.displayName?.trim() || pillar.canonicalName,
      summary: pillar.description?.trim() ?? "",
      icon: PILLAR_ICONS[pillar.slug] ?? Shield,
    }));
}
