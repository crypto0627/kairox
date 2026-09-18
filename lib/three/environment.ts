"use client";

import { useSyncExternalStore } from "react";

/**
 * Browser preferences and state, read through useSyncExternalStore.
 *
 * The obvious shape — read in an effect, setState — is both a hydration
 * hazard and the exact pattern the compiler rules refuse. This is the API
 * built for it: a subscribe, a client snapshot, and a server snapshot that
 * says what the markup was rendered assuming.
 */

function mediaStore(query: string) {
  const subscribe = (notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  };
  return {
    subscribe,
    getSnapshot: () => window.matchMedia(query).matches,
  };
}

const reducedMotion = mediaStore("(prefers-reduced-motion: reduce)");

/** True when the visitor has asked their system for less animation. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    reducedMotion.subscribe,
    reducedMotion.getSnapshot,
    () => false,
  );
}

function subscribeVisibility(notify: () => void) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}

/** True while the tab is actually on screen. */
export function useIsVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => !document.hidden,
    () => true,
  );
}

/**
 * Longest frame step anything is allowed to integrate.
 *
 * The draw loop stops while the tab is hidden, so the first frame back
 * carries a delta of however long you were away. Anything that integrates it
 * — a walk, an animation mixer — would jump by that much: a supervisor who
 * left for ten minutes arrives nine hundred units past the far wall.
 */
export const MAX_STEP = 0.1;

export function step(delta: number): number {
  return Math.min(delta, MAX_STEP);
}
