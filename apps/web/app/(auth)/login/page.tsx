"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AuthStep = "email" | "login" | "register" | "forgot-password";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("Login");
  const nextUrl = searchParams.get("next") || "/dashboard";

  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleGoogle() {
    setGoogleLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}` },
    });
  }

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setCheckingEmail(true);
    setError("");

    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error checking email");
        setCheckingEmail(false);
        return;
      }

      const { exists } = await res.json();
      setStep(exists ? "login" : "register");
    } catch {
      setError("Error checking email. Please try again.");
    } finally {
      setCheckingEmail(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(nextUrl);
    router.refresh();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(nextUrl);
    router.refresh();
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setResetSent(true);
    setLoading(false);
  }

  function handleChangeEmail() {
    setStep("email");
    setPassword("");
    setName("");
    setError("");
  }

  // Email step
  if (step === "email") {
    return (
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border border-border rounded-md text-sm font-medium text-foreground bg-muted hover:bg-muted/70 transition-colors disabled:opacity-50"
        >
          <GoogleIcon />
          {googleLoading ? t("redirecting") : t("googleButton")}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{t("or")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleEmailContinue} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("email")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              placeholder={t("emailPlaceholder")}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/[0.08] border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={checkingEmail || !email}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {checkingEmail && <Loader2 className="h-4 w-4 animate-spin" />}
            {checkingEmail ? "Verificando..." : "Continuar"}
          </button>
        </form>
      </div>
    );
  }

  // Login step
  if (step === "login") {
    return (
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Bem-vindo de volta!</h1>
          <button
            onClick={handleChangeEmail}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-0.5"
          >
            {email} <span className="text-xs text-primary">(trocar)</span>
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("password")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="button"
            onClick={() => setStep("forgot-password")}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Esqueci minha senha
          </button>

          {error && (
            <p className="text-xs text-destructive bg-destructive/[0.08] border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? t("signingIn") : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  // Register step
  if (step === "register") {
    return (
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Criar sua conta</h1>
          <button
            onClick={handleChangeEmail}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-0.5"
          >
            {email} <span className="text-xs text-primary">(trocar)</span>
          </button>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Nome
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              placeholder="Seu nome"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("password")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/[0.08] border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Criando..." : "Criar conta"}
          </button>
        </form>
      </div>
    );
  }

  // Forgot password step
  if (step === "forgot-password") {
    if (resetSent) {
      return (
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div>
            <h1 className="text-lg font-bold text-foreground">Email enviado!</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Enviamos um link para <strong>{email}</strong>. Verifique sua caixa de entrada e clique no link para redefinir sua senha.
            </p>
          </div>
          <button
            onClick={() => {
              setStep("email");
              setResetSent(false);
            }}
            className="w-full py-2.5 border border-border text-foreground rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para login
          </button>
        </div>
      );
    }

    return (
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Recuperar senha</h1>
          <button
            onClick={handleChangeEmail}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-0.5"
          >
            {email} <span className="text-xs text-primary">(trocar)</span>
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Enviaremos um link para você redefinir sua senha.
        </p>

        <form onSubmit={handleForgotPassword} className="space-y-4">
          {error && (
            <p className="text-xs text-destructive bg-destructive/[0.08] border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Enviando..." : "Enviar link"}
          </button>
        </form>

        <button
          onClick={() => setStep("login")}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
        >
          <ArrowLeft className="h-3 w-3" />
          Voltar para login
        </button>
      </div>
    );
  }

  return null;
}
