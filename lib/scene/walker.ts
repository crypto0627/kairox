"use client";

import { useEffect } from "react";
import { DOOR_Z } from "./stairs";

/**
 * The supervisor's pose, and the keys pushing it around.
 *
 * Both are plain mutable objects rather than React state, for the same reason
 * the price feed is: this changes sixty times a second and nothing about it
 * should cost a render. The scene reads it inside useFrame; React only ever
 * learns about it when the walker arrives on a new storey, which is a
 * navigation, not a frame.
 */
export const walker = {
  /** Where they are standing. `y` is absolute height, not an offset. */
  x: 3.2,
  y: 0,
  z: DOOR_Z,
  /**
   * The storey the current flight pair hangs from. Equal to `y` whenever they
   * are standing in a room; see `heightAt` for why it is carried separately.
   */
  level: 0,
  facing: Math.PI,
  /** Set by the scene each frame so the model knows whether to walk or idle. */
  moving: false,
};

export const walkInput = {
  forward: false,
  back: false,
  left: false,
  right: false,
};

/**
 * Stands them on a storey, facing into the room.
 *
 * Off to one side rather than dead centre, so the camera behind them frames
 * the room rather than the back of their head, and already lined up with the
 * door to the stair — from here, walking right goes downstairs. Facing −z,
 * which is where every storey keeps the thing worth looking at: the window
 * upstairs, the screen below.
 */
export function placeOnStorey(level: number) {
  walker.level = level;
  walker.y = level;
  walker.x = 3.2;
  walker.z = DOOR_Z;
  walker.facing = Math.PI;
}

/** Fields and documents the arrow keys belong to rather than the walker. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable === true) return true;
  // A page on a wall screen scrolls with the arrow keys; walking the floor
  // while reading it would be two answers to one press.
  return el.closest?.(".kairox-screen") != null;
}

const KEYS: Record<string, keyof typeof walkInput> = {
  ArrowUp: "forward",
  ArrowDown: "back",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "forward",
  KeyS: "back",
  KeyA: "left",
  KeyD: "right",
};

/**
 * Arrow keys and WASD drive the supervisor.
 *
 * Held rather than pressed: the scene integrates the direction every frame,
 * so a long press walks rather than repeating. Modified presses are left to
 * the browser, which uses them for scrolling and for accessibility.
 */
export function useWalkKeys() {
  useEffect(() => {
    function set(event: KeyboardEvent, down: boolean) {
      const slot = KEYS[event.code];
      if (!slot) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (down && isTyping(event.target)) return;
      // Arrow keys would otherwise scroll the window underneath the canvas.
      event.preventDefault();
      walkInput[slot] = down;
    }

    const onDown = (event: KeyboardEvent) => set(event, true);
    const onUp = (event: KeyboardEvent) => set(event, false);
    // Losing the window with a key held would otherwise walk them into a wall
    // forever.
    const release = () => {
      walkInput.forward = walkInput.back = walkInput.left = walkInput.right = false;
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
      release();
    };
  }, []);
}
