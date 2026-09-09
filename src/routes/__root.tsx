import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { SignInButtons, SignInGate } from "@/lib/auth/gates";
import { AppShell } from "@/components/app-shell";
import { startCloudSync } from "@/lib/cloud-sync-bootstrap";
import appCss from "../styles.css?url";

const APP_NAME = "معمل هاشم";

function LoginScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-10" dir="rtl">
      <section className="card w-full max-w-md p-7 text-center shadow-xl">
        <img src="/icons/icon-192.png" alt="شعار معمل هاشم" className="mx-auto mb-5 size-24 rounded-3xl object-contain" />
        <h1 className="text-2xl font-black text-brand-dark">تسجيل الدخول إلى معمل هاشم</h1>
        <p className="mt-2 text-sm leading-7 text-muted">سجّل الدخول للوصول إلى البيانات المشتركة ومزامنة هذا الجهاز مع بقية الأجهزة.</p>
        <div className="mt-6 flex justify-center">
          <SignInButtons />
        </div>
        <p className="mt-5 text-xs text-muted">لا تستخدم بيانات Cloud SQL هنا. استخدم حساب الدخول الخاص بالتطبيق.</p>
      </section>
    </main>
  );
}

if (typeof window !== "undefined") {
  startCloudSync();
}

function RootDocument() {
  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    }
  }, []);

  return (
    <html lang="ar" dir="rtl" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>
          <SignInGate fallback={<LoginScreen />}>
            <AppShell>
              <Outlet />
            </AppShell>
          </SignInGate>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#1b7a76" },
      {
        name: "description",
        content: "نظام إدارة المبيعات والمخزن والصندوق لمعامل التطريز والخياطة",
      },
    ],
    links: [
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "apple-touch-icon", sizes: "512x512", href: "/icons/icon-512.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&display=swap",
      },
    ],
  }),
  component: RootDocument,
});
