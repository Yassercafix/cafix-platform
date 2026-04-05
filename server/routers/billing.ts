import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc.js";
import Stripe from "stripe";

// Initialize Stripe with API key from environment
let stripe: Stripe | null = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover" as any,
    });
    console.log("[BILLING] [Stripe] Client initialized");
  } else {
    console.warn("[BILLING] [Stripe] STRIPE_SECRET_KEY is not set — Stripe functionality will be disabled");
  }
} catch (err) {
  console.error("[BILLING] [Stripe] Failed to initialize Stripe client:", err);
}

// Map plan names to Stripe price IDs (test mode)
const STRIPE_PRICE_IDS: Record<"growth" | "pro", string> = {
  growth: process.env.STRIPE_PRICE_ID_GROWTH || "price_growth_test",
  pro: process.env.STRIPE_PRICE_ID_PRO || "price_pro_test",
};

export const billingRouter = router({
  /**
   * Creates a Stripe Checkout session for upgrading to a plan.
   *
   * Input:
   *   - plan: "growth" | "pro"
   *
   * Returns:
   *   - url: The Stripe Checkout URL to redirect the user to
   *
   * The session includes:
   *   - cafeteriaId in metadata for webhook processing
   *   - success_url pointing to /upgrade/success
   *   - cancel_url pointing to /upgrade
   */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        plan: z.enum(["growth", "pro"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Ensure user is authenticated and has a cafeteriaId
      if (!(ctx.user as any)?.cafeteriaId) {
        throw new Error("User must have an associated cafeteria");
      }

      if (!stripe) {
        throw new Error("Stripe is not configured on this server");
      }

      const priceId = STRIPE_PRICE_IDS[input.plan];
      if (!priceId) {
        throw new Error(`Invalid plan: ${input.plan}`);
      }

      try {
        // Create a Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          payment_method_types: ["card"],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          // Include cafeteriaId in metadata for webhook processing
          metadata: {
            cafeteriaId: (ctx.user as any).cafeteriaId,
            plan: input.plan,
          },
          // Redirect URLs
          success_url: `${process.env.APP_URL || "http://localhost:5173"}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.APP_URL || "http://localhost:5173"}/upgrade/cancel`,
        });

        if (!session.url) {
          throw new Error("Failed to generate Stripe Checkout URL");
        }

        return {
          url: session.url,
        };
      } catch (error) {
        console.error("[BILLING] Stripe checkout session creation error:", error);
        throw new Error("Failed to create checkout session");
      }
    }),
});
