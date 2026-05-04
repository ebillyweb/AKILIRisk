/**
 * Shared AWS credential resolver for S3 helper modules.
 *
 * Returns explicit `{ accessKeyId, secretAccessKey }` only when BOTH env vars
 * are present. Returning `undefined` lets `new S3Client({ credentials: undefined })`
 * fall through to the AWS SDK's default credential provider chain — which is
 * the right behavior on Vercel/ECS/EC2 where credentials come from an attached
 * IAM role rather than explicit env vars.
 *
 * Previous code used `process.env.AWS_ACCESS_KEY_ID!` and `process.env.AWS_SECRET_ACCESS_KEY!`,
 * which silently produced an `S3Client` with `accessKeyId: undefined` and then
 * failed deep inside the first request with a confusing error.
 */
export function resolveAwsCredentials():
  | { accessKeyId: string; secretAccessKey: string }
  | undefined {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (accessKeyId && secretAccessKey) {
    return { accessKeyId, secretAccessKey };
  }
  return undefined;
}
