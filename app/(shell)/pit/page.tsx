import { PitCaption } from "@/components/ui/PitCaption";

export const dynamic = "force-dynamic";

/**
 * The Pit is a room, not a document — the order book and the intel wall are
 * both in the scene. All this route contributes is the caption that names
 * what you are looking at and where the numbers come from.
 */
export default function PitPage() {
  return <PitCaption />;
}
