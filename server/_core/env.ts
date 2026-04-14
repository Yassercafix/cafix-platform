// ENV variable validation — runs at module load time.
// Logs errors for any missing critical variables so they appear in Vercel logs.

if (!process.env.DATABASE_URL) {
  console.error("[ENV] CRITICAL: Missing DATABASE_URL — database will be unavailable");
}
if (!process.env.JWT_SECRET) {
  console.error("[ENV] CRITICAL: Missing JWT_SECRET — session signing will fail");
  // Don't throw here to avoid crashing the whole app on Vercel if some public routes (like QR) don't need it
}
if (!process.env.SUPABASE_URL) {
  console.warn("[ENV] WARNING: Missing SUPABASE_URL");
}
if (!process.env.SUPABASE_ANON_KEY) {
  console.warn("[ENV] WARNING: Missing SUPABASE_ANON_KEY");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("[ENV] WARNING: Missing SUPABASE_SERVICE_ROLE_KEY");
}
if (!process.env.VITE_APP_ID) {
  console.warn("[ENV] WARNING: Missing VITE_APP_ID");
}
if (!process.env.OAUTH_SERVER_URL) {
  console.warn("[ENV] WARNING: Missing OAUTH_SERVER_URL — OAuth login will be unavailable");
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
