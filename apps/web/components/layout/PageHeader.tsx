import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, actions }: Props) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-3 mt-1">{actions}</div>}
    </div>
  );
}
