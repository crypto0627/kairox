export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="grid h-full w-full place-items-center px-6">
      <div
        className={[
          "pointer-events-auto relative w-full max-w-md overflow-hidden rounded-2xl",
          "border border-white/10 bg-white/[0.04] px-8 py-10 text-center backdrop-blur-xl",
          "shadow-[0_0_60px_-20px_rgba(139,92,246,0.7)] ring-1 ring-neon-violet/20 ring-inset",
        ].join(" ")}
      >
        <div
          aria-hidden
          className="animate-scanline pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-neon-cyan/[0.07] to-transparent"
        />
        <p className="font-mono text-[10px] tracking-[0.35em] text-neon-magenta uppercase">
          Module Offline
        </p>
        <h1 className="font-display mt-3 text-3xl tracking-[0.2em] text-hud uppercase">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-hud-dim">
          This console is reserved. The route, layout slot and navigation entry
          are wired — the screen itself ships in a later build.
        </p>
      </div>
    </div>
  );
}
