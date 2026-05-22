import Link from "next/link";

type Props = { title?: string; description?: string; action?: { label: string; href: string } };

export function EmptyState({
  title = "Your data will appear here",
  description = "Install CompanionAgent to automatically sync your Assetto Corsa history.",
  action = { label: "Configurar Agent", href: "/download" },
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
      <div className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center mb-2">
        <span className="text-2xl">🏁</span>
      </div>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      <Link
        href={action.href}
        className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
      >
        {action.label}
      </Link>
    </div>
  );
}
