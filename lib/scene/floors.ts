import { Vector3 } from "three";

/**
 * The building.
 *
 * Routes were already camera positions — the scene lerped between two of them
 * on pathname. This turns that into storeys: each floor owns a slab of world
 * space at its own height, and moving between routes rides the camera up or
 * down through the shaft. No movement system, no collision, no pointer lock;
 * the sidebar stays the way you get around, which is also the reason this
 * still works on a phone and with a keyboard.
 */
export interface Floor {
  id: string;
  /** Vertical offset of everything on this storey. */
  level: number;
  camera: Vector3;
  target: Vector3;
  /**
   * Orbit limits, per storey.
   *
   * These were global, tuned for the trading floor, and the Pit's camera sits
   * 18 units from its target — so OrbitControls was quietly clamping it to 15
   * and pulling against the lerp every frame. A room gets to say how far back
   * you can stand in it.
   */
  minDistance: number;
  maxDistance: number;
}

/** Storey height. Enough that the floors do not see each other. */
export const STOREY = 18;

export const TRADING_FLOOR: Floor = {
  id: "trading",
  level: 0,
  camera: new Vector3(0, 3.2, 11),
  target: new Vector3(0, 2.4, 0),
  minDistance: 8,
  maxDistance: 15,
};

/** Pulled back and off-centre, for routes that lay a document over the floor. */
export const TRADING_FLOOR_AWAY: Floor = {
  ...TRADING_FLOOR,
  camera: new Vector3(-2.4, 3.6, 13.5),
};

/**
 * Stood at book height, the order walls fill the frame and bury the intel
 * behind them — you are inside the terrain rather than reading it. The eye
 * belongs above the pit, looking down into it with the wall still standing
 * up in the background.
 */
export const PIT: Floor = {
  id: "pit",
  level: STOREY,
  camera: new Vector3(0, STOREY + 8.4, 17),
  target: new Vector3(0, STOREY + 3.0, -3.2),
  minDistance: 12,
  maxDistance: 30,
};

/** Which storey a route stands on. */
export function floorFor(pathname: string): Floor {
  if (pathname === "/pit") return PIT;
  return pathname === "/" ? TRADING_FLOOR : TRADING_FLOOR_AWAY;
}
