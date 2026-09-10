import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/recovery")({ component: RecoveryPage });

function RecoveryPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setMessage("");
    if (!token.trim() || !phone.trim() || password.length < 8) {
      setMessage("أدخل رمز الاستعادة ورقم الهاتف وكلمة مرور من 8 أحرف على الأقل.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/recovery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, phone, password }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "تعذر تنفيذ الاستعادة");
      setMessage("تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.");
      setTimeout(() => void navigate({ to: "/" }), 800);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تنفيذ الاستعادة");
    } finally { setBusy(false); }
  };
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-canvas p-5">
    <section className="card w-full max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-black">استعادة حساب الدخول</h1>
      <p className="text-sm text-muted">هذه الصفحة مخصصة لرمز الطوارئ المؤقت فقط.</p>
      <input className="input-field" dir="ltr" placeholder="رمز الاستعادة" value={token} onChange={(e) => setToken(e.target.value)} />
      <input className="input-field" dir="ltr" inputMode="tel" placeholder="رقم الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input className="input-field" dir="ltr" type="password" placeholder="كلمة المرور الجديدة" value={password} onChange={(e) => setPassword(e.target.value)} />
      {message && <p className="rounded-xl bg-brand-soft p-3 text-sm font-bold">{message}</p>}
      <button type="button" disabled={busy} onClick={() => void submit()} className="btn-primary w-full">{busy ? "جارٍ الاستعادة…" : "تغيير كلمة المرور"}</button>
      <Link to="/" className="block text-center text-sm underline">العودة لتسجيل الدخول</Link>
    </section>
  </main>;
}
