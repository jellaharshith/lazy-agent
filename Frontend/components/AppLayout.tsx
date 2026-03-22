"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className={isHome ? "min-h-screen bg-slate-950" : "min-h-screen bg-[#f4f6f9]"}>
      {!isHome && <Navbar />}
      {children}
    </div>
  );
}
