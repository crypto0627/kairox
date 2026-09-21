"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  AnimationClip,
  AnimationMixer,
  Color,
  Vector3,
  type AnimationAction,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from "three";
import { SkeletonUtils } from "three-stdlib";
import { step, usePrefersReducedMotion } from "@/lib/three/environment";
import { walker, walkInput } from "@/lib/scene/walker";
import {
  DOOR_HALF_W,
  DOOR_Z,
  RUN_X0,
  SHAFT_Z0 as SHAFT_Z_BACK,
  SHAFT_X0,
  SHAFT_X1,
  SHAFT_Z0,
  SHAFT_Z1,
  flightExists,
  heightAt,
  inShaft,
  rebase,
} from "@/lib/scene/stairs";

const MODEL = "/models/robot-trader.glb";

/** Same rig, different livery: steel and cyan rather than the traders' amber,
 *  so it reads as staff rather than a sixth desk. */
const CHASSIS = new Color("#39434f");
const FRAME = new Color("#1b2330");
const VISOR = new Color("#00e5ff");

const SCALE = 0.44;
const WALK_SPEED = 3.4;
const TURN_RATE = 9;

/** How far out into a room they may walk before a wall stops them. */
const ROOM_X = -11;
const ROOM_Z0 = -9;
const ROOM_Z1 = 8;
const MARGIN = 0.3;

interface Rig {
  mixer: AnimationMixer;
  walk: AnimationAction | null;
  idle: AnimationAction | null;
}

/** Shortest signed angular difference, so it never turns the long way round. */
function angleDelta(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Where a step is allowed to land.
 *
 * The room and the shaft are two boxes that meet only at the door in the
 * middle of the right-hand wall. Each axis is clamped on its own so that
 * walking into a wall slides along it rather than stopping dead, which is
 * most of the difference between a character and a cursor.
 */
function settle(fromX: number, x: number, z: number, openPlan: boolean): [number, number] {
  // The trading floor has no wall between it and the stair core, so its whole
  // mouth is a way in. The storeys below are cellular and have a door.
  const doorway = openPlan
    ? z > SHAFT_Z_BACK + MARGIN && z < SHAFT_Z1 - MARGIN
    : Math.abs(z - DOOR_Z) < DOOR_HALF_W - 0.2;

  if (fromX > SHAFT_X0) {
    // In the shaft: its own walls, and a way back only through the door.
    const minX = doorway ? ROOM_X : SHAFT_X0 + MARGIN;
    const inside = x > SHAFT_X0;
    return [
      clamp(x, minX, SHAFT_X1 - MARGIN),
      inside
        ? clamp(z, SHAFT_Z0 + MARGIN, SHAFT_Z1 - MARGIN)
        : clamp(z, ROOM_Z0, ROOM_Z1),
    ];
  }

  // In a room: the shaft wall is solid except at the door.
  const maxX = doorway ? SHAFT_X1 - MARGIN : SHAFT_X0 - MARGIN;
  return [clamp(x, ROOM_X, maxX), clamp(z, ROOM_Z0, ROOM_Z1)];
}

/**
 * The floor supervisor — and, since the building got a stair, the one you
 * drive.
 *
 * Arrow keys and WASD walk them around the storey they are on; walking into
 * the stair core and down a flight is what changes floor. Their height is
 * read off the stair rather than animated, so the model is genuinely on the
 * treads and the camera that follows them genuinely descends.
 *
 * Driven imperatively for the same reason as everything else on this floor:
 * position and animation state are external, and nothing here should cost a
 * React render per frame.
 */
export function Supervisor() {
  const stillness = usePrefersReducedMotion();
  const host = useRef<Group>(null);
  const rig = useRef<Rig | null>(null);
  const walking = useRef(false);
  const aim = useRef(new Vector3());
  const { camera } = useThree();
  const { scene, animations } = useGLTF(MODEL);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;

    const model = SkeletonUtils.clone(scene) as Group;
    const materials: MeshStandardMaterial[] = [];

    model.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const material = (mesh.material as MeshStandardMaterial).clone();
      if (material.name === "Black") {
        material.color.set("#05070b");
        material.emissive = VISOR.clone();
        material.emissiveIntensity = 2.2;
      } else {
        material.color.copy(material.name === "Main" ? CHASSIS : FRAME);
        material.metalness = 0.85;
        material.roughness = 0.3;
      }
      mesh.material = material;
      materials.push(material);
    });

    parent.add(model);

    const mixer = new AnimationMixer(model);
    const find = (name: string) => {
      const clip = AnimationClip.findByName(animations, name);
      return clip ? mixer.clipAction(clip) : null;
    };
    const walk = find("Walking");
    const idle = find("Idle");
    idle?.play();

    rig.current = { mixer, walk, idle };

    return () => {
      rig.current = null;
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      parent.remove(model);
      for (const material of materials) material.dispose();
    };
  }, [scene, animations]);

  useFrame((_, rawDelta) => {
    const current = rig.current;
    const node = host.current;
    if (!current || !node) return;

    const delta = step(rawDelta);

    // Which way is forward depends on where you are standing, not on the
    // world axes — otherwise walking "up" sends them sideways the moment you
    // orbit the camera.
    aim.current.set(camera.position.x - walker.x, 0, camera.position.z - walker.z);
    if (aim.current.lengthSq() < 1e-6) aim.current.set(0, 0, 1);
    aim.current.normalize();

    let ax = 0;
    let az = 0;
    if (walkInput.forward) { ax -= aim.current.x; az -= aim.current.z; }
    if (walkInput.back)    { ax += aim.current.x; az += aim.current.z; }
    // Left and right are the forward vector turned a quarter turn.
    if (walkInput.left)    { ax -= aim.current.z; az += aim.current.x; }
    if (walkInput.right)   { ax += aim.current.z; az -= aim.current.x; }

    const push = Math.hypot(ax, az);
    const moving = push > 0.001 && !stillness;

    if (moving) {
      const speed = (WALK_SPEED * delta) / push;
      const [stepped, z] = settle(
        walker.x,
        walker.x + ax * speed,
        walker.z + az * speed,
        walker.level === 0,
      );
      // Leaving the landing onto a flight the building does not have — above
      // the top storey, below the bottom one — is a wall, not a fall.
      const x =
        walker.x <= RUN_X0 && stepped > RUN_X0 && !flightExists(walker.level, z)
          ? RUN_X0
          : stepped;
      walker.level = rebase(walker.level, z, walker.x, x);
      walker.x = x;
      walker.z = z;
      walker.facing += angleDelta(walker.facing, Math.atan2(ax, az)) *
        Math.min(1, TURN_RATE * delta);
    }

    // Height is read off the stair, never animated: the model stands on the
    // treads because it is standing on the same function they were built from.
    walker.y = inShaft(walker.x, walker.z)
      ? heightAt(walker.level, walker.x, walker.z)
      : walker.level;
    walker.moving = moving;

    node.position.set(walker.x, walker.y, walker.z);
    node.rotation.y = walker.facing;

    if (moving !== walking.current) {
      walking.current = moving;
      if (moving) {
        current.idle?.fadeOut(0.18);
        current.walk?.reset().fadeIn(0.18).play();
      } else {
        current.walk?.fadeOut(0.24);
        current.idle?.reset().fadeIn(0.24).play();
      }
    }

    current.mixer.update(delta);
  });

  return (
    <group ref={host} scale={SCALE}>
      {/* A lamp they carry. The stair core has no windows and no signage, so
          without this the only lit thing on a flight is the nosing strip and
          you descend by feel. Scaled with the model, so the numbers here are
          in robot units. */}
      <pointLight
        position={[0, 2.4, 4.6]}
        intensity={22}
        distance={30}
        decay={2}
        color="#bfe9ff"
      />
    </group>
  );
}
