import {
  FloorSettingsForm,
  type Settings,
} from "@/components/ui/FloorSettingsForm";
import { SYMBOLS } from "@/lib/market/symbols";
import { hasDatabase } from "@/lib/db/client";
import { DEFAULT_FLOOR, readSettings } from "@/lib/db/config";
import { agentProvider, callsThisHour } from "@/lib/agent";

export const dynamic = "force-dynamic";

function activeProvider() {
  try {
    const provider = agentProvider();
    return { id: provider.id, model: provider.model };
  } catch (error) {
    return { id: "unconfigured", model: String(error).slice(0, 80) };
  }
}

async function load(): Promise<Settings> {
  const fallback: Settings = {
    floor: DEFAULT_FLOOR,
    agents: SYMBOLS.map((spec) => ({ symbolId: spec.id, persona: "", enabled: true })),
    callsThisHour: callsThisHour(),
    provider: activeProvider(),
    persisted: false,
  };
  if (!hasDatabase()) return fallback;
  try {
    const settings = await readSettings();
    return { ...fallback, ...settings, persisted: true };
  } catch {
    // The floor runs on defaults when its settings are unreachable; the form
    // says so rather than pretending the blanks are what is configured.
    return fallback;
  }
}

export default async function ProfilePage() {
  const settings = await load();

  return (
    <div className="pointer-events-auto h-full overflow-y-auto py-8 pr-8 pl-72 pb-28">
      <div
        className={[
          "mx-auto max-w-4xl rounded-2xl border border-white/10 p-8",
          "bg-void/85 backdrop-blur-2xl ring-1 ring-neon-cyan/10 ring-inset",
          "shadow-[0_0_90px_-35px_rgba(0,229,255,0.55)]",
        ].join(" ")}
      >
        <p className="font-mono text-[10px] tracking-[0.35em] text-neon-magenta uppercase">
          Agent Floor
        </p>
        <h1 className="font-display mt-1 text-3xl tracking-[0.18em] text-hud uppercase">
          Profile
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-hud-dim">
          How often the floor thinks, what each agent is told to look for, and
          the ceiling on how much thinking it may do in an hour. The cap is a
          hard stop held in the server&apos;s memory rather than derived from the
          log, so it still holds when the database does not.
        </p>

        <FloorSettingsForm initial={settings} />
      </div>
    </div>
  );
}
