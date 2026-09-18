"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  AnimationClip,
  AnimationMixer,
  Color,
  LoopOnce,
  type AnimationAction,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
} from "three";
import { SkeletonUtils } from "three-stdlib";
import { agentOf, useAgentStore } from "@/lib/store/agentStore";
import type { Stance } from "@/lib/agent/types";

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

/**
 * Visor palette — the agent's stance, not the tape.
 *
 * Before the agent layer this glowed with the price change, which is
 * something the panel behind it already says. What a trader's face should
 * carry is what the trader thinks, so long/short/flat drive it now and
 * "thinking" gets its own colour while the model is mid-call.
 */
const STANCE_COLOUR: Record<Stance, Color> = {
  long: new Color("#00e5b0"),
  short: new Color("#ff2e88"),
  flat: new Color("#ffb347"),
};
const THINKING = new Color("#8b5cf6");
/** Scratch target for the per-frame lerp; used and consumed within one frame. */
const TARGET = new Color();
const OFFLINE = new Color("#243040");

/** Reaction clips, from the rig's own set. */
const REACTION: Record<Stance, string> = {
  long: "ThumbsUp",
  short: "No",
  flat: "Wave",
};

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
  idle: AnimationAction | null;
  reactions: Partial<Record<Stance, AnimationAction>>;
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
  /** decidedAt of the verdict already reacted to, so each one fires once. */
  const spokenAt = useRef(0);
  const reacting = useRef(false);
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

    const idleClip = AnimationClip.findByName(animations, CLIP);
    let idle: AnimationAction | null = null;
    if (idleClip) {
      idle = mixer.clipAction(idleClip);
      idle.play();
      // Desync the row: without this all five breathe in lockstep, which
      // reads as one puppet copied five times.
      mixer.setTime(seed * idleClip.duration);
    }

    // One-shot reaction clips. They clamp on the last frame and are faded
    // back to idle by the mixer's finished event, so a verdict produces a
    // gesture rather than a permanent pose.
    const reactions: Partial<Record<Stance, AnimationAction>> = {};
    for (const [stance, name] of Object.entries(REACTION) as [Stance, string][]) {
      const clip = AnimationClip.findByName(animations, name);
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      reactions[stance] = action;
    }

    const onFinished = () => {
      const current = rig.current;
      if (!current) return;
      reacting.current = false;
      for (const action of Object.values(current.reactions)) action?.fadeOut(0.35);
      current.idle?.reset().fadeIn(0.35).play();
    };
    mixer.addEventListener("finished", onFinished);

    rig.current = { mixer, glow, idle, reactions };

    return () => {
      rig.current = null;
      mixer.removeEventListener("finished", onFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      parent.remove(model);
      for (const material of glow) material.dispose();
    };
  }, [scene, animations, seed]);

  useFrame(({ clock }, delta) => {
    const current = rig.current;
    if (!current) return;

    const change = sentimentRef.current?.[symbolId] ?? 0;
    // A moving instrument makes its trader restless.
    const urgency = Math.min(1.9, 1 + Math.abs(change) * 0.35);
    // Reactions play at their own pace; only the idle loop is rate-scaled.
    const rate = reacting.current ? 1 : (0.82 + seed * 0.34) * urgency;
    current.mixer.update(delta * rate);

    // getState rather than a subscription: this runs every frame anyway, and
    // a verdict landing must not re-render the 3D tree.
    const agent = agentOf(useAgentStore.getState().agents, symbolId);

    if (agent.decidedAt > spokenAt.current) {
      spokenAt.current = agent.decidedAt;
      const action = current.reactions[agent.stance];
      if (action) {
        reacting.current = true;
        current.idle?.fadeOut(0.25);
        action.reset().setEffectiveWeight(1).fadeIn(0.25).play();
      }
    }

    let tint: Color;
    if (agent.phase === "offline" || agent.phase === "standby") tint = OFFLINE;
    else if (agent.phase === "thinking") tint = THINKING;
    else if (agent.phase === "spoken") tint = STANCE_COLOUR[agent.stance];
    else tint = STANCE_COLOUR.flat;

    // A thinking agent pulses; a settled one burns steady. The pulse is baked
    // into the emissive colour rather than emissiveIntensity — the intensity
    // is a plain property, and assigning to one on a material the effect owns
    // is exactly the kind of mutation the compiler rules refuse.
    const thinking = agent.phase === "thinking";
    const pulse = thinking
      ? 0.5 + Math.abs(Math.sin(clock.elapsedTime * 4 + seed * 6)) * 0.85
      : 1;
    TARGET.copy(tint).multiplyScalar(pulse);

    for (const material of current.glow) {
      material.emissive.lerp(TARGET, thinking ? 0.2 : 0.06);
    }
  });

  return <group ref={host} scale={SCALE} rotation={[0, Math.PI, 0]} />;
}
