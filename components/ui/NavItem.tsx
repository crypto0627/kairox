"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export interface NavEntry {
  href: string;
  label: string;
  icon: ReactNode;
}

export function NavItem({ href, label, icon }: NavEntry) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "group relative flex items-center gap-3 rounded-xl px-4 py-3",
        "font-display text-[13px] tracking-[0.18em] uppercase transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/60",
        active
          ? "bg-neon-cyan/10 text-neon-cyan shadow-[0_0_20px_-8px_rgba(0,229,255,0.8)]"
          : "text-hud-dim hover:bg-white/[0.04] hover:text-hud",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "absolute left-0 top-1/2 h-6 -translate-y-1/2 rounded-full transition-all duration-200",
          active ? "w-[3px] bg-neon-cyan shadow-[0_0_10px_rgba(0,229,255,0.9)]" : "w-0",
        ].join(" ")}
      />
      <span className="shrink-0">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
