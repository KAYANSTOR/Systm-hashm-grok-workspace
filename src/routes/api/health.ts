import { createFileRoute } from "@tanstack/react-router";
import { dbStatus } from "@/lib/db";

/**
 * مسار صحة النشر — يفحص حيوية الخادم وحالة قاعدة البيانات دون إسقاط الطلب.
 *
 * - `"neon"` / `"pglite"`: القاعدة مهيأة والاتصال يعمل.
 * - `"missing-config"`: التطبيق يعمل لكن `DATABASE_URL` غير مضبوطة —
 *   الواجهة تُحمَّل وكل عمليات البيانات تفشل برسالة الإعداد الواضحة.
 *   هذا يجعل سبب توقف النظام مرئيًا فورًا من المتصفح بدل 500 صامتة.
 *
 * GET /api/health → 200 دائمًا مع JSON تشخيصي (استعلام فعلي اختياري ?deep=1).
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const status = dbStatus();
        let database: "ok" | "unreachable" | "not-configured" =
          status === "neon" || status === "pglite" ? "ok" : "not-configured";

        if (database === "ok" && url.searchParams.get("deep") === "1") {
          try {
            const { getSql } = await import("@/lib/db");
            const sql = await getSql();
            await sql`select 1`;
          } catch {
            database = "unreachable";
          }
        }

        return new Response(
          JSON.stringify({
            status: "ok",
            database,
            dbSource: status,
            time: new Date().toISOString(),
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
