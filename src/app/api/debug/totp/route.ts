import { NextRequest, NextResponse } from "next/server";
import { TOTP } from "@otplib/totp";
import { NobleCryptoPlugin } from "@otplib/plugin-crypto-noble";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";

/**
 * Debug endpoint to test TOTP generation and verification
 * POST with token to verify or no body to generate new secret
 *
 * Request body (optional):
 * {
 *   "secret": "base32-encoded-secret",
 *   "token": "6-digit-token"
 * }
 *
 * Response examples:
 * - Generate: { secret, token, qrUri }
 * - Verify: { valid, delta, message }
 */

// Initialize TOTP with the same config as production
const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
  issuer: "Belvedere",
  digits: 6,
  period: 30,
  algorithm: "sha1",
});

export async function POST(req: NextRequest) {
  // Production guard: this endpoint has no auth and logs raw secrets.
  // Keep it reachable in local/dev only; in production it 404s like any
  // unmapped route.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { secret, token } = body;

    // Mode 1: Generate new secret and token
    if (!secret && !token) {
      console.log("[DEBUG TOTP] Generating new secret and token");

      const newSecret = totp.generateSecret();
      console.log(`[DEBUG TOTP] Generated secret: ${newSecret}`);

      const newToken = await totp.generate({ secret: newSecret });
      console.log(`[DEBUG TOTP] Generated token: ${newToken}`);

      const qrUri = totp.toURI({
        secret: newSecret,
        label: "debug@example.com",
        issuer: "Belvedere",
      });

      return NextResponse.json({
        mode: "generate",
        secret: newSecret,
        token: newToken,
        qrUri,
        instructions: "Use this secret in your authenticator app. The token above should verify.",
      });
    }

    // Mode 2: Verify a token
    if (secret && token) {
      console.log(`[DEBUG TOTP] Verifying token: ${token} with secret: ${secret}`);

      const result = await totp.verify(token, {
        secret,
        epochTolerance: 60, // 60 seconds = ±2 periods (period is 30s)
      });

      console.log(`[DEBUG TOTP] Verification result:`, result);

      return NextResponse.json({
        mode: "verify",
        token,
        valid: result.valid,
        delta: result.valid ? (result as any).delta : undefined,
        epoch: result.valid ? (result as any).epoch : undefined,
        message: result.valid ? "Token is valid" : "Token is invalid",
        debugInfo: {
          secretLength: secret.length,
          tokenLength: token.length,
          algorithm: "sha1",
          digits: 6,
          period: 30,
          tolerance: "60 seconds (±2 periods of 30s)",
        },
      });
    }

    // Mode 3: Manual token generation for testing
    if (secret) {
      console.log(`[DEBUG TOTP] Generating token from secret: ${secret}`);

      const manualToken = await totp.generate({ secret });
      console.log(`[DEBUG TOTP] Generated token: ${manualToken}`);

      return NextResponse.json({
        mode: "generate-from-secret",
        secret,
        token: manualToken,
        instructions: "Use this token to verify the secret works",
      });
    }

    return NextResponse.json(
      { error: "Provide either (secret) or (secret + token)" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[DEBUG TOTP] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Production guard: see POST handler.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    endpoint: "/api/debug/totp",
    methods: {
      POST: {
        description: "Debug TOTP generation and verification",
        modes: {
          generate: {
            body: "{}",
            description: "Generate new secret and token for testing",
          },
          generateFromSecret: {
            body: '{"secret":"ABC123XYZ"}',
            description: "Generate a token from an existing secret",
          },
          verify: {
            body: '{"secret":"ABC123XYZ","token":"123456"}',
            description: "Verify a TOTP token against a secret",
          },
        },
      },
    },
    config: {
      algorithm: "sha1",
      digits: 6,
      period: 30,
      tolerance: "60 seconds (±2 periods of 30s)",
    },
    warning: "This endpoint is for debugging only. Remove before production.",
  });
}
