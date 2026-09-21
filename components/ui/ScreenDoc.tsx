import type { ReactNode } from "react";

/**
 * A page shown on a wall screen.
 *
 * No scrim, no backdrop blur, no max-width: the screen it is rendered onto
 * supplies the surface and the scrolling, and a panel drawn inside another
 * panel reads as a mistake. Padding only.
 */
export function ScreenDoc({ children }: { children: ReactNode }) {
  return <div className="px-9 py-8">{children}</div>;
}
