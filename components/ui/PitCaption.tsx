"use client";

/**
 * A caption, deliberately small.
 *
 * Everything worth reading on this floor is on the walls in front of you. A
 * panel here would cover the room it is describing — which is what happened
 * on /report until the inspector was confined to the dashboard.
 */
export function PitCaption() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center pl-72">
      <p
        className={[
          "rounded-full border border-white/10 bg-void/70 px-4 py-2 backdrop-blur-xl",
          "font-mono text-[10px] tracking-[0.22em] text-hud-dim uppercase",
        ].join(" ")}
      >
        The Pit · BTC order book, live · intel wall from public sources
      </p>
    </div>
  );
}
