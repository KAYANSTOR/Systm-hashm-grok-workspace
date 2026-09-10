import { createHash, randomUUID } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { hashPassword } from "better-auth/crypto";
import { getSql } from "@/lib/db";
import { normalizePhone } from "@/lib/auth/phone";

export const Route = createFileRoute("/api/recovery")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as { token?: string; phone?: string; password?: string };
          const token = String(body.token || "").trim();
          const phone = normalizePhone(body.phone);
          const password = String(body.password || "");
          if (!token || !phone || password.length < 8) {
            return Response.json({ error: "بيانات الاستعادة غير مكتملة" }, { status: 400 });
          }
          const sql = await getSql();
          const tokenHash = createHash("sha256").update(token).digest("hex");
          const tokenRows = await sql`
            select id from account_recovery_tokens
            where token_hash=${tokenHash} and used_at is null and expires_at > now()
            limit 1
          `;
          if (!tokenRows.length) return Response.json({ error: "رمز الاستعادة غير صالح أو منتهي" }, { status: 401 });
          const users = await sql`
            select eu.user_id
            from employee_users eu join employees e on e.id=eu.employee_id
            where e.organization_id='default_org' and e.is_active=true and eu.is_active=true and e.phone=${phone}
            limit 1
          `;
          if (!users.length) return Response.json({ error: "لا يوجد حساب فعال بهذا الرقم" }, { status: 404 });
          const passwordHash = await hashPassword(password);
          await sql.transaction(async (tx) => {
            await tx`
              update "account" set "password"=${passwordHash}, "updatedAt"=now()
              where "userId"=${String(users[0].user_id)} and "providerId"='credential'
            `;
            await tx`update account_recovery_tokens set used_at=now() where id=${String(tokenRows[0].id)} and used_at is null`;
          });
          return Response.json({ ok: true, recoveryId: randomUUID() });
        } catch (error) {
          console.error("[recovery] failed", error);
          return Response.json({ error: "تعذر تنفيذ الاستعادة" }, { status: 500 });
        }
      },
    },
  },
});
