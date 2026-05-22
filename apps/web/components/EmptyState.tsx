import Link from "next/link";

type Props = { title?: string; description?: string; action?: { label: string; href: string } };

export function EmptyState({
  title = "Nenhuma sessão ainda",
  description = "Instale o Companion Agent para sincronizar automaticamente seu histórico do Assetto Corsa.",
  action = { label: "Configurar Agent", href: "/download" },
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4 animate-in fade-in duration-500">
      <div className="w-16 h-16 rounded-full bg-[#1e1e20] border border-[#2a2a2c] flex items-center justify-center mb-2">
        <span className="text-2xl">🏁</span>
      </div>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">{description}</p>
      <Link
        href={action.href}
        className="mt-2 px-5 py-2.5 bg-[#e8612a] text-white text-sm font-semibold rounded-md hover:bg-[#d4521f] transition-colors"
      >
        {action.label}
      </Link>
    </div>
  );
}
