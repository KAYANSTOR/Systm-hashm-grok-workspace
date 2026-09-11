import { createHash, randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { recoveryDiagnostic, resolveCanonicalAuthIdentity } from "@/lib/auth/identity.server";

const INVALID_TOKEN_MESSAGE = "رمز الاستعادة غير صالح أو منتهي";
const GENERIC_RECOVERY_MESSAGE = "تعذر إكمال الاستعادة";

export const Route = createFileRoute("/api/recovery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            token?: unknown;
            phone?: unknown;
            password?: unknown;
          };
          const token = String(body.token ?? "").trim();
          const password = String(body.password ?? "");
          if (!token || !body.phone || password.length < 8) {
            return Response.json({ error: "بيانات الاستعادة غير مكتملة" }, { status: 400 });
          }

          const tokenHash = createHash("sha256").update(token).digest("hex");
          const passwordHash = await hashPassword(password);
          const sql = await getSql();
          const recoveryId = randomUUID();
          const result = await sql.transaction(async (tx) => {
            const tokenRows = await tx.query<{ id: string }>(
              `select id
                 from account_recovery_tokens
                where token_hash = $1
                  and used_at is null
                  and expires_at > now()
                for update`,
              [tokenHash],
            );
            if (!tokenRows.length) return { kind: "invalid_token" as const };

            const identity = await resolveCanonicalAuthIdentity(tx, body.phone);
            if (identity.status !== "resolved") {
              return { kind: "identity" as const, diagnostic: recoveryDiagnostic(identity) };
            }

            const updatedAccounts = await tx.query<{ id: string }>(
              `update "account"
                  set "password" = $1, "updatedAt" = now()
                where "id" = $2
                  and "userId" = $3
                  and "providerId" = 'credential'
                returning "id"`,
              [passwordHash, identity.accountId, identity.userId],
            );
            if (!updatedAccounts.length) return { kind: "credential_missing" as const };

            await tx.query(`delete from "session" where "userId" = $1`, [identity.userId]);
            await tx.query(
              `update account_recovery_tokens
                  set used_at = now()
                where id = $1
                  and used_at is null`,
              [tokenRows[0].id],
            );
            await tx.query(
              `insert into audit_events
                (audit_id, org_id, user_id, operation_id, entity_type, entity_id, action, metadata)
               values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
              [
                recoveryId,
                identity.organizationId,
                identity.userId,
                recoveryId,
                "auth",
                identity.employeeId,
                "emergency_password_recovery",
                JSON.stringify({
                  context: "emergency_recovery",
                  credentialProvider: "credential",
                  phoneIdentity: identity.phone,
                }),
              ],
            );
            return { kind: "success" as const };
          });

          if (result.kind === "invalid_token") {
            return Response.json({ error: INVALID_TOKEN_MESSAGE }, { status: 401 });
          }
          if (result.kind === "identity") {
            // Keep account existence and repair state private while leaving a
            // searchable server diagnostic for administrators.
            console.warn(`[recovery] identity resolution: ${result.diagnostic}`);
            const status = result.diagnostic === "no_identity" ? 404 : 409;
            return Response.json({ error: GENERIC_RECOVERY_MESSAGE }, { status });
          }
          if (result.kind === "credential_missing") {
            console.warn("[recovery] credential account missing for resolved identity");
            return Response.json({ error: GENERIC_RECOVERY_MESSAGE }, { status: 409 });
          }

          return Response.json({ ok: true, recoveryId });
        } catch (error) {
          console.error("[recovery] failed", error);
          return Response.json({ error: "تعذر تنفيذ الاستعادة" }, { status: 500 });
        }
      },
    },
  },
});
