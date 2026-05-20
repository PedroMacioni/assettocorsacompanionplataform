"use client";

import { useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("apex-theme");
      if (saved === "light") {
        document.documentElement.classList.remove("dark");
      }
      // Default is dark — html already has the class
    } catch {}
  }, []);

  return <>{children}</>;
}
