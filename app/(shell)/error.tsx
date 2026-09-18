"use client";

import { useEffect } from "react";

/**
 * Route-level boundary.
 *
 * The pages that read the database already handle it being unreachable and
 * say so. This is for what is left: a genuine bug, where the useful thing is
 * to keep the shell up, name what happened, and offer a retry that does not
 * reload the whole scene.
 */
export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("route error:", error);
  }, [error]);

  return (
    <div className="pointer-events-auto grid h-full place-items-center px-6">
      <div className="max-w-md rounded-2xl border border-amber-400/20 bg-void/90 p-6 text-center backdrop-blur-2xl">
        <p className="font-mono text-[10px] tracking-[0.3em] text-amber-400 uppercase">
          Console fault
        </p>
        <h1 className="font-display mt-2 text-2xl tracking-[0.16em] text-hud uppercase">
          This screen failed
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-hud-dim">
          The floor behind it is still running, and so are the feeds.
        </p>
        <p className="mt-3 font-mono text-[10px] break-words text-hud-dim/60">
          {error.message.slice(0, 200)}
          {error.digest && ` · ${error.digest}`}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-neon-cyan transition hover:bg-neon-cyan/20"
        >
          TRY AGAIN
        </button>
      </div>
    </div>
  );
}
