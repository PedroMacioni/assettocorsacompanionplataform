"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sessions", label: "Sessões" },
  { href: "/personal-bests", label: "Personal Bests" },
  { href: "/settings", label: "Configurações" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="flex items-center gap-1 px-4 py-3 border-b bg-background">
      <span className="font-bold text-sm mr-4 text-primary">🏎 Sim Racing</span>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm transition-colors",
            pathname === l.href || pathname.startsWith(l.href + "/")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          {l.label}
        </Link>
      ))}
      <button
        onClick={signOut}
        className="ml-auto text-sm text-muted-foreground hover:text-foreground"
      >
        Sair
      </button>
    </nav>
  );
}
