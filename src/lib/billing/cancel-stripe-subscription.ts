import "server-only";

/**
 * Cancel a Stripe subscription immediately. Logs and swallows errors so DB
 * lifecycle commits are not rolled back when Stripe is unavailable.
 */
export async function cancelStripeSubscriptionBestEffort(
  stripeSubscriptionId: string | null | undefined
): Promise<void> {
  if (!stripeSubscriptionId?.trim()) return;
  try {
    const { getStripe } = await import("@/lib/stripe");
    await getStripe().subscriptions.cancel(stripeSubscriptionId);
  } catch (error) {
    console.error("Stripe subscription cancel failed", {
      stripeSubscriptionId,
      error,
    });
  }
}
