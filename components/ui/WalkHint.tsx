"use client";

import { useEffect, useState } from "react";

const WALK_KEYS = /^(Arrow(Up|Down|Left|Right)|Key[WASD])$/;

/**
 * Says once that the building is walkable.
 *
 * The supervisor looks like scenery until you move them, and the stair is
 * around a corner from where you start, so without this the floors read as
 * five separate pages again. It goes the first time any walk key is pressed,
 * because from then on it is telling you something you already know.
 */
export function WalkHint() {
  const [walked, setWalked] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (WALK_KEYS.test(event.code)) setWalked(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (walked) return null;

  return (
    <p
      className={[
        "pointer-events-none absolute inset-x-0 bottom-20 z-10 text-center",
        "font-mono text-[11px] tracking-[0.22em] text-hud-dim uppercase",
        "drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]",
      ].join(" ")}
    >
      Arrow keys walk the supervisor · the stairs change floor
    </p>
  );
}
