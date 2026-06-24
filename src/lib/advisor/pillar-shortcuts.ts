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
  HeartHandshake,
} from "lucide-react";
import { RISK_AREAS } from "@/lib/advisor/types";

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
  "family-governance-behavioral": HeartHandshake,
};

/** Platform assessment pillars — same IDs as methodology and intake focus areas. */
export const ADVISOR_PILLAR_SHORTCUTS = RISK_AREAS.map((area) => ({
  id: area.id,
  name: area.name,
  summary: area.summary,
  icon: PILLAR_ICONS[area.id] ?? Shield,
}));
