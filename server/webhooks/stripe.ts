import { Request, Response } from "express";
import Stripe from "stripe";
import { getDb } from "../db.js";
import { cafeterias } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";

// Lazy-initialize Stripe to prevent startup crashes if the key is missing or invalid
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

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

/**
 * Plan hierarchy for forward-only upgrade enforcement.
 * A higher index means a higher-tier plan.
 */
const PLAN_RANK: Record<string, number> = {
  starter: 0,
  growth: 1,
  pro: 2,
};

/**
 * Returns true if `incoming` plan is strictly higher than `current` plan.
 * Prevents accidental downgrades via webhook replay or misconfiguration.
 */
function isUpgrade(current: string, incoming: string): boolean {
  const currentRank = PLAN_RANK[current] ?? 0;
  const incomingRank = PLAN_RANK[incoming] ?? 0;
  return incomingRank > currentRank;
}

/**
 * Stripe Webhook Handler — Production-Hardened
 */
export async function handleStripeWebhook(req: Request, res: Response) {
  console.log("[BILLING] [Stripe Webhook] Received event");

  // ── Signature verification ────────────────────────────────────────────────
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    console.warn("[BILLING] [Stripe Webhook] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[BILLING] [Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  if (!stripe) {
    console.error("[BILLING] [Stripe Webhook] Stripe client not initialized");
    return res.status(500).json({ error: "Stripe client not initialized" });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // Must be raw body — express.raw() is applied at route level
      sig as string,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[BILLING] [Stripe Webhook] Signature verification failed:", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  console.log(`[BILLING] [Stripe Webhook] Event verified: type=${event.type} id=${event.id}`);

  // ── Event dispatch ────────────────────────────────────────────────────────
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // ── Metadata validation ───────────────────────────────────────────────
      const cafeteriaId = session.metadata?.cafeteriaId;
      const plan = session.metadata?.plan as string | undefined;

      if (!cafeteriaId || !plan) {
        console.error(
          "[BILLING] [Stripe Webhook] Missing metadata — cafeteriaId or plan absent",
          { sessionId: session.id, cafeteriaId, plan }
        );
        return res.status(200).json({ received: true, skipped: "missing_metadata" });
      }

      if (!["growth", "pro"].includes(plan)) {
        console.error("[BILLING] [Stripe Webhook] Invalid plan value in metadata", {
          sessionId: session.id,
          plan,
        });
        return res.status(200).json({ received: true, skipped: "invalid_plan" });
      }

      // ── Database access ───────────────────────────────────────────────────
      const db = await getDb();
      if (!db) {
        console.error("[BILLING] [Stripe Webhook] Database not available");
        return res.status(500).json({ error: "Database error" });
      }

      // Fetch current plan for idempotency + forward-only check
      const rows = await db
        .select({ subscriptionPlan: cafeterias.subscriptionPlan })
        .from(cafeterias)
        .where(eq(cafeterias.id, cafeteriaId))
        .limit(1);

      if (rows.length === 0) {
        console.error("[BILLING] [Stripe Webhook] Cafeteria not found", { cafeteriaId });
        return res.status(200).json({ received: true, skipped: "cafeteria_not_found" });
      }

      const currentPlan = rows[0].subscriptionPlan ?? "starter";

      // ── Idempotency guard ─────────────────────────────────────────────────
      if (currentPlan === plan) {
        console.log(
          `[BILLING] [Stripe Webhook] Idempotency: cafeteria ${cafeteriaId} already on plan '${plan}' — skipping update`
        );
        return res.status(200).json({ received: true, skipped: "already_active" });
      }

      // ── Forward-only guard ────────────────────────────────────────────────
      if (!isUpgrade(currentPlan, plan)) {
        console.warn(
          `[BILLING] [Stripe Webhook] Downgrade blocked: cafeteria ${cafeteriaId} is on '${currentPlan}', refusing to set '${plan}'`
        );
        return res.status(200).json({ received: true, skipped: "downgrade_blocked" });
      }

      // ── Apply upgrade ─────────────────────────────────────────────────────
      try {
        await db
          .update(cafeterias)
          .set({
            subscriptionPlan: plan,
            subscriptionStatus: "active",
          })
          .where(eq(cafeterias.id, cafeteriaId));

        console.log(
          `[BILLING] [Stripe Webhook] Processed: cafeteria ${cafeteriaId} upgraded ${currentPlan} → ${plan}`
        );
        return res.status(200).json({ received: true });
      } catch (dbError) {
        console.error("[BILLING] [Stripe Webhook] Database update failed:", dbError);
        return res.status(500).json({ error: "Database update failed" });
      }
    }

    // Acknowledge all other event types without processing
    console.log(`[BILLING] [Stripe Webhook] Unhandled event type '${event.type}' — acknowledged`);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[BILLING] [Stripe Webhook] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
