"use client";

import { useEffect, useState } from "react";

/**
 * Browser fallback for the magic link. On iOS/Android with the app installed,
 * the universal/app link opens the app directly and this page is never seen.
 * Otherwise we deep-link via the custom scheme and offer manual guidance.
 */
export function VerifyRedirect({ token }: { token: string | null }) {
  const [opened, setOpened] = useState(false);

  const deepLink = token ? `akilirisk://auth/verify?token=${encodeURIComponent(token)}` : null;

  useEffect(() => {
    if (!deepLink) return;
    setOpened(true);
    window.location.href = deepLink;
  }, [deepLink]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f0f1e",
        color: "#f5f5f7",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>AkiliRisk</h1>
        {token ? (
          <>
            <p style={{ color: "#a9a9c2", lineHeight: 1.6 }}>
              Opening the AkiliRisk app to finish signing in…
            </p>
            {deepLink ? (
              <a
                href={deepLink}
                style={{
                  display: "inline-block",
                  marginTop: 24,
                  background: "#10b981",
                  color: "#fff",
                  padding: "12px 28px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                Open the app
              </a>
            ) : null}
            <p style={{ color: "#6f6f8a", fontSize: 14, marginTop: 24, lineHeight: 1.6 }}>
              {opened
                ? "If nothing happened, open AkiliRisk and enter the 6-digit code from your email."
                : null}
            </p>
          </>
        ) : (
          <p style={{ color: "#a9a9c2", lineHeight: 1.6 }}>
            This sign-in link is missing its token. Open AkiliRisk and request a new link, or
            enter the 6-digit code from your email.
          </p>
        )}
      </div>
    </main>
  );
}
