"use client";

import { useAgentStore } from "@/lib/store/agentStore";

/**
 * The only instruction on the floor.
 *
 * Nothing analyses on a timer any more, so an untouched scene gives no sign
 * that the traders are clickable — the cursor changes on hover and that is
 * it. This says so once, and removes itself the moment any agent has been
 * asked, because by then it is telling you something you have done.
 */
export function FloorHint() {
  const agents = useAgentStore((s) => s.agents);
  const asked = Object.values(agents).some(
    (agent) => agent.phase === "spoken" || agent.phase === "thinking",
  );
  if (asked) return null;

  return (
    <p
      className={[
        "pointer-events-none absolute inset-x-0 bottom-28 z-10 text-center",
        "font-mono text-[11px] tracking-[0.22em] text-hud-dim uppercase",
        "drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]",
      ].join(" ")}
    >
      Click a trader to ask it for a read
    </p>
  );
}
