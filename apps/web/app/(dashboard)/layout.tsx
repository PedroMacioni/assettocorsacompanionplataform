import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div className="flex-1 ml-[220px] min-h-screen">
        <main className="px-8 py-8 animate-in fade-in slide-in-from-bottom-2 duration-300">{children}</main>
      </div>
    </div>
  );
}
