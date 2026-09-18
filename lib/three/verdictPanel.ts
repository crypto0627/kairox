import { CanvasTexture, SRGBColorSpace } from "three";
import type { AgentState } from "@/lib/store/agentStore";
import type { Stance } from "@/lib/agent/types";

export const PANEL_W = 512;
export const PANEL_H = 176;

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

/** Wrap to at most `maxLines`, ellipsising the last one. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);

  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth) {
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

/**
 * The speech panel that hangs over a trader's console.
 *
 * Deliberately thin on content: at this distance the panel is a couple of
 * hundred screen pixels, so it carries the call, the confidence and one line
 * of why. The reasoning and the risk live in the History log, where there is
 * room to read them.
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

  // ground
  const bg = ctx.createLinearGradient(0, 0, 0, PANEL_H);
  bg.addColorStop(0, "rgba(10, 18, 32, 0.93)");
  bg.addColorStop(1, "rgba(5, 8, 15, 0.88)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, PANEL_W, PANEL_H);

  // accent spine down the left edge
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 6, PANEL_H);

  // instrument
  ctx.letterSpacing = "4px";
  ctx.font = `20px ${FONT_DISPLAY}`;
  ctx.fillStyle = INK;
  ctx.fillText(label.toUpperCase(), 24, 34);
  ctx.letterSpacing = "0px";

  if (agent.phase === "thinking") {
    // A pulsing line rather than a spinner: one draw call, and it reads as
    // "working" from across the room.
    ctx.font = `17px ${FONT_MONO}`;
    ctx.fillStyle = accent;
    const dots = ".".repeat(1 + (Math.floor(time * 2) % 3));
    ctx.fillText(`ANALYSING${dots}`, 24, 78);
    ctx.globalAlpha = 0.25 + Math.abs(Math.sin(time * 3)) * 0.5;
    ctx.fillRect(24, 96, PANEL_W - 48, 3);
    ctx.globalAlpha = 1;
  } else if (agent.phase === "offline") {
    ctx.font = `17px ${FONT_MONO}`;
    ctx.fillStyle = INK_DIM;
    ctx.fillText("AGENT OFFLINE", 24, 78);
    ctx.font = `13px ${FONT_MONO}`;
    for (const [i, line] of wrap(ctx, agent.error ?? "", PANEL_W - 48, 2).entries()) {
      ctx.fillText(line, 24, 104 + i * 18);
    }
  } else {
    // stance chip
    ctx.font = `bold 17px ${FONT_MONO}`;
    const stanceText = agent.stance.toUpperCase();
    const chipW = ctx.measureText(stanceText).width + 22;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(24, 50, chipW, 26);
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    ctx.fillText(stanceText, 35, 69);

    // confidence, as a number and a bar — the bar is readable at a distance
    // where the digits are not.
    ctx.font = `13px ${FONT_MONO}`;
    ctx.fillStyle = INK_DIM;
    ctx.fillText(`conf ${agent.confidence.toFixed(2)}`, 34 + chipW, 69);
    const barX = 34 + chipW + 86;
    const barW = PANEL_W - barX - 24;
    ctx.fillStyle = "rgba(125, 153, 168, 0.22)";
    ctx.fillRect(barX, 59, barW, 8);
    ctx.fillStyle = accent;
    ctx.fillRect(barX, 59, barW * agent.confidence, 8);

    // headline
    ctx.font = `19px ${FONT_DISPLAY}`;
    ctx.fillStyle = INK;
    for (const [i, line] of wrap(ctx, agent.headline, PANEL_W - 48, 2).entries()) {
      ctx.fillText(line, 24, 110 + i * 26);
    }
  }

  // frame + corner ticks
  ctx.strokeStyle = "rgba(0, 229, 255, 0.34)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, PANEL_W - 2, PANEL_H - 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  for (const [cx, cy, sx, sy] of [
    [PANEL_W - 6, 6, -1, 1],
    [PANEL_W - 6, PANEL_H - 6, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 18, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * 18);
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
