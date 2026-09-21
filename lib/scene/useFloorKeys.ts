"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { FLOORS, floorIndexFor } from "./floors";

/** Fields the arrow keys belong to rather than the lift. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

/**
 * Up and down arrows call the lift.
 *
 * Guarded against the obvious collision: Profile is a form, and an arrow key
 * inside a number field belongs to the field. Modified presses are left alone
 * too — browsers and screen readers use those.
 */
export function useFloorKeys() {
  const router = useRouter();
  const pathname = usePathname();
  /**
   * Where the lift is headed, which is not always where usePathname says it
   * is. Two quick presses otherwise both read the old floor and compute the
   * same destination, so the second is swallowed — pressing up four times
   * from the bottom landed one storey short.
   */
  const heading = useRef<number | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (isTyping(event.target)) return;

      const here = heading.current ?? floorIndexFor(pathname);
      // Index counts downward, so ArrowUp is one closer to the top.
      const next = here + (event.key === "ArrowDown" ? 1 : -1);
      if (next < 0 || next >= FLOORS.length) return;

      event.preventDefault();
      heading.current = next;
      router.push(FLOORS[next].path);
    }

    // The route caught up with the lift; stop second-guessing it.
    if (heading.current === floorIndexFor(pathname)) heading.current = null;

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);
}
