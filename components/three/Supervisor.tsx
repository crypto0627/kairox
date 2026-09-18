"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { usePathname } from "next/navigation";
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

const MODEL = "/models/robot-trader.glb";

/** Same rig, different livery: steel and cyan rather than the traders' amber,
 *  so it reads as staff rather than a sixth desk. */
const CHASSIS = new Color("#39434f");
const FRAME = new Color("#1b2330");
const VISOR = new Color("#00e5ff");

const SCALE = 0.44;
/**
 * The walkway behind the desks.
 *
 * In front of them it worked out three units from the camera and filled the
 * middle of the frame, blocking the trader it was meant to be supervising.
 * Behind, the traders partly occlude it, which is what walking a floor looks
 * like.
 */
const LANE_Z = -3.8;
const PATROL_X = 8.6;

/**
 * Where it stands to deliver the report — the right-hand end of its own lane.
 *
 * Not the front and centre it deserves: /report puts an opaque panel across
 * the middle of the screen and the sidebar owns the left, so the only place it
 * can be seen from while you read is the gap on the right. Standing a little
 * forward of its lane there makes it large enough to register.
 */
const PODIUM = new Vector3(9.8, 0, -1.2);

const WALK_SPEED = 1.5;
const TURN_RATE = 3.2;
const ARRIVED = 0.25;

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

/**
 * The floor supervisor.
 *
 * It walks the line while the desks work, and on /report it comes to the front
 * and turns to face you — which is the whole reason the report is a place in a
 * room rather than a page. It is the same CC0 rig as the traders, re-liveried,
 * using the Walking clip that has been sitting unused since the GLTF landed.
 *
 * Driven imperatively for the same reason as everything else on this floor:
 * position and animation state are external, and nothing here should cost a
 * React render per frame.
 */
export function Supervisor() {
  const pathname = usePathname();
  const stillness = usePrefersReducedMotion();
  const host = useRef<Group>(null);
  const rig = useRef<Rig | null>(null);
  const heading = useRef(1);
  const facing = useRef(Math.PI / 2);
  const walking = useRef(true);
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
    parent.position.set(-PATROL_X, 0, LANE_Z);

    const mixer = new AnimationMixer(model);
    const find = (name: string) => {
      const clip = AnimationClip.findByName(animations, name);
      return clip ? mixer.clipAction(clip) : null;
    };
    const walk = find("Walking");
    const idle = find("Idle");
    walk?.play();

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

    // Standing still is a legitimate thing for a supervisor to do, and it is
    // what someone who asked for less motion should see.
    const presenting = stillness || pathname === "/report";

    // Where it is trying to be. On the report page that is the podium; the
    // rest of the time it is the far end of whichever way it was already
    // walking.
    const targetX = presenting ? PODIUM.x : heading.current * PATROL_X;
    const targetZ = presenting ? PODIUM.z : LANE_Z;

    const dx = targetX - node.position.x;
    const dz = targetZ - node.position.z;
    const distance = Math.hypot(dx, dz);

    if (distance > ARRIVED) {
      const step = Math.min(distance, WALK_SPEED * delta);
      node.position.x += (dx / distance) * step;
      node.position.z += (dz / distance) * step;
      facing.current += angleDelta(facing.current, Math.atan2(dx, dz)) *
        Math.min(1, TURN_RATE * delta);
      if (!walking.current) {
        walking.current = true;
        current.idle?.fadeOut(0.3);
        current.walk?.reset().fadeIn(0.3).play();
      }
    } else if (presenting) {
      // Arrived at the podium: turn to the camera and stand.
      facing.current += angleDelta(facing.current, 0) * Math.min(1, TURN_RATE * delta);
      if (walking.current) {
        walking.current = false;
        current.walk?.fadeOut(0.35);
        current.idle?.reset().fadeIn(0.35).play();
      }
    } else {
      heading.current *= -1;
    }

    node.rotation.y = facing.current;
    current.mixer.update(delta);
  });

  return <group ref={host} scale={SCALE} />;
}
