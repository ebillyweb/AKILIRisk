import { NextResponse } from "next/server";

export const dynamic = "force-static";

/**
 * Android Asset Links — lets Android verify and open `https://<host>/auth/*`
 * links in the app (the app.json intentFilter uses autoVerify).
 *
 * Set ANDROID_SHA256_CERT_FINGERPRINTS to a comma-separated list of the signing
 * certificate SHA-256 fingerprints (from EAS / Play App Signing) once the Play
 * account and signing key are provisioned (plan §13 open item).
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS || "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.ebilly.akilirisk",
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return NextResponse.json(body, {
    headers: { "content-type": "application/json" },
  });
}
