import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromRequest } from "@/lib/request-ip";

/**
 * Address suggestions via OpenStreetMap Nominatim (no API key).
 * Use a descriptive User-Agent per Nominatim usage policy.
 *
 * Gated by:
 *   - `auth()` — only signed-in users can hit it (the sole consumer is
 *     `<AddressSearch />` in the post-auth settings UI), and Nominatim's
 *     1-req/sec usage policy would otherwise let anonymous internet
 *     callers get our User-Agent banned.
 *   - `rateLimit` per client IP: 20 requests / minute. Matches the
 *     in-memory limiter shape used by /api/auth/* (per-instance counters,
 *     best-effort across Vercel's serverless fanout).
 */
type AddressSuggestion = {
  displayName: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function parseNominatimAddress(addr: Record<string, string>): Omit<AddressSuggestion, "displayName"> {
  const road = addr.road ?? "";
  const house = addr.house_number ?? "";
  const addressLine1 =
    [house, road].filter(Boolean).join(" ").trim() ||
    (addr.suburb ?? addr.village ?? "");
  return {
    addressLine1: addressLine1.slice(0, 120),
    city: (addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "").slice(0, 80),
    state: (addr.state ?? addr.county ?? "").slice(0, 50),
    postalCode: (addr.postcode ?? "").slice(0, 20),
    country: (addr.country ?? "").slice(0, 80),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const ip = clientIpFromRequest(req) ?? "unknown";
  const rl = rateLimit({
    key: `address-suggestions:${ip}`,
    limit: 20,
    windowMs: 60 * 1000,
  });
  if (!rl.success) {
    return NextResponse.json(
      {
        error: "Too many requests. Please slow down.",
        resetAt: new Date(rl.resetAt).toISOString(),
      },
      { status: 429 }
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json([]);
  }
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "8");
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "AkiliRisk/1.0 (address-completion)",
      },
    });
    if (!res.ok) return NextResponse.json([]);
    const data = (await res.json()) as Array<{
      display_name?: string;
      address?: Record<string, string>;
    }>;
    const out: AddressSuggestion[] = data
      .filter((item) => item.address)
      .map((item) => ({
        displayName: item.display_name ?? "",
        ...parseNominatimAddress(item.address!),
      }))
      .filter((s) => s.displayName);
    return NextResponse.json(out);
  } catch {
    return NextResponse.json([]);
  }
}
