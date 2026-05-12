import type {CSSProperties, JSX} from "react";

import {Img, AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from "remotion";

import {DEFAULT_RENDER_SPEC} from "./defaults";
import type {RenderSpecInputProps, RenderSpecV1, SceneSpec} from "./types";

const fallbackPalette = {
  background: "#0B1020",
  primary: "#F5B83D",
  secondary: "#111827",
  accent: "#E5E7EB",
  text: "#F9FAFB",
};

function normalizeText(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function normalizeColor(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function resolveMediaSource(path: string | undefined): string | undefined {
  const trimmed = path?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function getActiveSceneIndex(frame: number, fps: number, scenes: SceneSpec[]): number {
  let elapsedFrames = 0;
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const sceneFrames = Math.max(1, Math.round(scene.duration_seconds * fps));
    elapsedFrames += sceneFrames;
    if (frame < elapsedFrames) {
      return index;
    }
  }

  return Math.max(0, scenes.length - 1);
}

function getTotalSceneFrames(renderSpec: RenderSpecV1): number {
  return Math.max(
    1,
    renderSpec.scenes.reduce(
      (accumulator, scene) => accumulator + Math.max(1, Math.round(scene.duration_seconds * renderSpec.fps)),
      0,
    ),
  );
}

function SceneRail({
  renderSpec,
  activeIndex,
}: {
  renderSpec: RenderSpecV1;
  activeIndex: number;
}): JSX.Element {
  return (
    <div style={styles.sceneRail}>
      {renderSpec.scenes.map((scene, index) => {
        const isActive = index === activeIndex;
        return (
            <section
            key={scene.id}
            style={{
              ...styles.sceneCard,
              borderColor: isActive
                ? normalizeColor(renderSpec.brand.primary_color, fallbackPalette.primary)
                : "rgba(255,255,255,0.12)",
              backgroundColor: scene.background_color ?? "rgba(255,255,255,0.05)",
              transform: isActive ? "translateY(-2px)" : "translateY(0)",
              boxShadow: isActive ? "0 24px 48px rgba(0,0,0,0.24)" : "none",
              opacity: isActive ? 1 : 0.72,
            }}
          >
            <div style={styles.sceneMetaRow}>
              <span style={styles.sceneIndex}>{String(index + 1).padStart(2, "0")}</span>
              <span style={styles.sceneType}>{scene.type}</span>
            </div>
            <h3 style={styles.sceneHeadline}>
              {normalizeText(scene.headline, renderSpec.title)}
            </h3>
            <p style={styles.sceneBody}>
              {normalizeText(scene.body, renderSpec.brand.cta_text ?? "Brand-safe fallback copy")}
            </p>
            {scene.asset_refs?.length ? (
              <div style={styles.assetChips}>
                {scene.asset_refs.map((assetRef) => (
                  <span key={assetRef} style={styles.assetChip}>
                    {assetRef}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export function BrandedStarterComposition({
  renderSpec = DEFAULT_RENDER_SPEC,
}: RenderSpecInputProps): JSX.Element {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const activeSceneIndex = getActiveSceneIndex(frame, fps, renderSpec.scenes);
  const sceneCount = renderSpec.scenes.length;
  const totalSceneFrames = getTotalSceneFrames(renderSpec);

  const backgroundColor = normalizeColor(renderSpec.background?.color, fallbackPalette.background);
  const primaryColor = normalizeColor(renderSpec.brand?.primary_color, fallbackPalette.primary);
  const secondaryColor = normalizeColor(renderSpec.brand?.secondary_color, fallbackPalette.secondary);
  const accentColor = normalizeColor(renderSpec.brand?.accent_color, fallbackPalette.accent);
  const textColor = normalizeColor(renderSpec.brand?.text_color, fallbackPalette.text);
  const brandName = normalizeText(renderSpec.brand?.name, "Branded starter");
  const ctaText = normalizeText(renderSpec.brand?.cta_text, "Built to render cleanly");
  const logoSource = resolveMediaSource(renderSpec.brand?.logo_path) ?? staticFile("branded-starter-mark.svg");

  return (
    <AbsoluteFill style={{...styles.root, backgroundColor}}>
      <div
        style={{
          ...styles.glow,
          background:
            `radial-gradient(circle at 20% 20%, ${primaryColor}33 0%, transparent 40%),` +
            `radial-gradient(circle at 80% 18%, ${accentColor}18 0%, transparent 28%),` +
            `linear-gradient(135deg, rgba(255,255,255,0.08), transparent 42%)`,
        }}
      />
      <div style={styles.grain} />

      <div style={styles.frame}>
        <header style={styles.header}>
          <div style={styles.kickerRow}>
            <span style={{...styles.kicker, color: primaryColor}}>RENDER SPEC 1.0</span>
            <span style={{...styles.kicker, color: textColor}}>{renderSpec.composition}</span>
          </div>
          <h1 style={{...styles.title, color: textColor}}>{normalizeText(renderSpec.title, brandName)}</h1>
          <p style={{...styles.subtitle, color: accentColor}}>
            {brandName} · {renderSpec.width}×{renderSpec.height} · {renderSpec.fps} fps · {renderSpec.duration_seconds}s
          </p>
        </header>

        <main style={styles.mainGrid}>
          <section
            style={{
              ...styles.heroPanel,
              backgroundImage: `linear-gradient(180deg, ${secondaryColor}40 0%, rgba(9, 13, 30, 0.62) 100%)`,
              borderColor: `${primaryColor}2E`,
            }}
          >
            <div style={styles.heroTopLine}>
              <span style={{...styles.heroBadge, color: backgroundColor, backgroundColor: primaryColor}}>
                {sceneCount} SCENES
              </span>
              <span style={{...styles.heroBadge, color: textColor, borderColor: `${accentColor}40`}}>
                {totalSceneFrames} FRAMES
              </span>
            </div>

            <div style={styles.heroCopy}>
              <p style={{...styles.heroLabel, color: accentColor}}>Brand starter composition</p>
              <p style={{...styles.heroText, color: textColor}}>
                Fallback-safe copy, deterministic timing, and a single composition that stays true to the render
                contract.
              </p>
            </div>

            <div style={styles.logoBlock}>
              <div style={styles.logoShell}>
                <Img src={logoSource} style={styles.logoImage} alt={brandName} />
              </div>
              <div style={styles.logoCopy}>
                <span style={{...styles.logoLabel, color: accentColor}}>Fallback asset</span>
                <span style={{...styles.logoValue, color: textColor}}>{ctaText}</span>
              </div>
            </div>

            <div style={styles.timeline}>
              {renderSpec.scenes.map((scene, index) => {
                const isActive = index === activeSceneIndex;
                return (
                  <div
                    key={scene.id}
                    style={{
                      ...styles.timelineSegment,
                      flexGrow: Math.max(1, Math.round(scene.duration_seconds * 10)),
                      backgroundColor: isActive ? primaryColor : `${accentColor}24`,
                      opacity: isActive ? 1 : 0.45,
                    }}
                  />
                );
              })}
            </div>
          </section>

          <aside
            style={{
              ...styles.sidePanel,
              borderColor: `${secondaryColor}55`,
            }}
          >
            <div style={styles.sideHeader}>
              <span style={{...styles.sideLabel, color: primaryColor}}>SCENE FLOW</span>
              <span style={{...styles.sideCount, color: textColor}}>Active {String(activeSceneIndex + 1).padStart(2, "0")}</span>
            </div>
            <SceneRail renderSpec={renderSpec} activeIndex={activeSceneIndex} />
          </aside>
        </main>

        <footer style={styles.footer}>
          <span style={{...styles.footerText, color: accentColor}}>
            {renderSpec.assets.images?.length ?? 0} images · {renderSpec.assets.videos?.length ?? 0} videos · {renderSpec.assets.audio?.length ?? 0} audio
          </span>
          <span style={{...styles.footerText, color: textColor}}>Render-safe starter only</span>
        </footer>
      </div>
    </AbsoluteFill>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    fontFamily: 'Inter, "Segoe UI", sans-serif',
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    inset: 0,
    opacity: 0.95,
  },
  grain: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(rgba(255,255,255,0.07) 0.9px, transparent 0.9px), radial-gradient(rgba(0,0,0,0.16) 0.9px, transparent 0.9px)",
    backgroundPosition: "0 0, 12px 12px",
    backgroundSize: "24px 24px",
    mixBlendMode: "soft-light",
    opacity: 0.34,
    pointerEvents: "none",
  },
  frame: {
    position: "relative",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "72px 68px 60px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxWidth: "74%",
  },
  kickerRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  kicker: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 3.2,
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontSize: 92,
    lineHeight: 0.96,
    letterSpacing: -3.2,
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.2,
    letterSpacing: -0.4,
    fontWeight: 500,
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 28,
    alignItems: "stretch",
  },
  heroPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 28,
    padding: 28,
    borderRadius: 36,
    border: "1px solid rgba(255,255,255,0.14)",
    backgroundColor: "rgba(9, 13, 30, 0.56)",
    backdropFilter: "blur(18px)",
    boxShadow: "0 36px 80px rgba(0,0,0,0.28)",
  },
  heroTopLine: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "10px 16px",
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1.4,
  },
  heroCopy: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    maxWidth: "88%",
  },
  heroLabel: {
    margin: 0,
    fontSize: 22,
    textTransform: "uppercase",
    letterSpacing: 2.4,
    fontWeight: 700,
  },
  heroText: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.15,
    letterSpacing: -0.8,
    fontWeight: 600,
  },
  logoBlock: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },
  logoShell: {
    width: 112,
    height: 112,
    borderRadius: 30,
    padding: 20,
    boxSizing: "border-box",
    backgroundColor: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  logoImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  logoCopy: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  logoLabel: {
    fontSize: 16,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    fontWeight: 700,
  },
  logoValue: {
    fontSize: 28,
    lineHeight: 1.1,
    letterSpacing: -0.4,
    fontWeight: 700,
    maxWidth: 540,
  },
  timeline: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  timelineSegment: {
    height: 10,
    borderRadius: 999,
    transition: "opacity 200ms ease, background-color 200ms ease",
  },
  sidePanel: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    padding: 24,
    borderRadius: 36,
    border: "1px solid rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.04)",
    boxShadow: "0 28px 64px rgba(0,0,0,0.22)",
  },
  sideHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  sideLabel: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: 2.8,
  },
  sideCount: {
    fontSize: 20,
    fontWeight: 600,
  },
  sceneRail: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  sceneCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.12)",
    padding: 18,
    transition: "transform 240ms ease, opacity 240ms ease, box-shadow 240ms ease, background-color 240ms ease",
  },
  sceneMetaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  sceneIndex: {
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: 2.4,
    opacity: 0.9,
  },
  sceneType: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 2,
    opacity: 0.8,
  },
  sceneHeadline: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.06,
    letterSpacing: -0.7,
    fontWeight: 700,
  },
  sceneBody: {
    margin: "10px 0 0",
    fontSize: 18,
    lineHeight: 1.4,
    letterSpacing: -0.2,
    opacity: 0.88,
  },
  assetChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  assetChip: {
    padding: "8px 12px",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    paddingTop: 14,
  },
  footerText: {
    fontSize: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: 700,
  },
} as const;
