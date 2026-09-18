"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  AnimationClip,
  AnimationMixer,
  Color,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from "three";
import { SkeletonUtils } from "three-stdlib";

const MODEL = "/models/robot-trader.glb";
useGLTF.preload(MODEL);

export interface RobotTraderProps {
  /** Per-seat 0..1 value: varies animation phase and reaction speed. */
  seed: number;
  /** Which instrument drives this seat's glow. */
  symbolId: string;
  /**
   * Live sentiment by symbol id, written outside React render. Read only
   * inside useFrame so a price tick never re-renders the 3D tree.
   */
  sentimentRef: RefObject<Record<string, number>>;
}

const UP = new Color("#00e5b0");
const DOWN = new Color("#ff2e88");

/**
 * Material map for the source rig, which ships three: "Main" is the large
 * body panelling, "Grey" the structural frame, and "Black" the face — a small
 * plate on the head, which is exactly the surface that should carry the
 * instrument's colour.
 *
 * Main keeps a worn amber rather than going teal like everything else. The
 * room is cyan and magenta throughout, and Night City's signature is warm
 * against cold; five amber chassis are what stops the floor reading as a
 * single blue wash.
 */
const CHASSIS = new Color("#8a4418");
const FRAME = new Color("#1b2330");
const VISOR_BASE = new Color("#05070b");

/** Measured on screen: the rig is ~4.4 units tall, so this lands it at 1.85. */
const SCALE = 0.42;
const CLIP = "Idle";

interface Rig {
  mixer: AnimationMixer;
  glow: MeshStandardMaterial[];
}

/**
 * One robot trader: the CC0 RobotExpressive rig, re-skinned to the room's
 * palette and paced by its instrument.
 *
 * It faces −z, into its console and the screen array beyond, so the camera
 * sees its back. That is both the shot we want and what fixes the occlusion:
 * the desk and monitor now sit *behind* the body rather than in front of it,
 * where they used to hide everything but a floating visor.
 *
 * The rig is built and driven imperatively. A skinned clone, its mixer and
 * its materials are external state that React should not own, and keeping
 * them in a ref means a price tick costs a lerp rather than a re-render.
 */
export function RobotTrader({ seed, symbolId, sentimentRef }: RobotTraderProps) {
  const host = useRef<Group>(null);
  const rig = useRef<Rig | null>(null);
  const { scene, animations } = useGLTF(MODEL);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;

    // SkeletonUtils.clone is the only clone that carries bones and skinned
    // meshes correctly — Object3D.clone() shares the skeleton, and all five
    // seats would then animate as a single puppet.
    const model = SkeletonUtils.clone(scene) as Group;
    const glow: MeshStandardMaterial[] = [];

    model.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Source materials are shared, so clone before tinting; otherwise
      // recolouring one seat recolours the whole row.
      const material = (mesh.material as MeshStandardMaterial).clone();
      material.emissive = new Color("#00e5b0");

      if (material.name === "Black") {
        // The face. Only this glows — lighting the body panels turned each
        // robot into a featureless lamp once Bloom got hold of it.
        material.color.copy(VISOR_BASE);
        material.metalness = 0.2;
        material.roughness = 0.25;
        material.emissiveIntensity = 2.4;
        glow.push(material);
      } else if (material.name === "Main") {
        material.color.copy(CHASSIS);
        material.metalness = 0.74;
        material.roughness = 0.44;
        material.emissiveIntensity = 0;
      } else {
        material.color.copy(FRAME);
        material.metalness = 0.88;
        material.roughness = 0.3;
        material.emissiveIntensity = 0;
      }

      mesh.material = material;
    });

    parent.add(model);

    const mixer = new AnimationMixer(model);
    const clip = AnimationClip.findByName(animations, CLIP);
    if (clip) {
      mixer.clipAction(clip).play();
      // Desync the row: without this all five breathe in lockstep, which
      // reads as one puppet copied five times.
      mixer.setTime(seed * clip.duration);
    }

    rig.current = { mixer, glow };

    return () => {
      rig.current = null;
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      parent.remove(model);
      for (const material of glow) material.dispose();
    };
  }, [scene, animations, seed]);

  useFrame((_, delta) => {
    const current = rig.current;
    if (!current) return;

    const change = sentimentRef.current?.[symbolId] ?? 0;
    // A moving instrument makes its trader restless.
    const urgency = Math.min(1.9, 1 + Math.abs(change) * 0.35);
    current.mixer.update(delta * (0.82 + seed * 0.34) * urgency);

    const tint = change < 0 ? DOWN : UP;
    for (const material of current.glow) material.emissive.lerp(tint, 0.06);
  });

  return <group ref={host} scale={SCALE} rotation={[0, Math.PI, 0]} />;
}
