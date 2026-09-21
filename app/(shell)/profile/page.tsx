import { ScreenDoc } from "@/components/ui/ScreenDoc";
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
    <ScreenDoc>
        <p className="font-mono text-[10px] tracking-[0.35em] text-neon-magenta uppercase">
          Agent Floor
        </p>
        <h1 className="font-display mt-1 text-3xl tracking-[0.18em] text-hud uppercase">
          Profile
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-hud-dim">
          What each agent is told to look for, how often finished calls are
          graded, and the ceiling on how much thinking the floor may do in an
          hour. Agents analyse only when asked — click a trader and press
          ANALYSE NOW. The cap is a hard stop held in the server&apos;s memory
          rather than derived from the log, so it still holds when the database
          does not.
        </p>

        <FloorSettingsForm initial={settings} />
    </ScreenDoc>
  );
}
