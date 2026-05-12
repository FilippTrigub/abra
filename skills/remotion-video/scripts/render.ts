import {access, copyFile, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {createReadStream} from "node:fs";
import {createServer} from "node:http";
import {fileURLToPath} from "node:url";
import path from "node:path";

import {bundle} from "@remotion/bundler";
import {renderMedia, renderStill, selectComposition} from "@remotion/renderer";

type CliOptions = {
  specPath: string;
  sourceSpecPath: string;
  outputDir: string;
  videoPath: string;
  thumbnailPath: string;
  manifestPath: string;
};

type RenderAsset = {
  id: string;
  path: string;
  kind: "image" | "video" | "audio" | "font";
  role?: string;
};

type RenderSpec = {
  render_spec_version: "1.0";
  composition: "branded-starter";
  title: string;
  duration_seconds: number;
  fps: number;
  width: number;
  height: number;
  background: {
    type: "solid";
    color: string;
  };
  brand: {
    name: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    text_color: string;
    font_family: string;
    logo_path?: string;
    cta_text?: string;
  };
  scenes: Array<{
    id: string;
    type: "title" | "content" | "cta";
    duration_seconds: number;
    headline?: string;
    body?: string;
    asset_refs?: string[];
    background_color?: string;
  }>;
  assets: {
    images?: RenderAsset[];
    videos?: RenderAsset[];
    audio?: RenderAsset[];
    fonts?: RenderAsset[];
  };
  output: {
    basename: string;
    video_filename: string;
    thumbnail_filename: string;
    overwrite: boolean;
  };
};

type RenderManifest = {
  manifest_version: "1.0";
  render_id: string;
  composition: string;
  video_path: string;
  thumbnail_path: string;
  duration_seconds: number;
  fps: number;
  width: number;
  height: number;
  created_at: string;
  warnings: string[];
  source_spec_path: string;
};

type StaticAssetServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(SCRIPT_DIR, "..");
const ENTRY_POINT = path.resolve(SKILL_DIR, "remotion/Root.tsx");
const COMPOSITION_ID = "branded-starter" as const;

function usage(): void {
  console.log(
    "Usage: npm run render -- --spec <path> --source-spec-path <path> --output-dir <dir> --video-path <path> --thumbnail-path <path> --manifest-path <path>",
  );
}

function parseArgs(argv: string[]): CliOptions {
  if (argv.includes("--help")) {
    usage();
    process.exit(0);
  }

  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current?.startsWith("--")) {
      throw new Error(`Unexpected argument: ${current ?? "<empty>"}`);
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for ${current}`);
    }

    values.set(current, next);
    index += 1;
  }

  const specPath = values.get("--spec");
  const sourceSpecPath = values.get("--source-spec-path");
  const outputDir = values.get("--output-dir");
  const videoPath = values.get("--video-path");
  const thumbnailPath = values.get("--thumbnail-path");
  const manifestPath = values.get("--manifest-path");

  if (!specPath || !sourceSpecPath || !outputDir || !videoPath || !thumbnailPath || !manifestPath) {
    throw new Error("Missing required render arguments.");
  }

  return {specPath, sourceSpecPath, outputDir, videoPath, thumbnailPath, manifestPath};
}

function isBrowserUrl(value: string): boolean {
  return /^(?:https?:|data:|blob:|file:|\/)/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid render spec: ${label} must be a non-empty string`);
  }

  return value;
}

function asNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid render spec: ${label} must be a positive number`);
  }

  return value;
}

function asInteger(value: unknown, label: string): number {
  const numberValue = asNumber(value, label);
  if (!Number.isInteger(numberValue)) {
    throw new Error(`Invalid render spec: ${label} must be an integer`);
  }

  return numberValue;
}

function relToSkillDir(targetPath: string): string {
  return path.relative(SKILL_DIR, targetPath).split(path.sep).join("/");
}

function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "asset";
}

async function loadJson(pathname: string): Promise<unknown> {
  const fileContents = await readFile(pathname, "utf8");
  return JSON.parse(fileContents) as unknown;
}

function validateRenderSpec(rawSpec: unknown): RenderSpec {
  if (!isRecord(rawSpec)) {
    throw new Error("Invalid render spec: top-level JSON must be an object");
  }

  const renderSpecVersion = asString(rawSpec.render_spec_version, "render_spec_version");
  if (renderSpecVersion !== "1.0") {
    throw new Error(`Invalid render spec: render_spec_version must be \"1.0\" (got ${renderSpecVersion})`);
  }

  const composition = asString(rawSpec.composition, "composition");
  if (composition !== COMPOSITION_ID) {
    throw new Error(`Invalid render spec: composition must be \"${COMPOSITION_ID}\" (got ${composition})`);
  }

  const background = rawSpec.background;
  if (!isRecord(background)) {
    throw new Error("Invalid render spec: background must be an object");
  }

  const brand = rawSpec.brand;
  if (!isRecord(brand)) {
    throw new Error("Invalid render spec: brand must be an object");
  }

  const scenes = rawSpec.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error("Invalid render spec: scenes must be a non-empty array");
  }

  const assets = rawSpec.assets;
  if (!isRecord(assets)) {
    throw new Error("Invalid render spec: assets must be an object");
  }

  const output = rawSpec.output;
  if (!isRecord(output)) {
    throw new Error("Invalid render spec: output must be an object");
  }

  const normalizedScenes = scenes.map((scene, index) => {
    if (!isRecord(scene)) {
      throw new Error(`Invalid render spec: scenes[${index}] must be an object`);
    }

    const normalized: RenderSpec["scenes"][number] = {
      id: asString(scene.id, `scenes[${index}].id`),
      type: asString(scene.type, `scenes[${index}].type`) as RenderSpec["scenes"][number]["type"],
      duration_seconds: asNumber(scene.duration_seconds, `scenes[${index}].duration_seconds`),
    };

    if (scene.headline !== undefined) {
      normalized.headline = asString(scene.headline, `scenes[${index}].headline`);
    }
    if (scene.body !== undefined) {
      normalized.body = asString(scene.body, `scenes[${index}].body`);
    }
    if (Array.isArray(scene.asset_refs)) {
      normalized.asset_refs = scene.asset_refs.map((assetRef, assetIndex) =>
        asString(assetRef, `scenes[${index}].asset_refs[${assetIndex}]`),
      );
    }
    if (scene.background_color !== undefined) {
      normalized.background_color = asString(scene.background_color, `scenes[${index}].background_color`);
    }

    return normalized;
  });

  const normalizedAssets: RenderSpec["assets"] = {};
  for (const groupName of ["images", "videos", "audio", "fonts"] as const) {
    const group = assets[groupName];
    if (group === undefined) {
      continue;
    }
    if (!Array.isArray(group)) {
      throw new Error(`Invalid render spec: assets.${groupName} must be an array`);
    }

    normalizedAssets[groupName] = group.map((asset, index) => {
      if (!isRecord(asset)) {
        throw new Error(`Invalid render spec: assets.${groupName}[${index}] must be an object`);
      }

      const normalizedAsset: RenderAsset = {
        id: asString(asset.id, `assets.${groupName}[${index}].id`),
        path: asString(asset.path, `assets.${groupName}[${index}].path`),
        kind: asString(asset.kind, `assets.${groupName}[${index}].kind`) as RenderAsset["kind"],
      };

      if (asset.role !== undefined) {
        normalizedAsset.role = asString(asset.role, `assets.${groupName}[${index}].role`);
      }

      return normalizedAsset;
    });
  }

  const normalizedBrand = {
    name: asString(brand.name, "brand.name"),
    primary_color: asString(brand.primary_color, "brand.primary_color"),
    secondary_color: asString(brand.secondary_color, "brand.secondary_color"),
    accent_color: asString(brand.accent_color, "brand.accent_color"),
    text_color: asString(brand.text_color, "brand.text_color"),
    font_family: asString(brand.font_family, "brand.font_family"),
  } as RenderSpec["brand"];

  if (brand.logo_path !== undefined) {
    normalizedBrand.logo_path = asString(brand.logo_path, "brand.logo_path");
  }
  if (brand.cta_text !== undefined) {
    normalizedBrand.cta_text = asString(brand.cta_text, "brand.cta_text");
  }

  const normalizedOutput = {
    basename: asString(output.basename, "output.basename"),
    video_filename: asString(output.video_filename, "output.video_filename"),
    thumbnail_filename: asString(output.thumbnail_filename, "output.thumbnail_filename"),
    overwrite: (() => {
      if (typeof output.overwrite !== "boolean") {
        throw new Error("Invalid render spec: output.overwrite must be a boolean");
      }

      return output.overwrite;
    })(),
  } satisfies RenderSpec["output"];

  return {
    render_spec_version: renderSpecVersion,
    composition: composition as RenderSpec["composition"],
    title: asString(rawSpec.title, "title"),
    duration_seconds: asNumber(rawSpec.duration_seconds, "duration_seconds"),
    fps: asInteger(rawSpec.fps, "fps"),
    width: asInteger(rawSpec.width, "width"),
    height: asInteger(rawSpec.height, "height"),
    background: {
      type: asString(background.type, "background.type") as RenderSpec["background"]["type"],
      color: asString(background.color, "background.color"),
    },
    brand: normalizedBrand,
    scenes: normalizedScenes,
    assets: normalizedAssets,
    output: normalizedOutput,
  };
}

async function copyBrowserAssets(
  spec: RenderSpec,
  specPath: string,
  publicDir: string,
  assetBaseUrl: string,
): Promise<RenderSpec> {
  const stagedSpec = JSON.parse(JSON.stringify(spec)) as RenderSpec;
  const cache = new Map<string, string>();

  const stagePath = async (sourcePath: string, relativeDir: string, label: string): Promise<string> => {
    const resolvedSource = path.isAbsolute(sourcePath)
      ? sourcePath
      : path.resolve(path.dirname(specPath), sourcePath);
    const cacheKey = path.normalize(resolvedSource);
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const destinationDir = path.join(publicDir, relativeDir);
    await mkdir(destinationDir, {recursive: true});

    const sourceName = path.parse(resolvedSource).name;
    const suffix = path.parse(resolvedSource).ext;
    const safeLabel = slugify(label || sourceName);
    let fileName = `${safeLabel}${suffix}`;
    let destinationPath = path.join(destinationDir, fileName);
    let counter = 1;
    while (true) {
      try {
        await access(destinationPath);
        fileName = `${safeLabel}-${counter}${suffix}`;
        destinationPath = path.join(destinationDir, fileName);
        counter += 1;
      } catch {
        break;
      }
    }

    try {
      await copyFile(resolvedSource, destinationPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Missing staged asset: ${resolvedSource}`);
      }

      throw error;
    }

    const relativePath = path.relative(publicDir, destinationPath).split(path.sep).join("/");
    const browserPath = new URL(relativePath, assetBaseUrl.endsWith("/") ? assetBaseUrl : `${assetBaseUrl}/`).href;
    cache.set(cacheKey, browserPath);
    return browserPath;
  };

  if (stagedSpec.brand.logo_path && !isBrowserUrl(stagedSpec.brand.logo_path)) {
    stagedSpec.brand.logo_path = await stagePath(
      stagedSpec.brand.logo_path,
      "brand",
      `brand-logo-${path.parse(stagedSpec.brand.logo_path).name}`,
    );
  }

  for (const [groupName, relativeDir] of [
    ["images", "assets/images"],
    ["videos", "assets/videos"],
    ["audio", "assets/audio"],
    ["fonts", "assets/fonts"],
  ] as const) {
    const group = stagedSpec.assets[groupName];
    if (!group) {
      continue;
    }

    for (const asset of group) {
      if (!asset.path || isBrowserUrl(asset.path)) {
        continue;
      }

      asset.path = await stagePath(asset.path, relativeDir, `${asset.id}-${path.parse(asset.path).name}`);
    }
  }

  return stagedSpec;
}

async function startStaticAssetServer(rootDir: string): Promise<StaticAssetServer> {
  const resolvedRoot = path.resolve(rootDir);
  const server = createServer((request, response) => {
    if (!request.url || !["GET", "HEAD"].includes(request.method ?? "GET")) {
      response.statusCode = 405;
      response.end("Method Not Allowed");
      return;
    }

    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
    const absolutePath = path.resolve(resolvedRoot, relativePath);
    const normalizedRoot = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;

    if (absolutePath !== resolvedRoot && !absolutePath.startsWith(normalizedRoot)) {
      response.statusCode = 403;
      response.end("Forbidden");
      return;
    }

    if ((request.method ?? "GET") === "HEAD") {
      response.statusCode = 200;
      response.end();
      return;
    }

    const contentTypeByExtension: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    };
    const contentType = contentTypeByExtension[path.extname(absolutePath).toLowerCase()] ?? "application/octet-stream";
    response.statusCode = 200;
    response.setHeader("Content-Type", contentType);

    const stream = createReadStream(absolutePath);
    stream.on("error", () => {
      if (!response.headersSent) {
        response.statusCode = 404;
      }
      response.end("Not Found");
    });
    stream.pipe(response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to determine static asset server port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function writeManifest(args: {
  manifestPath: string;
  videoPath: string;
  thumbnailPath: string;
  specPath: string;
  sourceSpecPath: string;
  spec: RenderSpec;
}): Promise<void> {
  const manifest: RenderManifest = {
    manifest_version: "1.0",
    render_id: args.spec.output.basename,
    composition: args.spec.composition,
    video_path: relToSkillDir(args.videoPath),
    thumbnail_path: relToSkillDir(args.thumbnailPath),
    duration_seconds: args.spec.duration_seconds,
    fps: args.spec.fps,
    width: args.spec.width,
    height: args.spec.height,
    created_at: new Date().toISOString(),
    warnings: [],
    source_spec_path: relToSkillDir(args.sourceSpecPath),
  };

  await mkdir(path.dirname(args.manifestPath), {recursive: true});
  await writeFile(args.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function cleanupArtifacts(paths: string[]): Promise<void> {
  await Promise.all(paths.map(async (targetPath) => rm(targetPath, {force: true})));
}

async function main(): Promise<number> {
  let cli: CliOptions | undefined;
  let assetServer: StaticAssetServer | undefined;
  try {
    cli = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    usage();
    return 1;
  }

  try {
    const rawSpec = await loadJson(cli.specPath);
    const spec = validateRenderSpec(rawSpec);

    const stagedPublicDir = path.join(path.dirname(cli.specPath), "public");
    await mkdir(stagedPublicDir, {recursive: true});
    assetServer = await startStaticAssetServer(stagedPublicDir);
    const browserSpec = await copyBrowserAssets(spec, cli.specPath, stagedPublicDir, assetServer.baseUrl);

    await mkdir(cli.outputDir, {recursive: true});
    await mkdir(path.dirname(cli.videoPath), {recursive: true});
    await mkdir(path.dirname(cli.thumbnailPath), {recursive: true});
    await mkdir(path.dirname(cli.manifestPath), {recursive: true});

    console.log(`Bundling Remotion entry point: ${ENTRY_POINT}`);
    const serveUrl = await bundle({
      entryPoint: ENTRY_POINT,
    });

    console.log(`Selecting composition: ${browserSpec.composition}`);
    const composition = await selectComposition({
      serveUrl,
      id: browserSpec.composition,
      inputProps: {renderSpec: browserSpec},
    });

    console.log(`Rendering video: ${cli.videoPath}`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: cli.videoPath,
      inputProps: {renderSpec: browserSpec},
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
    });

    console.log(`Rendering thumbnail: ${cli.thumbnailPath}`);
    await renderStill({
      composition,
      serveUrl,
      output: cli.thumbnailPath,
      inputProps: {renderSpec: browserSpec},
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
    });

    await writeManifest({
      manifestPath: cli.manifestPath,
      videoPath: cli.videoPath,
      thumbnailPath: cli.thumbnailPath,
      specPath: cli.specPath,
      sourceSpecPath: cli.sourceSpecPath,
      spec: spec,
    });

    console.log(`Manifest written: ${cli.manifestPath}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);

    try {
      await cleanupArtifacts([cli?.videoPath ?? "", cli?.thumbnailPath ?? "", cli?.manifestPath ?? ""].filter(Boolean));
    } catch (cleanupError) {
      console.error(cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
    }

    return 1;
  } finally {
    if (assetServer) {
      try {
        await assetServer.close();
      } catch {
        // Best-effort cleanup only.
      }
    }
  }
}

void main().then((exitCode) => {
  process.exitCode = exitCode;
});
