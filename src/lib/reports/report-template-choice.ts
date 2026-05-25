import type { ReportTemplate } from "@prisma/client";

/** UI-facing template choice. The DB enum value remains `BELVEDERE`. */
export type ReportTemplateUi = "AKILI" | "COBRANDED";

export function toReportTemplateUi(db: ReportTemplate): ReportTemplateUi {
  return db === "BELVEDERE" ? "AKILI" : db;
}

export function fromReportTemplateUi(ui: ReportTemplateUi): ReportTemplate {
  return ui === "AKILI" ? "BELVEDERE" : ui;
}
