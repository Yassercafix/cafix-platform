import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth.js";
import { appRouter } from "../routers.js";
import { createContextSupabase as createContext } from "./context-supabase.js";
import { serveStatic, setupVite } from "./vite.js";
import { handleStripeWebhook } from "../webhooks/stripe.js";
import { ensureTestUsers } from "../utils/ensureTestUsers.js";

const app = express();

// Stripe webhook handler (must be before JSON parsing for signature verification)
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

// Configure body parser with larger size limit for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// OAuth callback under /api/oauth/callback
try {
  registerOAuthRoutes(app);
} catch (err) {
  console.error("[OAuth Registration Error]", err);
}

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// development mode uses Vite, production mode uses static files
if (process.env.NODE_ENV === "development") {
  // setupVite is async, but in Vercel we don't use it
} else {
  serveStatic(app);
}

// Root-level error handler — MUST be registered AFTER all routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[SERVER CRITICAL ERROR]", err);
  res.status(500).json({
    success: false,
    error: "Internal Server Error",
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// Export the app for Vercel
export default app;

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const server = createServer(app);

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Ensure required test/seed users exist in the database (non-blocking)
  ensureTestUsers().catch(err =>
    console.warn("[startup] ensureTestUsers failed (non-fatal):", err)
  );
}

// Only start the server if we're NOT in a serverless (Vercel) environment
if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
  startServer().catch(console.error);
}
