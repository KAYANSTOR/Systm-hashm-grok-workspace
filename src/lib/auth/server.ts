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
import { ensureDbReady, getPglite, getSql } from "../db";
import { emailAndPasswordEnabled } from "./email-password";
import { GATE_PROVIDER_ID, gateIdentitySessions } from "./gate-session.server";
import { APP_PROVIDERS } from "./providers";
import { pgliteDialect } from "./pglite-dialect";
import {
  APP_ISSUER_DEFAULT,
  PREVIEW_ALLOWED_HOSTS,
  PREVIEW_CLIENT_ID,
  PREVIEW_CLIENT_SECRET,
} from "./preview";
import { resolveCanonicalAuthIdentity } from "./identity.server";
import { createAuthMiddleware } from "@better-auth/core/api";

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
const appClientId = env("APP_AUTH_CLIENT_ID") ?? PREVIEW_CLIENT_ID;
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
  return (
    value.replace(/([?&])sslmode=[^&]*/i, "$1sslmode=no-verify") +
    (value.includes("sslmode=") ? "" : `${separator}sslmode=no-verify`)
  );
}
const issuerBase = appIssuer.replace(/\/+$/, "");
const appAuthorizationUrl = `${issuerBase}/api/auth/oauth2/authorize`;
const appTokenUrl = `${issuerBase}/api/auth/oauth2/token`;
const appUserInfoUrl = `${issuerBase}/api/auth/oauth2/userinfo`;
const isSupabasePooler = databaseUrl?.includes(".pooler.supabase.com") ?? false;
const hasCloudSql = Boolean(
  env("SQL_HOST") && env("SQL_USER") && env("SQL_PASSWORD") && env("SQL_DB_NAME"),
);
const productionRuntime =
  process.env.VERCEL_ENV === "production" ||
  process.env.APP_RUNTIME === "production" ||
  process.env.NODE_ENV === "production";
if (productionRuntime && !databaseUrl && !hasCloudSql && !explicitPgliteFallback()) {
  throw new Error(
    "Production Better Auth requires DATABASE_URL or the configured SQL_* cloud database variables; refusing PGLite fallback.",
  );
}
const database = databaseUrl
  ? new Pool({
      connectionString: normalizeSupabaseUrl(databaseUrl),
      ...(isSupabasePooler ? { ssl: { rejectUnauthorized: false } } : {}),
    })
  : hasCloudSql
    ? new Pool({
        host: env("SQL_HOST"),
        user: env("SQL_USER"),
        password: env("SQL_PASSWORD"),
        database: env("SQL_DB_NAME"),
      })
    : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

function explicitPgliteFallback(): boolean {
  return process.env.ALLOW_PGLITE_FALLBACK === "true";
}
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
const phoneIdentityPlugin = {
  id: "phone-identity",
  hooks: {
    before: [
      {
        matcher: (ctx: { path?: string }) => ctx.path === "/sign-in/email",
        handler: createAuthMiddleware(async (ctx) => {
          const body = ctx.body as { email?: unknown };
          const email = typeof body.email === "string" ? body.email : "";
          if (!email.startsWith("phone-") || !email.endsWith("@accounts.hashem.local")) return;
          const phone = email.slice("phone-".length, -"@accounts.hashem.local".length);
          try {
            const identity = await resolveCanonicalAuthIdentity(await getSql(), phone);
            if (identity.status === "resolved") {
              body.email = identity.userEmail;
            }
          } catch (error) {
            // Better Auth remains the credential authority. A transient schema
            // or database-read failure must not turn a canonical login into a
            // 500; Better Auth will still validate the submitted credentials.
            console.error("[auth] canonical identity lookup failed before sign-in", error);
          }
        }),
      },
    ],
  },
};

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
  plugins: [
    gateIdentitySessions(),
    phoneIdentityPlugin,
    ...(appOAuthPlugin ? [appOAuthPlugin] : []),
    bearer(),
    tanstackStartCookies(),
  ],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}
export { APP_PROVIDERS } from "./providers";
