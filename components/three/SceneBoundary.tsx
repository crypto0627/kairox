"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches anything the 3D scene throws.
 *
 * Without this a failed WebGL context or a model that will not load takes the
 * whole route down — the shell, the sidebar and the ticker with it, for a
 * decoration. The market data is the part that matters and it is all DOM, so
 * the floor degrades to a message and everything else keeps working.
 *
 * A class because error boundaries still have no hook equivalent.
 */
export class SceneBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("3D scene failed:", error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // WebGL unavailable is a different conversation from a broken asset, and
    // the visitor can do something about exactly one of them.
    const webgl = /webgl|context|gpu/i.test(error.message);

    return (
      <div className="absolute inset-0 z-0 grid place-items-center bg-void px-6">
        <div className="max-w-md rounded-2xl border border-amber-400/20 bg-amber-400/5 p-6 text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] text-amber-400 uppercase">
            Floor offline
          </p>
          <p className="mt-3 text-sm leading-relaxed text-hud-dim">
            {webgl
              ? "This browser could not open a WebGL context, so the trading floor cannot be drawn. Everything else on the page still works."
              : "The trading floor failed to load. The market data, the agents and their history are unaffected."}
          </p>
          <p className="mt-3 font-mono text-[10px] break-words text-hud-dim/60">
            {error.message.slice(0, 160)}
          </p>
        </div>
      </div>
    );
  }
}
