import "server-only";

import { PillarCategoryKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  PILLAR_CATEGORY_CODE_TO_RISK_AREA_ID,
  riskAreaIdForPillarCategory,
} from "./pillar-category-risk-area";
import { isPlatformRiskAreaSlug } from "@/lib/methodology/cached-pillar-catalog";

export type PillarSectionOption = {
  id: string;
  code: string;
  name: string;
  categoryCode: string;
  displayOrder: number;
};

function categoryCodesForRiskArea(riskAreaId: string): string[] {
  const fromMap = Object.entries(PILLAR_CATEGORY_CODE_TO_RISK_AREA_ID)
    .filter(([, id]) => id === riskAreaId)
    .map(([code]) => code);
  if (fromMap.length > 0) return fromMap;
  return [riskAreaId];
}

/** Sections under assessment categories mapped to a risk area (for admin create UI). */
export async function loadPillarSectionsForRiskArea(
  riskAreaId: string
): Promise<PillarSectionOption[]> {
  if (!(await isPlatformRiskAreaSlug(riskAreaId))) return [];

  const categoryCodes = categoryCodesForRiskArea(riskAreaId);
  const categories = await prisma.pillarCategory.findMany({
    where: {
      kind: PillarCategoryKind.ASSESSMENT,
      code: { in: categoryCodes },
    },
    select: { id: true, code: true, displayOrder: true },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });

  if (categories.length === 0) {
    const all = await prisma.pillarCategory.findMany({
      where: { kind: PillarCategoryKind.ASSESSMENT },
      select: { id: true, code: true, displayOrder: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    });
    const matched = all.filter(
      (c) => riskAreaIdForPillarCategory({ code: c.code, kind: PillarCategoryKind.ASSESSMENT }) === riskAreaId
    );
    if (matched.length === 0) return [];
    return loadSectionsForCategories(matched);
  }

  return loadSectionsForCategories(categories);
}

async function loadSectionsForCategories(
  categories: Array<{ id: string; code: string; displayOrder: number }>
): Promise<PillarSectionOption[]> {
  const categoryIds = categories.map((c) => c.id);
  const codeById = new Map(categories.map((c) => [c.id, c.code]));

  const sections = await prisma.pillarSection.findMany({
    where: { categoryId: { in: categoryIds } },
    select: { id: true, code: true, name: true, categoryId: true, displayOrder: true },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
  });

  return sections.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    categoryCode: codeById.get(s.categoryId) ?? "",
    displayOrder: s.displayOrder,
  }));
}
