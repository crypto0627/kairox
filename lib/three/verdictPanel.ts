import { CanvasTexture, SRGBColorSpace } from "three";
import type { AgentState } from "@/lib/store/agentStore";
import type { Stance } from "@/lib/agent/types";

export const PANEL_W = 512;
export const PANEL_H = 208;

const FONT_DISPLAY =
  '"DIN Alternate", "Bahnschrift", "Avenir Next Condensed", system-ui, sans-serif';
const FONT_MONO = '"SF Mono", Menlo, Consolas, ui-monospace, monospace';

const STANCE_COLOUR: Record<Stance, string> = {
  long: "#00e5b0",
  short: "#ff2e88",
  flat: "#ffb347",
};
const INK = "#d7f5ff";
const INK_DIM = "#7d99a8";

/**
 * The badge over a trader's console.
 *
 * It used to carry the headline too, and at the size this panel actually
 * occupies on screen — a couple of hundred pixels, seen at an angle — that
 * text was unreadable. So it carries only what survives being small: the
 * instrument, the call, and how sure the agent is. The sentence, the
 * reasoning and the risk are one click away in the DOM inspector, where they
 * are crisp and selectable.
 */
export function drawVerdictPanel(
  canvas: HTMLCanvasElement,
  agent: AgentState,
  label: string,
  time: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, PANEL_W, PANEL_H);

  const accent =
    agent.phase === "thinking"
      ? "#8b5cf6"
      : agent.phase === "offline"
        ? "#5a6b7d"
        : STANCE_COLOUR[agent.stance];

  const bg = ctx.createLinearGradient(0, 0, 0, PANEL_H);
  bg.addColorStop(0, "rgba(10, 18, 32, 0.95)");
  bg.addColorStop(1, "rgba(5, 8, 15, 0.9)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, PANEL_W, PANEL_H);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 8, PANEL_H);

  ctx.letterSpacing = "6px";
  ctx.font = `28px ${FONT_DISPLAY}`;
  ctx.fillStyle = INK;
  ctx.fillText(label.toUpperCase(), 30, 48);
  ctx.letterSpacing = "0px";

  if (agent.phase === "thinking") {
    ctx.font = `44px ${FONT_DISPLAY}`;
    ctx.fillStyle = accent;
    ctx.fillText("THINKING", 30, 118);
    ctx.globalAlpha = 0.25 + Math.abs(Math.sin(time * 3)) * 0.6;
    ctx.fillRect(30, 142, PANEL_W - 60, 8);
    ctx.globalAlpha = 1;
  } else if (agent.phase === "offline") {
    ctx.font = `38px ${FONT_DISPLAY}`;
    ctx.fillStyle = INK_DIM;
    ctx.fillText("OFFLINE", 30, 114);
  } else {
    // The call, at the only size that reads across the room.
    ctx.font = `62px ${FONT_DISPLAY}`;
    ctx.fillStyle = accent;
    ctx.fillText(agent.stance.toUpperCase(), 30, 124);

    ctx.font = `20px ${FONT_MONO}`;
    ctx.fillStyle = INK_DIM;
    ctx.fillText(`conf ${agent.confidence.toFixed(2)}`, 30, 166);

    const barX = 176;
    const barW = PANEL_W - barX - 30;
    ctx.fillStyle = "rgba(125, 153, 168, 0.22)";
    ctx.fillRect(barX, 150, barW, 12);
    ctx.fillStyle = accent;
    ctx.fillRect(barX, 150, barW * agent.confidence, 12);
  }

  ctx.strokeStyle = "rgba(0, 229, 255, 0.36)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, PANEL_W - 2, PANEL_H - 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  for (const [cx, cy, sx, sy] of [
    [PANEL_W - 7, 7, -1, 1],
    [PANEL_W - 7, PANEL_H - 7, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 24, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * 24);
    ctx.stroke();
  }
}

export function createVerdictTexture(): { canvas: HTMLCanvasElement; texture: CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = PANEL_W;
  canvas.height = PANEL_H;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return { canvas, texture };
}
