/**
 * Aggregates mandatory (required=true) document requirements per client for
 * pipeline stage computation and metrics.
 */
export type MandatoryDocumentCounts = {
  /** Count of requirements where `required` is true */
  required: number;
  /** Subset of mandatory requirements that are fulfilled */
  fulfilled: number;
};

export function emptyMandatoryDocumentCounts(): MandatoryDocumentCounts {
  return { required: 0, fulfilled: 0 };
}

export function aggregateMandatoryDocumentCounts(
  rows: { clientId: string; required: boolean; fulfilled: boolean }[],
): Map<string, MandatoryDocumentCounts> {
  const byClient = new Map<string, MandatoryDocumentCounts>();

  for (const row of rows) {
    if (!row.required) continue;

    const slot = byClient.get(row.clientId) ?? emptyMandatoryDocumentCounts();
    slot.required += 1;
    if (row.fulfilled) {
      slot.fulfilled += 1;
    }
    byClient.set(row.clientId, slot);
  }

  return byClient;
}

export function hasUnfulfilledMandatoryDocuments(counts: MandatoryDocumentCounts): boolean {
  return counts.required > 0 && counts.fulfilled < counts.required;
}
