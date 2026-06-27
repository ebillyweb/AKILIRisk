/**
 * Asset-agnostic types for the Platform Asset Catalog inheritance engine.
 * Recommendations are the first consumer; future asset types adopt the same framework.
 *
 * @see D-09, D-10 in 22-CONTEXT.md
 */

/** Three-tier override policy governing what downstream layers can customize. */
export type OverrideTier = "PROTECTED" | "CONFIGURABLE" | "ADDITION";

/** Per-field override policy declaration. */
export type FieldOverridePolicy = {
  field: string;
  tier: OverrideTier;
};

/**
 * Three-layer asset input for composition.
 * Platform is required; enterprise and advisor overlays are optional sparse objects.
 */
export type AssetLayer<T> = {
  platform: T;
  enterprise?: Partial<T> | null;
  advisor?: Partial<T> | null;
};

/** Source attribution for each field in the composed result. */
export type SourceLayer = "PLATFORM" | "ENTERPRISE" | "ADVISOR";

/**
 * Composed asset: the fully-resolved T with source attribution per field.
 * sourceAttribution records which layer provided each field's final value.
 */
export type ComposedAsset<T> = T & {
  sourceAttribution: Record<string, SourceLayer>;
};
