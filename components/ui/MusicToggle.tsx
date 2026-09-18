"use client";

import { useAudio } from "@/lib/audio/AudioProvider";

/**
 * Background-music toggle. Fixed top-right, z-50 — above the sidebar (z-20)
 * and the loading overlay (z-40), on every route.
 */
export function MusicToggle() {
  const { status, isPlaying, toggle } = useAudio();

  const unavailable = status === "unavailable";
  const loading = status === "loading";
  const inviting = status === "idle" && !unavailable;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={unavailable || loading}
      aria-label="Background music"
      aria-pressed={isPlaying}
      title={
        unavailable
          ? "Music track not installed"
          : isPlaying
            ? "Mute background music"
            : "Play background music"
      }
      className={[
        "pointer-events-auto fixed top-6 right-6 z-50",
        "grid h-11 w-11 place-items-center rounded-full",
        "border border-white/10 bg-white/[0.04] backdrop-blur-xl",
        "ring-1 ring-inset transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan",
        "disabled:cursor-not-allowed disabled:opacity-40",
        isPlaying
          ? "ring-neon-cyan/50 shadow-[0_0_24px_-6px_rgba(0,229,255,0.6)]"
          : "ring-neon-cyan/20 hover:ring-neon-cyan/40",
        inviting ? "animate-pulse-ring" : "",
      ].join(" ")}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-neon-cyan/30 border-t-neon-cyan" />
      ) : isPlaying ? (
        <span className="flex h-4 items-end gap-[3px]" aria-hidden>
          <i className="animate-eq-a block h-full w-[3px] origin-bottom rounded-full bg-neon-cyan" />
          <i className="animate-eq-b block h-full w-[3px] origin-bottom rounded-full bg-neon-cyan" />
          <i className="animate-eq-c block h-full w-[3px] origin-bottom rounded-full bg-neon-cyan" />
        </span>
      ) : (
        <MutedIcon dim={unavailable} />
      )}
    </button>
  );
}

function MutedIcon({ dim }: { dim: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={dim ? "h-5 w-5 stroke-hud-dim" : "h-5 w-5 stroke-hud"}
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="m16 9 5 6M21 9l-5 6" />
    </svg>
  );
}
