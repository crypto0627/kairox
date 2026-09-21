import { Vector3 } from "three";

/**
 * The building.
 *
 * Routes were already camera positions; they are storeys now, in the order
 * the sidebar lists them. Changing route rides the camera through the shaft.
 * There is still no movement system — the sidebar and the arrow keys are how
 * you get around, which is why this survives a phone and a keyboard.
 *
 * The trading floor stays at zero and everything else goes *below* it. It is
 * the top floor either way, and it is the only storey with a window: its
 * whole composition — the skyline's height, the fog, where the rain falls —
 * is built around standing at street level. Lifting it seventy units would
 * have put the camera above most of the city it was framed to look at.
 */
export interface Floor {
  id: string;
  path: string;
  label: string;
  /** Vertical offset of everything on this storey. Zero is the trading floor. */
  level: number;
  camera: Vector3;
  target: Vector3;
  /**
   * Orbit limits, per storey.
   *
   * These used to be global and tuned for the trading floor, so the Pit's
   * camera — eighteen units from its target — was silently clamped to fifteen
   * and pulled against the lerp every frame. A room says how far back you can
   * stand in it.
   */
  minDistance: number;
  maxDistance: number;
  /**
   * Where this storey's page is shown on a screen in the room rather than on
   * a panel floating over it. Undefined means the page renders as a DOM
   * overlay, which is right for the dashboard's ticker and the Pit's caption
   * — those are chrome, not a document.
   */
  screen?: [number, number, number];
}

/** Storey height. Enough that floors never see each other. */
export const STOREY = 18;

/**
 * Top to bottom, matching the sidebar. Index is the floor number counting
 * down, so ArrowDown is +1 here and ArrowUp is −1.
 */
export const FLOORS: Floor[] = [
  {
    id: "trading",
    path: "/",
    label: "Trading Floor",
    level: 0,
    camera: new Vector3(0, 3.2, 11),
    target: new Vector3(0, 2.4, 0),
    minDistance: 8,
    maxDistance: 15,
  },
  {
    id: "pit",
    path: "/pit",
    label: "The Pit",
    level: -STOREY,
    /**
     * Standing at the back of the room, at eye height.
     *
     * Close enough that the wall is readable, far enough that the well and
     * the rail are in shot. Pressed up at eleven units the panels filled the
     * frame and the pit they are hung over was gone, which is the opposite
     * mistake to the first pass.
     */
    camera: new Vector3(0, 2.05 - STOREY, 8.2),
    target: new Vector3(0, 2.9 - STOREY, -3.5),
    minDistance: 5,
    maxDistance: 18,
  },
  {
    id: "briefing",
    path: "/report",
    label: "Briefing",
    level: -STOREY * 2,
    camera: new Vector3(0, -STOREY * 2 + 2.4, 3.8),
    target: new Vector3(0, -STOREY * 2 + 3.1, -4),
    minDistance: 3,
    maxDistance: 14,
    screen: [0, -STOREY * 2 + 3.1, -9.9],
  },
  {
    id: "archive",
    path: "/history",
    label: "Archive",
    level: -STOREY * 3,
    camera: new Vector3(0, -STOREY * 3 + 2.4, 3.8),
    target: new Vector3(0, -STOREY * 3 + 3.1, -4),
    minDistance: 3,
    maxDistance: 14,
    screen: [0, -STOREY * 3 + 3.1, -9.9],
  },
  {
    id: "ops",
    path: "/profile",
    label: "Ops",
    level: -STOREY * 4,
    camera: new Vector3(0, -STOREY * 4 + 2.4, 3.8),
    target: new Vector3(0, -STOREY * 4 + 3.1, -4),
    minDistance: 3,
    maxDistance: 14,
    screen: [0, -STOREY * 4 + 3.1, -9.9],
  },
];

export const TOP_FLOOR = FLOORS[0];

export function floorIndexFor(pathname: string): number {
  const index = FLOORS.findIndex((floor) => floor.path === pathname);
  return index === -1 ? 0 : index;
}

export function floorFor(pathname: string): Floor {
  return FLOORS[floorIndexFor(pathname)];
}
