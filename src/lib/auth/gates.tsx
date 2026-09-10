import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Navigate, useNavigate } from "@tanstack/react-router";
import { authClient, authEnabled, signInWithPhone, signOut } from "./client";
import { hasGateSessionMarker } from "./gate-session-marker";
import { resolveSignInGateState } from "./sign-in-gate";
import { useCurrentUser, useCurrentUserState } from "./use-current-user";

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

export const SIGN_IN_PATH = "/login";

export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  return <Navigate to={to} />;
}

export function SignInGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user, isPending } = useCurrentUserState();
  const state = resolveSignInGateState({ isPending, hasUser: user !== null });
  if (state === "pending") return null;
  if (state === "signed_in") return <>{children}</>;
  return <>{fallback ?? <SignInButtons />}</>;
}

export function SignInButtons() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError("");
    if (!phone.trim() || password.length < 8) {
      setError("أدخل رقم الهاتف وكلمة المرور الصحيحة.");
      return;
    }
    setBusy(true);
    try {
      const result = await signInWithPhone(phone, password);
      if (result.error) throw new Error(result.error.message || "تعذر تسجيل الدخول");

      const session = await authClient.getSession();
      if (!session.data?.user) throw new Error("تم تسجيل الدخول لكن الجلسة لم تُثبت. أعد المحاولة.");
      await navigate({ to: "/" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذر تسجيل الدخول";
      if (/too short|password.*short/i.test(message)) {
        setError("كلمة المرور قصيرة. استخدم 8 أحرف على الأقل.");
      } else if (/invalid|credential|password|user/i.test(message)) {
        setError("رقم الهاتف أو كلمة المرور غير صحيحة.");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-3 text-right">
      <input
        className="input-field"
        type="tel"
        dir="ltr"
        inputMode="tel"
        autoComplete="tel"
        placeholder="رقم الهاتف"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        className="input-field"
        type="password"
        dir="ltr"
        autoComplete="current-password"
        placeholder="كلمة المرور (8 أحرف على الأقل)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="rounded-xl bg-bad/10 p-3 text-sm font-bold text-bad">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void submit()} className="btn-primary w-full">
        {busy ? "جارٍ التحقق…" : "تسجيل الدخول"}
      </button>
      <a href="/recovery" className="text-center text-sm font-bold text-brand underline underline-offset-4">
        استعادة الحساب وتغيير كلمة المرور
      </a>
    </div>
  );
}

export function UserButton() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  const gateSession = useSyncExternalStore(
    subscribeToNothing,
    hasGateSessionMarker,
    noGateSessionOnServer,
  );
  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Account";
  return (
    <div className="flex items-center gap-2">
      {user.profileImageUrl ? (
        <img src={user.profileImageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-sm font-medium">{label}</span>
      {authEnabled && !gateSession && (
        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut().catch(() => setSigningOut(false));
          }}
          className="cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      )}
    </div>
  );
}
