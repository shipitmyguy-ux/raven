import type { RavenTrack } from "./generation-contract.ts";

export interface TrackWritingPolicy {
  track: RavenTrack;
  framing: "game_strict" | "transferable" | "labor_concrete";
  emphasizeShippedTitles: boolean;
  guidance: string[];
}

const transferable = [
  "Translate verified experience into broadly understood delivery, coordination, documentation, leadership, process and cross-functional language.",
  "Do not center shipped game titles or game-production minutiae unless the target job makes them relevant.",
  "Never invent qualifications; reframing changes language, not facts."
];

export const TRACK_WRITING_POLICIES: Record<RavenTrack, TrackWritingPolicy> = {
  "Games / 3D": {
    track: "Games / 3D",
    framing: "game_strict",
    emphasizeShippedTitles: true,
    guidance: [
      "Preserve canonical role, employer, project and shipped-title attribution.",
      "Prioritize relevant environment/3D workflows, tools and production accomplishments supported by verified evidence.",
      "Never invent qualifications or move facts between employers/projects."
    ]
  },
  Professional: { track: "Professional", framing: "transferable", emphasizeShippedTitles: false, guidance: transferable },
  Wildcard: { track: "Wildcard", framing: "transferable", emphasizeShippedTitles: false, guidance: transferable },
  Labor: {
    track: "Labor",
    framing: "labor_concrete",
    emphasizeShippedTitles: false,
    guidance: [
      "Use concise, concrete language around verified hands-on work, reliability, maintenance, safety, tools and execution.",
      "Avoid game-industry detail unless it directly supports the target role.",
      "Never invent qualifications; reframing changes language, not facts."
    ]
  }
};
