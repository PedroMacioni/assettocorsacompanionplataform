import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  // Redirect logged users to dashboard
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const t = await getTranslations("Landing");
  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d0f] text-[#f0f0f0]">
      {/* Dot grid background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, #2a2a2c 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.5,
        }}
      />

      {/* Orange glow */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 z-0"
        style={{
          width: 700,
          height: 400,
          background:
            "radial-gradient(ellipse at center, rgba(232,97,42,0.15) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Nav */}
        <header className="px-6 py-4 flex items-center justify-between border-b border-[#2a2a2c]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#e8612a] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 10L7 2L12 10H2Z" fill="white" />
              </svg>
            </div>
            <span className="font-bold text-[15px] tracking-tight">Apex</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-1.5 text-sm text-[#6b6b72] hover:text-[#f0f0f0] transition-colors"
            >
              {t("signIn")}
            </Link>
            <Link
              href="/register"
              className="px-4 py-1.5 text-sm bg-[#e8612a] text-white rounded-md hover:bg-[#d4561f] transition-colors font-medium"
            >
              {t("createAccount")}
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#2a2a2c] bg-[#161618] text-[11px] font-semibold uppercase tracking-widest text-[#e8612a] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e8612a] animate-pulse" />
            {t("nowAvailable")}
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight max-w-3xl leading-[1.1] mb-6">
            {t("heroTitle1")}{" "}
            <span className="text-[#e8612a]">{t("heroTitle2")}</span>
            <br />
            {t("heroTitle3")}
          </h1>

          <p className="text-lg text-[#6b6b72] max-w-xl mb-10 leading-relaxed">
            {t("heroDescription")}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/register"
              className="px-6 py-2.5 bg-[#e8612a] text-white rounded-md hover:bg-[#d4561f] transition-colors font-semibold text-sm"
            >
              {t("createFreeAccount")}
            </Link>
            <Link
              href="/login"
              className="px-6 py-2.5 border border-[#2a2a2c] text-[#f0f0f0] rounded-md hover:bg-[#161618] transition-colors text-sm"
            >
              {t("alreadyHaveAccount")}
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 pb-20">
          <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-4">
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M10 2v4M10 14v4M2 10h4M14 10h4M4.93 4.93l2.83 2.83M12.24 12.24l2.83 2.83M4.93 15.07l2.83-2.83M12.24 7.76l2.83-2.83"
                      stroke="#e8612a"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                ),
                title: t("features.syncTitle"),
                desc: t("features.syncDesc"),
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect
                      x="3"
                      y="3"
                      width="14"
                      height="14"
                      rx="2"
                      stroke="#e8612a"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M7 13l2-3 2 2 2-4"
                      stroke="#e8612a"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: t("features.historyTitle"),
                desc: t("features.historyDesc"),
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M10 2l2.09 4.26L17 7.27l-3.5 3.41.83 4.82L10 13.27l-4.33 2.23.83-4.82L3 7.27l4.91-.71L10 2z"
                      stroke="#e8612a"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                title: t("features.pbTitle"),
                desc: t("features.pbDesc"),
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5 space-y-3"
              >
                <div className="w-8 h-8 rounded-md bg-[#1e1e20] flex items-center justify-center">
                  {f.icon}
                </div>
                <p className="font-semibold text-sm">{f.title}</p>
                <p className="text-sm text-[#6b6b72] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 pb-24 border-t border-[#2a2a2c] pt-16">
          <div className="max-w-4xl mx-auto">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-3">
              {t("howItWorks.label")}
            </p>
            <h2 className="text-2xl font-bold mb-10">{t("howItWorks.title")}</h2>
            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  n: "01",
                  title: t("howItWorks.step1Title"),
                  desc: t("howItWorks.step1Desc"),
                },
                {
                  n: "02",
                  title: t("howItWorks.step2Title"),
                  desc: t("howItWorks.step2Desc"),
                },
                {
                  n: "03",
                  title: t("howItWorks.step3Title"),
                  desc: t("howItWorks.step3Desc"),
                },
              ].map((s) => (
                <div key={s.n} className="flex gap-4">
                  <span className="text-[28px] font-bold text-[#2a2a2c] leading-none shrink-0 font-mono">
                    {s.n}
                  </span>
                  <div>
                    <p className="font-semibold text-sm mb-1">{s.title}</p>
                    <p className="text-sm text-[#6b6b72] leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#2a2a2c] px-6 py-4 flex items-center justify-between text-xs text-[#6b6b72]">
          <span>{t("footer")}</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-[#f0f0f0] transition-colors">
              {t("signIn")}
            </Link>
            <Link href="/register" className="hover:text-[#f0f0f0] transition-colors">
              {t("createAccount")}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
