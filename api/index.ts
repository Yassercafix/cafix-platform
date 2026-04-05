/**
 * Vercel Serverless Function Entry Point
 *
 * This file is the single serverless function that handles all /api/* requests
 * on Vercel. It imports the Express app and adapts it for the serverless runtime.
 */
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth.js";
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";
import { handleStripeWebhook } from "../server/webhooks/stripe.js";
import { ensureTestUsers } from "../server/utils/ensureTestUsers.js";

console.log("[API] Starting serverless function initialization...");

const app = express();

// Diagnostic logging middleware
app.use((req, res, next) => {
  console.log(`[API HIT] ${req.method} ${req.url}`);
  next();
});

// Stripe webhook handler (must be before JSON parsing for signature verification)
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), (req, res, next) => {
  try {
    handleStripeWebhook(req, res);
  } catch (err) {
    console.error("[Stripe Webhook Error]", err);
    next(err);
  }
});

// Configure body parser with larger size limit for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// OAuth callback under /api/oauth/callback
try {
  registerOAuthRoutes(app);
} catch (err) {
  console.error("[OAuth Registration Error]", err);
}

// Create tRPC middleware once at startup
const trpcMiddleware = createExpressMiddleware({
  router: appRouter,
  createContext,
  onError: ({ error, path }) => {
    console.error(`[tRPC ERROR] path=${path}`, error);
  },
});

// tRPC API — mount at /api/trpc
// The Vercel rewrite /api/(.*) -> /api/index.ts means requests to /api/trpc
// will have their path preserved when they reach this handler.
app.use("/api/trpc", (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    trpcMiddleware(req, res, next);
  } catch (err: any) {
    console.error("[tRPC Middleware Error]", err);
    // Ensure we always return JSON, never crash the function
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "Server crashed",
        message: err?.message ?? "Unknown error",
      });
    }
  }
});

// Root-level error handler — MUST be registered AFTER all routes
// This catches any error passed via next(err) from route handlers
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[API CRITICAL ERROR]", err);
  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: "Server crashed",
      message: err?.message ?? "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

// Ensure test users exist (non-blocking, runs once per cold start)
// Wrapped in try-catch to prevent startup crash
ensureTestUsers().catch(err =>
  console.warn("[startup] ensureTestUsers failed (non-fatal):", err)
);

console.log("[API] Serverless function initialization complete.");

export default app;
