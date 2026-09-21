import { STOREY } from "./floors";

/**
 * The stair core.
 *
 * One shaft serves the whole building, standing off the right-hand wall of
 * every storey at the same place. On the trading floor — which is open plan
 * and fifty-two units wide — it stands in the room. On the cellular storeys
 * below it sits outside the wall, reached through a door.
 *
 * It runs *away* from the room rather than along it. The first arrangement
 * had the flights parallel to the side wall with the door at the far end,
 * which meant walking to the back of the room to reach the stairs — and a
 * camera following you there has the front wall a few feet behind it, so it
 * ends up pressed against the back of your head. Turned a quarter, the door
 * is in the middle of the wall and the shaft extends outwards into space no
 * room is using.
 *
 * It is a switchback: a flight out, a half landing, a flight back, arriving
 * at the storey below. That shape is what makes a stair legible from inside a
 * room — you see the flight you are on and the one you are about to take.
 */

/** The shaft's footprint. `X0` is the wall the door is in. */
export const SHAFT_X0 = 12.4;
export const SHAFT_X1 = 25.4;
export const SHAFT_Z0 = -3.6;
export const SHAFT_Z1 = 3.6;

/** Flights run between these; a landing sits at each end. */
export const RUN_X0 = 14.2;
export const RUN_X1 = 23.6;

/** The two flights run side by side; this is the line between them. */
export const LANE_SPLIT = 0;
export const LANE_A = (SHAFT_Z0 + LANE_SPLIT) / 2;
export const LANE_B = (LANE_SPLIT + SHAFT_Z1) / 2;

/** Rise per flight. Two flights make a storey. */
export const FLIGHT_RISE = STOREY / 2;
export const STEPS_PER_FLIGHT = 20;
export const STEP_RISE = FLIGHT_RISE / STEPS_PER_FLIGHT;
export const STEP_RUN = (RUN_X1 - RUN_X0) / STEPS_PER_FLIGHT;

/** The door between a cellular storey and the shaft, in the middle of the
 *  right-hand wall. */
export const DOOR_Z = 0;
export const DOOR_HALF_W = 1.1;
export const DOOR_HEIGHT = 3.2;

export function inShaft(x: number, z: number): boolean {
  return x > SHAFT_X0 && x < SHAFT_X1 && z > SHAFT_Z0 && z < SHAFT_Z1;
}

/**
 * How high the stair is under a given point.
 *
 * `level` is the storey the current flight pair hangs from — the height of
 * its upper landing. It is carried rather than derived because a switchback
 * stacks two landings in the same place: the one you arrive on and the one a
 * storey above it. Position alone cannot say which you are standing on, so
 * `rebase` below moves `level` at the one place the answer changes.
 */
export function heightAt(level: number, x: number, z: number): number {
  if (!inShaft(x, z)) return level;
  if (x <= RUN_X0) return level;                   // landing at the door
  if (x >= RUN_X1) return level - FLIGHT_RISE;     // half landing, far end

  // 0 at the door end of the flight, 1 at the far end.
  const t = (x - RUN_X0) / (RUN_X1 - RUN_X0);
  return z >= LANE_SPLIT
    ? level - FLIGHT_RISE - (1 - t) * FLIGHT_RISE  // second flight, coming back
    : level - t * FLIGHT_RISE;                     // first flight, heading out
}

/**
 * Carrying `level` across the landing at the door end of the second flight.
 *
 * Crossing that line on the returning lane is the only move that changes
 * which storey you belong to: inwards it is the last step of a descent,
 * outwards the first of a climb.
 */
export function rebase(level: number, z: number, fromX: number, toX: number): number {
  if (z < LANE_SPLIT) return level;
  if (fromX > RUN_X0 && toX <= RUN_X0) return level - STOREY; // arrived below
  if (fromX <= RUN_X0 && toX > RUN_X0) return level + STOREY; // setting off up
  return level;
}
