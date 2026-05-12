export type RenderSpecVersion = "1.0";

export type CompositionId = "branded-starter";

export type BackgroundSpec = {
  type: "solid";
  color: string;
};

export type BrandSpec = {
  name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_color: string;
  font_family: string;
  logo_path?: string;
  cta_text?: string;
};

export type SceneType = "title" | "content" | "cta";

export type AssetKind = "image" | "video" | "audio" | "font";

export type RenderAsset = {
  id: string;
  path: string;
  kind: AssetKind;
  role?: string;
};

export type AssetReference = string;

export type SceneSpec = {
  id: string;
  type: SceneType;
  duration_seconds: number;
  headline?: string;
  body?: string;
  asset_refs?: AssetReference[];
  background_color?: string;
};

export type OutputSpec = {
  basename: string;
  video_filename: string;
  thumbnail_filename: string;
  overwrite: boolean;
};

export type RenderSpecV1 = {
  render_spec_version: RenderSpecVersion;
  composition: CompositionId;
  title: string;
  duration_seconds: number;
  fps: number;
  width: number;
  height: number;
  background: BackgroundSpec;
  brand: BrandSpec;
  scenes: SceneSpec[];
  assets: {
    images?: RenderAsset[];
    videos?: RenderAsset[];
    audio?: RenderAsset[];
    fonts?: RenderAsset[];
  };
  output: OutputSpec;
};

export type RenderSpecInputProps = {
  renderSpec: RenderSpecV1;
};
