import type { ReactNode } from "react";
import { AudioProvider } from "@/lib/audio/AudioProvider";
import { Sidebar } from "@/components/ui/Sidebar";
import { MusicToggle } from "@/components/ui/MusicToggle";
import { AgentInspector } from "@/components/ui/AgentInspector";
import { SceneCanvas } from "@/components/three/SceneCanvas";

/**
 * The persistent shell.
 *
 * SceneCanvas and AudioProvider mount here, not in a page, so navigating
 * between Dashboard / Report / History / Profile swaps only {children}:
 * the WebGL context, the scene graph, the open sockets and the audio
 * element all survive the route change.
 */
export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <AudioProvider src="/audio/synthwave-house-loop">
      <div className="relative h-dvh w-dvw overflow-hidden bg-void">
        {/* z-0 — the 3D room */}
        <SceneCanvas />

        {/* z-10 — page content, transparent to pointer events so the
            camera can be dragged from anywhere on screen */}
        <main className="pointer-events-none absolute inset-0 z-10">
          {children}
        </main>

        {/* z-20 — navigation */}
        <Sidebar />

        {/* z-30 — the agent you clicked on the floor */}
        <AgentInspector />

        {/* z-50 — above everything, on every page */}
        <MusicToggle />
      </div>
    </AudioProvider>
  );
}
