import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type TierPricingConfigAlertProps = {
  errors: string[];
};

export function TierPricingConfigAlert({ errors }: TierPricingConfigAlertProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
      <AlertTriangle className="size-4" aria-hidden />
      <AlertTitle>Pricing configuration error</AlertTitle>
      <AlertDescription>
        <p className="leading-relaxed">
          Stripe tier prices are misconfigured in this environment. Checkout and displayed
          prices may be wrong until each tier has its own{" "}
          <code className="rounded bg-destructive/10 px-1 py-0.5 text-xs">STRIPE_PRICE_*</code>{" "}
          variable. Legacy env fallbacks are disabled.
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
