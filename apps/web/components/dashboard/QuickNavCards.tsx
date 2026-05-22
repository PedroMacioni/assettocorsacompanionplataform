import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ClipboardList, Car, Settings, TrendingUp } from "lucide-react";

export async function QuickNavCards() {
  const t = await getTranslations("QuickNav");

  const navItems = [
    {
      href: "/sessions",
      icon: ClipboardList,
      title: t("sessions"),
      subtitle: t("sessionsSubtitle"),
    },
    {
      href: "/analytics",
      icon: TrendingUp,
      title: t("analytics"),
      subtitle: t("analyticsSubtitle"),
    },
    {
      href: "/garage",
      icon: Car,
      title: t("garage"),
      subtitle: t("garageSubtitle"),
    },
    {
      href: "/settings",
      icon: Settings,
      title: t("settings"),
      subtitle: t("settingsSubtitle"),
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {navItems.map(({ href, icon: Icon, title, subtitle }) => (
        <Link
          key={href}
          href={href}
          className="group bg-[#161618] border border-[#2a2a2c] rounded-md p-4 transition-all duration-150 hover:border-[#e8612a] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#e8612a15]"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1e1e20] flex items-center justify-center shrink-0 group-hover:bg-[#e8612a20] transition-colors">
              <Icon className="w-5 h-5 text-[#6b6b72] group-hover:text-[#e8612a] transition-colors" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white group-hover:text-[#e8612a] transition-colors">
                {title}
              </p>
              <p className="text-xs text-[#6b6b72] mt-0.5">{subtitle}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
