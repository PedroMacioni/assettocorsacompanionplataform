"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  /** Additional query params to preserve (e.g., { car: "bmw_m3", track: "spa" }) */
  queryParams?: Record<string, string | undefined>;
}

function buildUrl(
  baseUrl: string,
  page: number,
  queryParams?: Record<string, string | undefined>
) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
  }
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generates page numbers to display with ellipsis logic.
 * Pattern: [1] ... [current-3] [current-2] [current-1] [current] [current+1] [current+2] [current+3] ... [last]
 */
function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  const pages: (number | "ellipsis")[] = [];
  const siblingsCount = 3;

  // Always include page 1
  pages.push(1);

  // Calculate window around current page
  const windowStart = Math.max(2, current - siblingsCount);
  const windowEnd = Math.min(total - 1, current + siblingsCount);

  // Add ellipsis after page 1 if there's a gap
  if (windowStart > 2) {
    pages.push("ellipsis");
  }

  // Add pages in the window
  for (let i = windowStart; i <= windowEnd; i++) {
    pages.push(i);
  }

  // Add ellipsis before last page if there's a gap
  if (windowEnd < total - 1) {
    pages.push("ellipsis");
  }

  // Always include last page (if > 1)
  if (total > 1) {
    pages.push(total);
  }

  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  baseUrl,
  queryParams,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  const linkClasses =
    "flex items-center justify-center min-w-[32px] h-8 px-2 text-xs font-medium rounded-md border transition-colors";
  const defaultClasses = `${linkClasses} border-border bg-control text-muted-foreground hover:text-foreground hover:border-primary hover:bg-control-hover`;
  const activeClasses = `${linkClasses} border-primary bg-control-active text-control-active-foreground`;
  const disabledClasses = `${linkClasses} border-border text-muted-foreground/40 cursor-not-allowed pointer-events-none`;

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className="flex justify-center items-center gap-1"
    >
      {/* Previous button */}
      {currentPage > 1 ? (
        <Link
          href={buildUrl(baseUrl, currentPage - 1, queryParams)}
          className={defaultClasses}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className={disabledClasses} aria-disabled="true">
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {/* Page numbers */}
      {pageNumbers.map((pageNum, idx) => {
        if (pageNum === "ellipsis") {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="flex items-center justify-center min-w-[32px] h-8 text-muted-foreground"
              aria-hidden="true"
            >
              <MoreHorizontal className="h-4 w-4" />
            </span>
          );
        }

        const isActive = pageNum === currentPage;
        return (
          <Link
            key={pageNum}
            href={buildUrl(baseUrl, pageNum, queryParams)}
            className={isActive ? activeClasses : defaultClasses}
            aria-label={`Go to page ${pageNum}`}
            aria-current={isActive ? "page" : undefined}
          >
            {pageNum}
          </Link>
        );
      })}

      {/* Next button */}
      {currentPage < totalPages ? (
        <Link
          href={buildUrl(baseUrl, currentPage + 1, queryParams)}
          className={defaultClasses}
          aria-label="Go to next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={disabledClasses} aria-disabled="true">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
