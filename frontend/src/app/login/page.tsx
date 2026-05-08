"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", username: "", full_name: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      let res;
      if (tab === "login") {
        res = await authApi.login(form.email, form.password);
      } else {
        res = await authApi.register({
          email: form.email,
          password: form.password,
          username: form.username,
          full_name: form.full_name || undefined,
        });
      }
      const token = res.data?.access_token;
      if (token) {
        localStorage.setItem("access_token", token);
        router.push("/backtest");
      } else {
        setError("No token received.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">
            Football <span className="gradient-text-green">AI</span>
          </h1>
          <p className="text-xs text-muted-foreground">Prediction & Analytics Platform</p>
        </div>

        {/* Card */}
        <div className="glass-card p-6 space-y-5">
          {/* Tabs */}
          <div className="flex rounded-lg bg-surface-elevated p-1 gap-1">
            {(["login", "register"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(null); }}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  tab === t
                    ? "bg-neon-green/20 text-neon-green"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {tab === "register" && (
              <>
                <input
                  type="text"
                  placeholder="Username"
                  required
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-green/50"
                />
                <input
                  type="text"
                  placeholder="Full name (optional)"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-green/50"
                />
              </>
            )}
            <input
              type="email"
              placeholder="Email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-green/50"
            />
            <input
              type="password"
              placeholder="Password"
              required
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-green/50"
            />

            {error && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg bg-neon-green/15 text-neon-green border border-neon-green/30 text-sm font-semibold hover:bg-neon-green/25 transition-all disabled:opacity-50"
            >
              {loading ? "Please wait..." : tab === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
