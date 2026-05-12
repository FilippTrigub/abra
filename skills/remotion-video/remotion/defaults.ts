import type {RenderSpecV1} from "./types";

export const DEFAULT_COMPOSITION_ID = "branded-starter" as const;

export const DEFAULT_RENDER_SPEC: RenderSpecV1 = {
  render_spec_version: "1.0",
  composition: DEFAULT_COMPOSITION_ID,
  title: "Branded starter",
  duration_seconds: 3,
  fps: 30,
  width: 1080,
  height: 1920,
  background: {
    type: "solid",
    color: "#0B1020",
  },
  brand: {
    name: "Abra",
    primary_color: "#F5B83D",
    secondary_color: "#111827",
    accent_color: "#E5E7EB",
    text_color: "#F9FAFB",
    font_family: "Inter",
    cta_text: "Follow the story",
  },
  scenes: [
    {
      id: "opening",
      type: "title",
      duration_seconds: 1,
      headline: "A branded starter",
      body: "Versioned props, stable timing, deterministic output.",
    },
    {
      id: "middle",
      type: "content",
      duration_seconds: 1,
      headline: "One composition only",
      body: "The render spec drives dimensions, colors, and copy.",
    },
    {
      id: "closing",
      type: "cta",
      duration_seconds: 1,
      headline: "Ready for rendering",
      body: "Task 6 will plug in the Node renderer.",
    },
  ],
  assets: {
    images: [],
    videos: [],
    audio: [],
    fonts: [],
  },
  output: {
    basename: "branded-starter",
    video_filename: "branded-starter.mp4",
    thumbnail_filename: "branded-starter.png",
    overwrite: true,
  },
};
