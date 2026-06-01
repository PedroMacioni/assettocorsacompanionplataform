# Auth Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar proteção de rotas com middleware, AuthProvider global, tela de login unificada email-first, dropdown de logout no Sidebar, e fluxo de reset de senha.

**Architecture:** Middleware intercepta rotas protegidas e redireciona para `/login`. AuthProvider fornece estado de auth global via React Context. Tela de login unifica registro e login com fluxo email-first. Sidebar exibe dropdown no card de perfil com Settings e Logout.

**Tech Stack:** Next.js 16, React 19, Supabase Auth, TypeScript 5, Tailwind 4, Lucide Icons

---

## File Structure

### Files to Create

| File | Responsibility |
|------|----------------|
| `apps/web/middleware.ts` | Intercepta rotas protegidas, verifica sessão, redireciona |
| `apps/web/providers/AuthProvider.tsx` | Contexto React com estado de auth e função signOut |
| `apps/web/hooks/useAuth.ts` | Hook para consumir AuthProvider |
| `apps/web/app/(auth)/layout.tsx` | Layout compartilhado para páginas de auth |
| `apps/web/app/(auth)/login/page.tsx` | Tela unificada email-first |
| `apps/web/app/(auth)/auth/callback/route.ts` | OAuth callback (mover do local atual) |
| `apps/web/app/(auth)/auth/reset-password/page.tsx` | Formulário de nova senha |
| `apps/web/app/api/auth/check-email/route.ts` | API para verificar se email existe |
| `apps/web/components/layout/ProfileDropdown.tsx` | Dropdown do perfil com Settings e Logout |

### Files to Modify

| File | Changes |
|------|---------|
| `apps/web/app/layout.tsx` | Wrap com AuthProvider |
| `apps/web/app/page.tsx` | Redirect para /dashboard se logado |
| `apps/web/app/register/page.tsx` | Substituir por redirect para /login |
| `apps/web/app/(dashboard)/layout.tsx` | Adicionar loading state |
| `apps/web/components/layout/Sidebar.tsx` | Integrar ProfileDropdown, remover Settings da nav |

### Files to Delete

| File | Reason |
|------|--------|
| `apps/web/app/login/page.tsx` | Substituído por `(auth)/login/page.tsx` |
| `apps/web/app/auth/callback/route.ts` | Movido para `(auth)/auth/callback/route.ts` |

---

## Task 1: Create Middleware for Route Protection

**Files:**
- Create: `apps/web/middleware.ts`

- [ ] **Step 1: Create middleware file**

```typescript
// apps/web/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/sessions",
  "/analytics",
  "/garage",
  "/tracks",
  "/friends",
  "/profile",
  "/settings",
  "/download",
  "/agent",
  "/personal-bests",
];

const authRoutes = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files and API routes (except auth check)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Create Supabase client with cookies
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  // Allow public profile pages
  if (pathname.startsWith("/profile/") && pathname !== "/profile") {
    return response;
  }

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from auth routes to dashboard
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect authenticated users from landing page to dashboard
  if (pathname === "/" && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Verify middleware is recognized by Next.js**

Run: `cd apps/web && npm run build`
Expected: Build succeeds, no errors related to middleware

- [ ] **Step 3: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat(auth): add middleware for route protection"
```

---

## Task 2: Create AuthProvider and useAuth Hook

**Files:**
- Create: `apps/web/providers/AuthProvider.tsx`
- Create: `apps/web/hooks/useAuth.ts`

- [ ] **Step 1: Create providers directory and AuthProvider**

```typescript
// apps/web/providers/AuthProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
```

- [ ] **Step 2: Create hooks directory and useAuth hook**

```typescript
// apps/web/hooks/useAuth.ts
export { useAuthContext as useAuth } from "@/providers/AuthProvider";
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/providers/AuthProvider.tsx apps/web/hooks/useAuth.ts
git commit -m "feat(auth): add AuthProvider and useAuth hook"
```

---

## Task 3: Integrate AuthProvider in Root Layout

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Update root layout to include AuthProvider**

```typescript
// apps/web/app/layout.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/providers/AuthProvider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sim Racing Companion",
  description: "Your Assetto Corsa history, anywhere.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased dark`}>
      <Suspense fallback={null}>
        <RootLayoutBody>{children}</RootLayoutBody>
      </Suspense>
    </html>
  );
}

async function RootLayoutBody({ children }: { children: React.ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <body className="min-h-full flex flex-col" data-locale={locale}>
      <NextIntlClientProvider messages={messages}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </body>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd apps/web && npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(auth): integrate AuthProvider in root layout"
```

---

## Task 4: Create Auth Route Group and Layout

**Files:**
- Create: `apps/web/app/(auth)/layout.tsx`

- [ ] **Step 1: Create (auth) directory and layout**

```typescript
// apps/web/app/(auth)/layout.tsx
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* Dot grid background */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.6,
        }}
      />
      {/* Orange glow */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2"
        style={{
          width: 500,
          height: 300,
          background: "radial-gradient(ellipse at center, rgba(232,97,42,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 10L7 2L12 10H2Z" fill="white" />
            </svg>
          </div>
          <span className="font-bold text-[15px] tracking-tight text-foreground">Apex</span>
        </Link>

        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(auth)/layout.tsx
git commit -m "feat(auth): add (auth) route group with shared layout"
```

---

## Task 5: Create Check Email API Route

**Files:**
- Create: `apps/web/app/api/auth/check-email/route.ts`

- [ ] **Step 1: Create API route**

```typescript
// apps/web/app/api/auth/check-email/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Rate limiting: simple in-memory store (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return false;
  }

  if (record.count >= RATE_LIMIT) {
    return true;
  }

  record.count++;
  return false;
}

export async function POST(request: NextRequest) {
  // Get client IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

  // Check rate limit
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Create admin client to check users
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if user exists by email
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error("Error checking email:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const exists = data.users.some(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );

    // Add artificial delay to prevent timing attacks
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

    return NextResponse.json({ exists });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
```

- [ ] **Step 2: Test the API route**

Run: `cd apps/web && npm run dev`
Then in another terminal:
```bash
curl -X POST http://localhost:3000/api/auth/check-email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```
Expected: `{"exists": false}` or `{"exists": true}`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/auth/check-email/route.ts
git commit -m "feat(auth): add check-email API endpoint with rate limiting"
```

---

## Task 6: Create Unified Login Page (Email-First)

**Files:**
- Create: `apps/web/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create the unified login page**

```typescript
// apps/web/app/(auth)/login/page.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(auth)/login/page.tsx
git commit -m "feat(auth): add unified email-first login page"
```

---

## Task 7: Move Auth Callback to Route Group

**Files:**
- Create: `apps/web/app/(auth)/auth/callback/route.ts`
- Delete: `apps/web/app/auth/callback/route.ts`

- [ ] **Step 1: Create callback route in (auth) group**

```typescript
// apps/web/app/(auth)/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
```

- [ ] **Step 2: Delete old callback route**

```bash
rm apps/web/app/auth/callback/route.ts
rmdir apps/web/app/auth/callback
rmdir apps/web/app/auth
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(auth)/auth/callback/route.ts
git add -u apps/web/app/auth/
git commit -m "refactor(auth): move callback route to (auth) route group"
```

---

## Task 8: Create Reset Password Page

**Files:**
- Create: `apps/web/app/(auth)/auth/reset-password/page.tsx`

- [ ] **Step 1: Create reset password page**

```typescript
// apps/web/app/(auth)/auth/reset-password/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user has a valid recovery session
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      // User should have a session from the recovery link
      setIsValidSession(!!session);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      if (error.message.includes("expired")) {
        setError("Este link expirou. Solicite um novo link de recuperação.");
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // Redirect to dashboard after 2 seconds
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 2000);
  }

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Invalid or expired link
  if (isValidSession === false) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-foreground">Link inválido</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Este link de recuperação é inválido ou expirou. Solicite um novo link.
          </p>
        </div>
        <Link
          href="/login"
          className="w-full py-2.5 border border-border text-foreground rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para login
        </Link>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-6 w-6 text-green-500" />
          <div>
            <h1 className="text-lg font-bold text-foreground">Senha atualizada!</h1>
            <p className="text-sm text-muted-foreground">
              Redirecionando para o dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div>
        <h1 className="text-lg font-bold text-foreground">Redefinir senha</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Digite sua nova senha abaixo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Nova senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Confirmar senha
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
            placeholder="Repita a senha"
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
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(auth)/auth/reset-password/page.tsx
git commit -m "feat(auth): add reset password page"
```

---

## Task 9: Update Register Page to Redirect

**Files:**
- Modify: `apps/web/app/register/page.tsx`

- [ ] **Step 1: Replace register page with redirect**

```typescript
// apps/web/app/register/page.tsx
import { redirect } from "next/navigation";

export default function RegisterPage() {
  redirect("/login");
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/register/page.tsx
git commit -m "refactor(auth): replace register page with redirect to /login"
```

---

## Task 10: Delete Old Login Page

**Files:**
- Delete: `apps/web/app/login/page.tsx`

- [ ] **Step 1: Delete old login page**

```bash
rm apps/web/app/login/page.tsx
rmdir apps/web/app/login
```

- [ ] **Step 2: Commit**

```bash
git add -u apps/web/app/login/
git commit -m "refactor(auth): remove old login page (replaced by (auth)/login)"
```

---

## Task 11: Create ProfileDropdown Component

**Files:**
- Create: `apps/web/components/layout/ProfileDropdown.tsx`

- [ ] **Step 1: Create ProfileDropdown component**

```typescript
// apps/web/components/layout/ProfileDropdown.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Settings, LogOut, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface ProfileDropdownProps {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  collapsed?: boolean;
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover shrink-0 border border-border"
      />
    );
  }
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary/[0.12] border border-primary/25 flex items-center justify-center shrink-0">
      <span className="text-[11px] font-bold text-primary">{letters}</span>
    </div>
  );
}

export function ProfileDropdown({ displayName, email, avatarUrl, collapsed }: ProfileDropdownProps) {
  const t = useTranslations("Sidebar");
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  async function handleSignOut() {
    setIsOpen(false);
    await signOut();
  }

  if (collapsed) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 flex justify-center rounded-md bg-muted border border-border hover:bg-muted/70 transition-colors cursor-pointer"
        >
          <Avatar name={displayName || "D"} avatarUrl={avatarUrl} />
        </button>

        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{email}</p>
            </div>
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4" />
              {t("settings")}
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full mx-1 p-2.5 rounded-md bg-muted border border-border",
          "hover:bg-muted/70 transition-colors cursor-pointer",
          "flex items-center gap-2.5"
        )}
      >
        <Avatar name={displayName || "D"} avatarUrl={avatarUrl} />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-semibold text-foreground truncate leading-tight">
            {displayName}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
            {email}
          </p>
        </div>
        <MoreVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-1 right-1 mb-2 bg-popover border border-border rounded-lg shadow-lg py-1 z-50">
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4" />
            {t("settings")}
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/ProfileDropdown.tsx
git commit -m "feat(auth): add ProfileDropdown component with logout"
```

---

## Task 12: Update Sidebar to Use ProfileDropdown

**Files:**
- Modify: `apps/web/components/layout/Sidebar.tsx`

- [ ] **Step 1: Import ProfileDropdown and remove Settings from bottomItems**

In `apps/web/components/layout/Sidebar.tsx`, make these changes:

1. Add import at the top:
```typescript
import { ProfileDropdown } from "./ProfileDropdown";
```

2. Remove Settings from imports:
```typescript
// Remove Settings from the lucide-react import line
```

3. Update bottomItems to remove Settings:
```typescript
const bottomItems = [
  { href: "/profile", label: t("profile"), icon: User },
  { href: "/download", label: t("agent"), icon: ArrowDownToLine },
] as const;
```

4. Replace the user card section (lines 239-268 in desktop sidebar) with:
```typescript
{/* User card with dropdown */}
<div className="mt-3">
  <ProfileDropdown
    displayName={displayName}
    email={email}
    avatarUrl={avatarUrl}
    collapsed={collapsed}
  />
</div>
```

5. Replace the user card in mobile drawer (lines 377-389) with:
```typescript
<div className="mt-3 mx-1">
  <ProfileDropdown
    displayName={displayName}
    email={email}
    avatarUrl={avatarUrl}
    collapsed={false}
  />
</div>
```

- [ ] **Step 2: Verify the Sidebar renders correctly**

Run: `cd apps/web && npm run dev`
Expected: Sidebar shows profile dropdown with ⋮ icon, clicking opens menu with Settings and Logout

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/Sidebar.tsx
git commit -m "feat(auth): integrate ProfileDropdown in Sidebar, remove Settings from nav"
```

---

## Task 13: Add Loading State to Dashboard Layout

**Files:**
- Modify: `apps/web/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Add auth check with loading state**

```typescript
// apps/web/app/(dashboard)/layout.tsx
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { SidebarAwareMain } from "@/components/layout/SidebarAwareMain";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Double-check auth (middleware should have already redirected, but this is a safety net)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex bg-background">
        <Sidebar />
        <SidebarAwareMain>
          {/* Hamburger só aparece em mobile */}
          <MobileHeader />
          <main className="px-4 py-6 md:px-8 md:py-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {children}
          </main>
        </SidebarAwareMain>
      </div>
    </SidebarProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(dashboard)/layout.tsx
git commit -m "feat(auth): add server-side auth check to dashboard layout"
```

---

## Task 14: Update Landing Page to Redirect Logged Users

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Read current landing page**

First, read the current landing page to understand its structure.

- [ ] **Step 2: Add auth check at the top of the page**

Add these imports and auth check at the beginning of the page component:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  // Redirect logged users to dashboard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  // ... rest of the component
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(auth): redirect logged users from landing to dashboard"
```

---

## Task 15: Configure Session Expiry via Supabase MCP

**Files:**
- None (Supabase dashboard configuration)

- [ ] **Step 1: Use Supabase MCP to configure session expiry**

Use the Supabase MCP tool to set the inactivity timeout:

```
Project: sim-racing-companion (or your project name)
Setting: Authentication > Sessions
Inactivity timeout: 2592000 (30 days in seconds)
```

- [ ] **Step 2: Document the configuration**

Create a note in the spec or README about the session configuration.

- [ ] **Step 3: Commit any documentation changes**

```bash
git add -A
git commit -m "docs(auth): document session expiry configuration"
```

---

## Task 16: Final Verification and Cleanup

**Files:**
- All auth-related files

- [ ] **Step 1: Run build to verify no errors**

Run: `cd apps/web && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run lint**

Run: `cd apps/web && npm run lint`
Expected: No lint errors

- [ ] **Step 3: Manual testing checklist**

Test the following scenarios:
1. [ ] Unauthenticated user accessing /dashboard → redirects to /login
2. [ ] Unauthenticated user sees loading screen briefly before redirect
3. [ ] Login with existing email shows password field
4. [ ] Login with new email shows registration form
5. [ ] Google OAuth works
6. [ ] Forgot password sends email
7. [ ] Reset password page works
8. [ ] Logout from sidebar dropdown works
9. [ ] Authenticated user accessing /login → redirects to /dashboard
10. [ ] Authenticated user accessing / → redirects to /dashboard

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(auth): complete auth improvements implementation

- Middleware-based route protection
- AuthProvider with global auth state
- Email-first unified login flow
- Profile dropdown with logout in Sidebar
- Password reset flow
- Session expiry after 30 days

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Middleware for route protection | `middleware.ts` |
| 2 | AuthProvider and useAuth hook | `providers/`, `hooks/` |
| 3 | Integrate AuthProvider in root layout | `app/layout.tsx` |
| 4 | Auth route group and layout | `app/(auth)/layout.tsx` |
| 5 | Check email API | `app/api/auth/check-email/route.ts` |
| 6 | Unified login page | `app/(auth)/login/page.tsx` |
| 7 | Move auth callback | `app/(auth)/auth/callback/route.ts` |
| 8 | Reset password page | `app/(auth)/auth/reset-password/page.tsx` |
| 9 | Register redirect | `app/register/page.tsx` |
| 10 | Delete old login page | `app/login/` |
| 11 | ProfileDropdown component | `components/layout/ProfileDropdown.tsx` |
| 12 | Update Sidebar | `components/layout/Sidebar.tsx` |
| 13 | Dashboard layout auth check | `app/(dashboard)/layout.tsx` |
| 14 | Landing page redirect | `app/page.tsx` |
| 15 | Session expiry config | Supabase MCP |
| 16 | Final verification | All files |
