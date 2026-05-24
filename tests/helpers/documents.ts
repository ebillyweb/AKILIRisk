import type { APIRequestContext } from "@playwright/test";

/** 1×1 PNG — valid magic bytes for MIME validation. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export const DOCUMENT_S3_SKIP_REASON =
  "S3 document E2E requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME on the test runner and target app (see .env.example).";

export function isDocumentS3Configured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID?.trim() &&
      process.env.AWS_SECRET_ACCESS_KEY?.trim() &&
      process.env.S3_BUCKET_NAME?.trim(),
  );
}

export interface ClientDocumentFixture {
  requirementId: string;
  clientId: string;
}

export async function uploadDocumentViaPresignedFlow(
  request: APIRequestContext,
  cookies: string,
  fixture: ClientDocumentFixture,
): Promise<{ fulfilled: boolean; fileKey: string }> {
  const uploadUrlRes = await request.post("/api/documents/upload-url", {
    headers: { cookie: cookies },
    data: {
      requirementId: fixture.requirementId,
      fileName: "e2e-smoke.png",
      fileType: "image/png",
      fileSize: TINY_PNG.length,
    },
  });
  if (!uploadUrlRes.ok()) {
    throw new Error(
      `upload-url failed: ${uploadUrlRes.status()} ${await uploadUrlRes.text()}`,
    );
  }

  const { signedUrl, key, contentType } = (await uploadUrlRes.json()) as {
    signedUrl: string;
    key: string;
    contentType: string;
  };

  const putRes = await request.fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    data: TINY_PNG,
  });
  if (!putRes.ok()) {
    throw new Error(`S3 PUT failed: ${putRes.status()} ${await putRes.text()}`);
  }

  const confirmRes = await request.post("/api/documents/confirm", {
    headers: { cookie: cookies },
    data: {
      requirementId: fixture.requirementId,
      key,
      fileName: "e2e-smoke.png",
    },
  });
  if (!confirmRes.ok()) {
    throw new Error(
      `confirm failed: ${confirmRes.status()} ${await confirmRes.text()}`,
    );
  }

  const body = (await confirmRes.json()) as { fulfilled: boolean; fileKey: string };
  return { fulfilled: body.fulfilled, fileKey: body.fileKey };
}
