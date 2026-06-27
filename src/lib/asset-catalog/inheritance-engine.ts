/**
 * Generic asset composition engine with three-tier override policy enforcement.
 *
 * Composes Platform -> Enterprise -> Advisor layers respecting:
 * - PROTECTED: always use platform value, ignore overlays
 * - CONFIGURABLE: last-writer-wins (advisor > enterprise > platform)
 * - ADDITION: concatenate arrays from all layers
 *
 * Pure logic -- no "server-only" import, usable in tests and client code.
 *
 * @see D-09, D-10, D-11 in 22-CONTEXT.md
 */

import type {
  AssetLayer,
  ComposedAsset,
  FieldOverridePolicy,
  OverrideTier,
  SourceLayer,
} from "./types";

// ---------------------------------------------------------------------------
// Policy lookup helper
// ---------------------------------------------------------------------------

function buildPolicyMap(
  policies: FieldOverridePolicy[]
): Map<string, OverrideTier> {
  const map = new Map<string, OverrideTier>();
  for (const p of policies) {
    map.set(p.field, p.tier);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Core composition
// ---------------------------------------------------------------------------

/**
 * Compose a final asset from three layers, enforcing per-field override policies.
 *
 * Fields not listed in policies default to CONFIGURABLE behavior.
 *
 * For ADDITION fields, the platform value must be an array. Enterprise and advisor
 * values are concatenated onto the platform array in layer order.
 */
export function composeAsset<T extends Record<string, unknown>>(
  layers: AssetLayer<T>,
  policies: FieldOverridePolicy[]
): ComposedAsset<T> {
  const policyMap = buildPolicyMap(policies);
  const result: Record<string, unknown> = {};
  const sourceAttribution: Record<string, SourceLayer> = {};

  const platformKeys = Object.keys(layers.platform);
  const enterpriseKeys = layers.enterprise
    ? Object.keys(layers.enterprise)
    : [];
  const advisorKeys = layers.advisor ? Object.keys(layers.advisor) : [];

  // Collect all unique field names (platform + any ADDITION-only overlay keys)
  const allKeys = new Set([
    ...platformKeys,
    ...enterpriseKeys,
    ...advisorKeys,
  ]);

  for (const key of allKeys) {
    const tier = policyMap.get(key) ?? "CONFIGURABLE";
    const platformValue = (layers.platform as Record<string, unknown>)[key];
    const enterpriseValue =
      layers.enterprise != null
        ? (layers.enterprise as Record<string, unknown>)[key]
        : undefined;
    const advisorValue =
      layers.advisor != null
        ? (layers.advisor as Record<string, unknown>)[key]
        : undefined;

    switch (tier) {
      case "PROTECTED": {
        // Always use platform value, ignore overlays
        result[key] = platformValue;
        sourceAttribution[key] = "PLATFORM";
        break;
      }

      case "CONFIGURABLE": {
        // Last-writer-wins: advisor > enterprise > platform
        if (advisorValue !== undefined && advisorValue !== null) {
          result[key] = advisorValue;
          sourceAttribution[key] = "ADVISOR";
        } else if (
          enterpriseValue !== undefined &&
          enterpriseValue !== null
        ) {
          result[key] = enterpriseValue;
          sourceAttribution[key] = "ENTERPRISE";
        } else {
          result[key] = platformValue;
          sourceAttribution[key] = "PLATFORM";
        }
        break;
      }

      case "ADDITION": {
        // Concatenate arrays from all layers
        const base = Array.isArray(platformValue) ? [...platformValue] : [];
        if (Array.isArray(enterpriseValue)) {
          base.push(...enterpriseValue);
        }
        if (Array.isArray(advisorValue)) {
          base.push(...advisorValue);
        }
        result[key] = base;

        // Attribution: mark as the highest layer that contributed
        if (Array.isArray(advisorValue) && advisorValue.length > 0) {
          sourceAttribution[key] = "ADVISOR";
        } else if (
          Array.isArray(enterpriseValue) &&
          enterpriseValue.length > 0
        ) {
          sourceAttribution[key] = "ENTERPRISE";
        } else {
          sourceAttribution[key] = "PLATFORM";
        }
        break;
      }
    }
  }

  result["sourceAttribution"] = sourceAttribution;
  return result as ComposedAsset<T>;
}

// ---------------------------------------------------------------------------
// Overlay validation
// ---------------------------------------------------------------------------

/**
 * Validate an overlay payload before persisting. Rejects writes to PROTECTED fields.
 *
 * Returns an object with allowed and rejected field names.
 * Callers should abort the mutation if rejected is non-empty (T-22-01 mitigation).
 */
export function validateOverlayPayload(
  fields: string[],
  policies: FieldOverridePolicy[]
): { allowed: string[]; rejected: string[] } {
  const policyMap = buildPolicyMap(policies);
  const allowed: string[] = [];
  const rejected: string[] = [];

  for (const field of fields) {
    const tier = policyMap.get(field);
    if (tier === "PROTECTED") {
      rejected.push(field);
    } else {
      allowed.push(field);
    }
  }

  return { allowed, rejected };
}
