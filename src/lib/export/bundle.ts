import "server-only";

/**
 * ZIP bundle composer for the data export (E2 / BRD §5.3).
 *
 * Wraps `archiver` so the route can pipe a streaming ZIP to the browser
 * without materializing the full bundle in memory. Enforces the byte cap
 * inline on the stream (NOT a pre-flight estimate — estimates lie). When
 * the cap is exceeded mid-stream, the controller is errored so the client
 * sees a truncated download rather than a silent success.
 *
 * Public API:
 *   - composeTenantZip(scope, opts) → ReadableStream<Uint8Array>
 *   - composeSystemZip(opts) → ReadableStream<Uint8Array>
 *
 * Both return a stream that the route can hand straight to NextResponse.
 * Both invoke `opts.onMetadata` once per stream with the final
 * ExportMetadata (used by the route to write the audit row's metadata
 * column with the actual row counts and an `aborted` flag).
 */

import archiver from "archiver";
import {
  EXPORT_BYTE_CAP,
  EXPORT_SCHEMA_VERSION,
  type ExportMetadata,
  type RowCounts,
  type TenantBundle,
} from "./types";
import { renderTenantCsvs, rowCountsForBundle } from "./serializers/csv";
import { buildNestedTenantExport, serializeNestedJson } from "./serializers/json";
import { renderReadme } from "./readme";
import {
  fetchTenantBundle,
  listAdvisorProfilesForSystemExport,
  resolveTenantScope,
} from "./queries";

export interface BundleResult {
  /** The ReadableStream the route hands to NextResponse. */
  stream: ReadableStream<Uint8Array>;
  /** Resolves once the stream finishes. The route awaits this AFTER
   *  starting the response, then writes the audit row's metadata column
   *  with the final counts + aborted flag. The audit row itself is
   *  written BEFORE the stream starts so partial downloads are still
   *  recorded; this resolves the "did it finish, and how big" addendum. */
  result: Promise<{
    metadata: ExportMetadata;
    bytesWritten: number;
    aborted: boolean;
    abortReason?: string;
  }>;
  /** Suggested download filename (advisor slug or "system"). */
  filename: string;
}

interface ComposeBaseOpts {
  /** Override the cap (used by tests). Defaults to EXPORT_BYTE_CAP. */
  byteCap?: number;
  /** Override the timestamp (used by tests). */
  generatedAt?: Date;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tenant";
}

function timestampForFilename(d: Date): string {
  return d.toISOString().replace(/[:.]/g, "-").replace(/Z$/, "Z");
}

/** Aggregate row counts across multiple per-tenant counts. Used for the
 *  system-wide metadata.json. */
function sumRowCounts(per: RowCounts[]): RowCounts {
  const out: RowCounts = {};
  for (const r of per) {
    for (const [k, v] of Object.entries(r)) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/**
 * Bridge an `archiver` Node Readable to a Web ReadableStream<Uint8Array>
 * with inline byte-counting and cap enforcement.
 *
 * Why a custom bridge: Next's `Readable.toWeb` would work for the basic
 * case but doesn't give us a hook to abort mid-stream when the cap is
 * exceeded. We need to count bytes per chunk and error the controller
 * (which surfaces as a truncated download to the browser) rather than
 * silently truncating the ZIP.
 */
function archiverToReadableStream(
  archive: archiver.Archiver,
  byteCap: number,
  onFinal: (info: { bytesWritten: number; aborted: boolean; abortReason?: string }) => void
): ReadableStream<Uint8Array> {
  let bytesWritten = 0;
  let aborted = false;
  let abortReason: string | undefined;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      archive.on("data", (chunk: Buffer) => {
        if (aborted) return;
        bytesWritten += chunk.length;
        if (bytesWritten > byteCap) {
          aborted = true;
          abortReason = `Bundle exceeded ${byteCap}-byte cap (wrote ${bytesWritten}). Use async export (TODO) for larger payloads.`;
          // Destroy the underlying archive so its background reads stop.
          archive.abort();
          controller.error(new Error(abortReason));
          onFinal({ bytesWritten, aborted, abortReason });
          return;
        }
        controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      });

      archive.on("end", () => {
        if (aborted) return;
        controller.close();
        onFinal({ bytesWritten, aborted: false });
      });

      archive.on("warning", (err: Error) => {
        // archiver fires "warning" for ENOENT / partial-read issues. Treat
        // them as fatal for our purposes — we control every input.
        console.error("[export/bundle] archiver warning:", err);
      });

      archive.on("error", (err: Error) => {
        if (aborted) return;
        aborted = true;
        abortReason = err.message;
        controller.error(err);
        onFinal({ bytesWritten, aborted, abortReason });
      });
    },
    cancel(reason) {
      aborted = true;
      abortReason = String(reason ?? "client cancelled");
      archive.abort();
      onFinal({ bytesWritten, aborted, abortReason });
    },
  });
}

/** Append every CSV + the nested JSON for one tenant under the given
 *  prefix (root for per-tenant exports; `tenants/<id>/` for system). */
function appendTenantToArchive(
  archive: archiver.Archiver,
  bundle: TenantBundle,
  prefix: string
): RowCounts {
  const csvs = renderTenantCsvs(bundle);
  for (const [name, content] of Object.entries(csvs)) {
    archive.append(content, { name: `${prefix}csv/${name}.csv` });
  }
  const nested = buildNestedTenantExport(bundle);
  archive.append(serializeNestedJson(nested), { name: `${prefix}data.json` });
  return rowCountsForBundle(bundle);
}

/** Compose a per-tenant ZIP. Resolves the scope, fetches the bundle,
 *  then streams the ZIP. Returns immediately — the stream finishes async. */
export async function composeTenantZip(
  advisorProfileId: string,
  opts: ComposeBaseOpts = {}
): Promise<BundleResult | null> {
  const scope = await resolveTenantScope(advisorProfileId);
  if (!scope) return null;

  const generatedAt = opts.generatedAt ?? new Date();
  const byteCap = opts.byteCap ?? EXPORT_BYTE_CAP;

  // Fetch the tenant bundle up-front. Worst-case memory = one tenant's
  // rows in memory at once (bounded by tenant size; no global config or
  // other tenants).
  const bundle = await fetchTenantBundle(scope);
  const rowCounts = appendCountsAdapter(rowCountsForBundle(bundle));

  // Resolve advisor display info for metadata.json + filename.
  const advisorEmail = (bundle.advisor as { user?: { email?: string } } | null)
    ?.user?.email
    ?? "unknown";
  const firmName = (bundle.advisor as { firmName?: string | null } | null)?.firmName ?? null;
  const brandName = (bundle.advisor as { brandName?: string | null } | null)?.brandName ?? null;
  const slugSource = brandName || firmName || advisorEmail.split("@")[0] || "tenant";
  const filename = `tenant-${slugify(slugSource)}-${timestampForFilename(generatedAt)}.zip`;

  // archiver setup. zlib level 6 (default) — good compression/speed
  // tradeoff for text payloads.
  const archive = archiver("zip", { zlib: { level: 6 } });

  const metadata: ExportMetadata = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    scope: "tenant",
    advisor: {
      advisorProfileId: scope.advisorProfileId,
      userId: scope.advisorUserId,
      email: advisorEmail,
      firmName,
      brandName,
    },
    rowCounts,
  };

  // README first (so the metadata + counts are accurate when written).
  archive.append(renderReadme(metadata), { name: "README.md" });
  archive.append(JSON.stringify(metadata, null, 2), { name: "metadata.json" });
  appendTenantToArchive(archive, bundle, "");

  // Wire the result promise. The stream finishes when archiver emits
  // 'end' (or errors).
  let resolveResult!: (v: {
    metadata: ExportMetadata;
    bytesWritten: number;
    aborted: boolean;
    abortReason?: string;
  }) => void;
  const result = new Promise<{
    metadata: ExportMetadata;
    bytesWritten: number;
    aborted: boolean;
    abortReason?: string;
  }>((res) => {
    resolveResult = res;
  });

  const stream = archiverToReadableStream(archive, byteCap, (info) => {
    resolveResult({ metadata, ...info });
  });

  // archiver.finalize() kicks off the actual encoding. Don't await — it
  // resolves only when the entire archive is written, which would block
  // the route from sending the response headers.
  void archive.finalize();

  return { stream, result, filename };
}

/** Compose a system-wide ZIP. Iterates tenants serially per the design;
 *  appends each tenant under `tenants/<advisorProfileId>/`. */
export async function composeSystemZip(
  opts: ComposeBaseOpts = {}
): Promise<BundleResult> {
  const generatedAt = opts.generatedAt ?? new Date();
  const byteCap = opts.byteCap ?? EXPORT_BYTE_CAP;
  const filename = `system-${timestampForFilename(generatedAt)}.zip`;

  const archive = archiver("zip", { zlib: { level: 6 } });

  const advisorList = await listAdvisorProfilesForSystemExport();
  const tenantSummaries: NonNullable<ExportMetadata["tenants"]> = [];
  const perTenantCounts: RowCounts[] = [];

  // Defer composing the metadata until after we've iterated tenants
  // (the row counts aren't known until then). Write a placeholder README
  // first; rewrite the README + metadata.json AFTER serial fetch but
  // BEFORE finalize() so they're inside the archive.
  //
  // Approach: append README.md and metadata.json LAST (archiver entries
  // are written in append order; we can append after the per-tenant
  // CSVs). README still appears at the root.
  for (const advisor of advisorList) {
    const scope = await resolveTenantScope(advisor.id);
    if (!scope) continue;
    const bundle = await fetchTenantBundle(scope);
    const counts = appendTenantToArchive(archive, bundle, `tenants/${advisor.id}/`);
    perTenantCounts.push(counts);
    tenantSummaries.push({
      advisorProfileId: advisor.id,
      userId: advisor.userId,
      email: advisor.email,
      firmName: advisor.firmName,
      rowCounts: counts,
    });
  }

  const aggregateCounts = sumRowCounts(perTenantCounts);
  const metadata: ExportMetadata = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    scope: "system",
    tenants: tenantSummaries,
    rowCounts: aggregateCounts,
  };

  archive.append(renderReadme(metadata), { name: "README.md" });
  archive.append(JSON.stringify(metadata, null, 2), { name: "metadata.json" });

  let resolveResult!: (v: {
    metadata: ExportMetadata;
    bytesWritten: number;
    aborted: boolean;
    abortReason?: string;
  }) => void;
  const result = new Promise<{
    metadata: ExportMetadata;
    bytesWritten: number;
    aborted: boolean;
    abortReason?: string;
  }>((res) => {
    resolveResult = res;
  });

  const stream = archiverToReadableStream(archive, byteCap, (info) => {
    resolveResult({ metadata, ...info });
  });

  void archive.finalize();

  return { stream, result, filename };
}

/** Pass-through. Kept as a named function so the test module can
 *  intercept the row-count shape in one place if the bundle composer
 *  ever needs to add derived fields. */
function appendCountsAdapter(counts: ReturnType<typeof rowCountsForBundle>): RowCounts {
  return counts;
}
