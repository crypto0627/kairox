"use client";

import { NavItem, type NavEntry } from "./NavItem";

const stroke = {
  fill: "none",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const NAV: NavEntry[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" {...stroke}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M10 21v-6h4v6" />
      </svg>
    ),
  },
  {
    href: "/report",
    label: "Report",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" {...stroke}>
        <path d="M3 17l5-6 4 3.5L21 5" />
        <path d="M15 5h6v6" />
      </svg>
    ),
  },
  {
    href: "/history",
    label: "History",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" {...stroke}>
        <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
        <path d="M3 4v4h4" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] stroke-current" {...stroke}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </svg>
    ),
  },
];

/**
 * Transparent glassmorphic navigation. Plain DOM above the canvas — no
 * <Html>, no 3D text — so it stays crisp and fully accessible.
 */
export function Sidebar() {
  return (
    <>
      {/* Contrast strip: the panel is genuinely transparent, and the dark
          room behind it would otherwise swallow the labels. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-20 w-80 bg-gradient-to-r from-void/70 via-void/25 to-transparent"
      />

      <nav
        aria-label="Primary"
        className={[
          "pointer-events-auto absolute top-1/2 left-6 z-20 w-60 -translate-y-1/2",
          "rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl",
          "shadow-[0_0_40px_-10px_rgba(0,229,255,0.45)] ring-1 ring-neon-cyan/20 ring-inset",
        ].join(" ")}
      >
        <div className="px-5 pt-5 pb-3">
          <p className="font-display text-xl tracking-[0.3em] text-neon-cyan drop-shadow-[0_0_12px_rgba(0,229,255,0.7)]">
            KAIROX
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-[0.2em] text-hud-dim uppercase">
            Night City Floor
          </p>
        </div>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent" />

        <ul className="flex flex-col gap-1 p-3">
          {NAV.map((entry) => (
            <li key={entry.href}>
              <NavItem {...entry} />
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
