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
