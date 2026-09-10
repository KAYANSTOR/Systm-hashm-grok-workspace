/**
 * Self-hosted Better Auth for THIS app (server-only).
 * PGlite paths remain untouched by this change.
 */
import { betterAuth } from "better-auth";
import { bearer, genericOAuth } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { emailAndPasswordEnabled } from "./email-password";
import { GATE_PROVIDER_ID, gateIdentitySessions } from "./gate-session.server";
import { APP_PROVIDERS } from "./providers";
import { pgliteDialect } from "./pglite-dialect";
import { APP_ISSUER_DEFAULT, PREVIEW_ALLOWED_HOSTS, PREVIEW_CLIENT_ID, PREVIEW_CLIENT_SECRET } from "./preview";

void ensureDbReady();
const globalAuthRef = globalThis as typeof globalThis & { __appAuthPreviewSecret__?: string };
function previewAuthSecret(): string {
  globalAuthRef.__appAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__appAuthPreviewSecret__;
}
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};
const authDisabled = env("VITE_AUTH_ENABLED") === "false";
const appIssuer = env("APP_AUTH_ISSUER") ?? APP_ISSUER_DEFAULT;
const appClientId = env("APP_CLIENT_ID") ?? PREVIEW_CLIENT_ID;
const appClientSecret = env("APP_AUTH_CLIENT_SECRET") ?? PREVIEW_CLIENT_SECRET;
export const authConfigured = !authDisabled && Boolean(appClientId && appClientSecret);
const explicitBaseURL = env("BETTER_AUTH_URL");
const previewAllowedHosts: string[] = [...PREVIEW_ALLOWED_HOSTS];
const LOCAL_DEV_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080"];
const baseURL = explicitBaseURL ?? {
  allowedHosts: [...previewAllowedHosts, "localhost", "127.0.0.1", "[::1]"],
  protocol: "auto" as const,
  fallback: "http://localhost:8080",
};

const trustedOrigins: string[] = [
  ...(explicitBaseURL ? [explicitBaseURL] : []),
  "https://systm-hashm-grok-workspace.vercel.app",
  "https://systm-hashm-grok-workspace-kayanonlain-7126s-projects.vercel.app",
  "https://systm-hashm-grok-workspace-git-main-kayanonlain-7126s-projects.vercel.app",
  "https://systm-hashm-grok.vercel.app",
  "https://systm-hashm-grok-kayanonlain-7126s-projects.vercel.app",
  "https://*.vercel.app",
  ...previewAllowedHosts,
  ...previewAllowedHosts.flatMap((host) => [`https://${host}`, `http://${host}`]),
  ...LOCAL_DEV_ORIGINS,
];

const databaseUrl = env("DATABASE_URL");
function normalizeSupabaseUrl(value: string | undefined): string | undefined {
  if (!value?.includes(".pooler.supabase.com")) return value;
  const separator = value.includes("?") ? "&" : "?";
  return value.replace(/([?&])sslmode=[^&]*/i, "$1sslmode=no-verify") + (value.includes("sslmode=") ? "" : `${separator}sslmode=no-verify`);
}
const issuerBase = appIssuer.replace(/\/+$/, "");
const appAuthorizationUrl = `${issuerBase}/api/auth/oauth2/authorize`;
const appTokenUrl = `${issuerBase}/api/auth/oauth2/token`;
const appUserInfoUrl = `${issuerBase}/api/auth/oauth2/userinfo`;
const isSupabasePooler = databaseUrl?.includes(".pooler.supabase.com") ?? false;
const database = databaseUrl
  ? new Pool({ connectionString: normalizeSupabaseUrl(databaseUrl), ...(isSupabasePooler ? { ssl: { rejectUnauthorized: false } } : {}) })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };
export const SESSION_TOKEN_COOKIE = "__Host-app-auth.session_token";
const appOAuthPlugin = authConfigured
  ? genericOAuth({
      config: APP_PROVIDERS.map(({ providerId, idp }) => ({
        providerId,
        clientId: appClientId as string,
        clientSecret: appClientSecret as string,
        authorizationUrl: appAuthorizationUrl,
        tokenUrl: appTokenUrl,
        userInfoUrl: appUserInfoUrl,
        scopes: ["openid", "profile", "email"],
        authorizationUrlParams: { idp, prompt: "login" },
      })),
    })
  : null;

export const auth = betterAuth({
  baseURL,
  secret: env("BETTER_AUTH_SECRET") ?? previewAuthSecret(),
  database,
  trustedOrigins,
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: [...APP_PROVIDERS.map((p) => p.providerId), GATE_PROVIDER_ID],
      requireLocalEmailVerified: false,
    },
  },
  // Sessions are remembered for a long device lifetime; updateAge refreshes activity.
  // A normal user leaves the session by explicitly signing out.
  session: {
    expiresIn: 60 * 60 * 24 * 3650,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 300 },
  },
  ...(emailAndPasswordEnabled ? { emailAndPassword: { enabled: true } } : {}),
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
    cookies: {
      session_token: { name: SESSION_TOKEN_COOKIE },
      session_data: { name: "__Host-app-auth.session_data" },
      account_data: { name: "__Host-app-auth.account_data" },
      dont_remember: { name: "__Host-app-auth.dont_remember" },
    },
  },
  plugins: [gateIdentitySessions(), ...(appOAuthPlugin ? [appOAuthPlugin] : []), bearer(), tanstackStartCookies()],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}
export { APP_PROVIDERS } from "./providers";
