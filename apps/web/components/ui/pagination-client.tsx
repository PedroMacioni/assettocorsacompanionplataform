"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = [];
  const siblings = 2;
  pages.push(1);
  const start = Math.max(2, current - siblings);
  const end   = Math.min(total - 1, current + siblings);
  if (start > 2) pages.push("ellipsis");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("ellipsis");
  if (total > 1) pages.push(total);
  return pages;
}

export function PaginationClient({ currentPage, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  const base    = "flex items-center justify-center min-w-[32px] h-8 px-2 text-xs font-medium rounded-md border transition-colors";
  const idle    = `${base} border-border bg-control text-muted-foreground hover:text-foreground hover:border-primary hover:bg-control-hover`;
  const active  = `${base} border-primary bg-control-active text-control-active-foreground`;
  const disabled = `${base} border-border text-muted-foreground/40 cursor-not-allowed pointer-events-none`;

  return (
    <nav role="navigation" aria-label="Paginação" className="flex justify-center items-center gap-1">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={cn(currentPage === 1 ? disabled : idle)}
        aria-label="Página anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {getPageNumbers(currentPage, totalPages).map((p, idx) =>
        p === "ellipsis" ? (
          <span key={`e-${idx}`} className="flex items-center justify-center min-w-[32px] h-8 text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={p === currentPage ? active : idle}
            aria-label={`Ir para página ${p}`}
            aria-current={p === currentPage ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={cn(currentPage === totalPages ? disabled : idle)}
        aria-label="Próxima página"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
