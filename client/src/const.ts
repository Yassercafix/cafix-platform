export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Generate login URL at runtime so redirect URI reflects the current origin.
 * This function is guaranteed never to throw. If configuration is missing or invalid,
 * it returns a safe fallback ("/") to prevent application crashes.
 */
export const getLoginUrl = (): string => {
  try {
    const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
    const appId = import.meta.env.VITE_APP_ID;

    if (!oauthPortalUrl || typeof oauthPortalUrl !== "string") {
      console.error("VITE_OAUTH_PORTAL_URL is missing or invalid");
      return "/";
    }

    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    // Ensure the base URL is valid before appending paths
    const base = oauthPortalUrl.endsWith("/")
      ? oauthPortalUrl.slice(0, -1)
      : oauthPortalUrl;

    const url = new URL(`${base}/app-auth`);
    url.searchParams.set("appId", appId || "");
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  } catch (error) {
    console.error("Failed to generate login URL:", error);
    return "/";
  }
};
