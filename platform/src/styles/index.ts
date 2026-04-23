/* ===================================================================
   Platform Design Tokens — TypeScript Exports
   ===================================================================
   All values are CSS custom property references (var()) so TSX code
   can pass them to className/style props and have them resolve at
   render time.  The single source of truth is tokens.css.
   =================================================================== */

/* ── Color Palettes ──────────────────────────────────────────── */

export const brandColors = {
  50: "var(--color-brand-50)",
  100: "var(--color-brand-100)",
  200: "var(--color-brand-200)",
  300: "var(--color-brand-300)",
  400: "var(--color-brand-400)",
  500: "var(--color-brand-500)",
  600: "var(--color-brand-600)",
  700: "var(--color-brand-700)",
  800: "var(--color-brand-800)",
  900: "var(--color-brand-900)",
} as const;

export const secondaryColors = {
  50: "var(--color-secondary-50)",
  100: "var(--color-secondary-100)",
  200: "var(--color-secondary-200)",
  300: "var(--color-secondary-300)",
  400: "var(--color-secondary-400)",
  500: "var(--color-secondary-500)",
  600: "var(--color-secondary-600)",
  700: "var(--color-secondary-700)",
  800: "var(--color-secondary-800)",
  900: "var(--color-secondary-900)",
} as const;

export const accentColors = {
  50: "var(--color-accent-50)",
  100: "var(--color-accent-100)",
  200: "var(--color-accent-200)",
  300: "var(--color-accent-300)",
  400: "var(--color-accent-400)",
  500: "var(--color-accent-500)",
  600: "var(--color-accent-600)",
  700: "var(--color-accent-700)",
  800: "var(--color-accent-800)",
  900: "var(--color-accent-900)",
} as const;

export const surfaceColors = {
  50: "var(--color-surface-50)",
  100: "var(--color-surface-100)",
  200: "var(--color-surface-200)",
  300: "var(--color-surface-300)",
  400: "var(--color-surface-400)",
  500: "var(--color-surface-500)",
  600: "var(--color-surface-600)",
  700: "var(--color-surface-700)",
  800: "var(--color-surface-800)",
  900: "var(--color-surface-900)",
} as const;

export const contentColors = {
  100: "var(--color-content-100)",
  200: "var(--color-content-200)",
  300: "var(--color-content-300)",
  400: "var(--color-content-400)",
  500: "var(--color-content-500)",
  600: "var(--color-content-600)",
  700: "var(--color-content-700)",
  800: "var(--color-content-800)",
  900: "var(--color-content-900)",
} as const;

export const semanticColors = {
  success: {
    50: "var(--color-success-50)",
    100: "var(--color-success-100)",
    200: "var(--color-success-200)",
    300: "var(--color-success-300)",
    400: "var(--color-success-400)",
    500: "var(--color-success-500)",
    600: "var(--color-success-600)",
    700: "var(--color-success-700)",
    800: "var(--color-success-800)",
    900: "var(--color-success-900)",
  } as const,
  warning: {
    50: "var(--color-warning-50)",
    100: "var(--color-warning-100)",
    200: "var(--color-warning-200)",
    300: "var(--color-warning-300)",
    400: "var(--color-warning-400)",
    500: "var(--color-warning-500)",
    600: "var(--color-warning-600)",
    700: "var(--color-warning-700)",
    800: "var(--color-warning-800)",
    900: "var(--color-warning-900)",
  } as const,
  danger: {
    50: "var(--color-danger-50)",
    100: "var(--color-danger-100)",
    200: "var(--color-danger-200)",
    300: "var(--color-danger-300)",
    400: "var(--color-danger-400)",
    500: "var(--color-danger-500)",
    600: "var(--color-danger-600)",
    700: "var(--color-danger-700)",
    800: "var(--color-danger-800)",
    900: "var(--color-danger-900)",
  } as const,
  info: {
    50: "var(--color-info-50)",
    100: "var(--color-info-100)",
    200: "var(--color-info-200)",
    300: "var(--color-info-300)",
    400: "var(--color-info-400)",
    500: "var(--color-info-500)",
    600: "var(--color-info-600)",
    700: "var(--color-info-700)",
    800: "var(--color-info-800)",
    900: "var(--color-info-900)",
  } as const,
} as const;

/* ── Semantic Action Colors ──────────────────────────────────── */

export const colorTokens = {
  primary: "var(--color-primary)",
  primaryHover: "var(--color-primary-hover)",
  primaryLight: "var(--color-primary-light)",
  secondaryAction: "var(--color-secondary-action)",
  accent: "var(--color-accent)",
  muted: "var(--color-muted)",
  faint: "var(--color-faint)",
  strong: "var(--color-strong)",
  surfaceDefault: "var(--color-surface-default)",
  surfaceMuted: "var(--color-surface-muted)",
  borderDefault: "var(--color-border-default)",
  borderSubtle: "var(--color-border-subtle)",
  successAction: "var(--color-success-action)",
  warningAction: "var(--color-warning-action)",
  dangerAction: "var(--color-danger-action)",
  infoAction: "var(--color-info-action)",
} as const;

/* ── Typography ──────────────────────────────────────────────── */

export const fontTokens = {
  display: "var(--font-display)",
  body: "var(--font-body)",
  mono: "var(--font-mono)",
} as const;

export const headingTokens = {
  display: "var(--text-display)",
  h1: "var(--text-h1)",
  h2: "var(--text-h2)",
  h3: "var(--text-h3)",
  h4: "var(--text-h4)",
  h5: "var(--text-h5)",
  h6: "var(--text-h6)",
} as const;

export const bodyTokens = {
  body: "var(--text-body)",
  caption: "var(--text-caption)",
  code: "var(--text-code)",
} as const;

/* ── Spacing ─────────────────────────────────────────────────── */

export const spacingTokens = {
  0: "var(--s-0)",
  1: "var(--s-1)",
  2: "var(--s-2)",
  3: "var(--s-3)",
  4: "var(--s-4)",
  6: "var(--s-6)",
  8: "var(--s-8)",
  12: "var(--s-12)",
  16: "var(--s-16)",
  24: "var(--s-24)",
  32: "var(--s-32)",
} as const;

export const layoutSpacingTokens = {
  gutter: "var(--space-gutter)",
  section: "var(--space-section)",
  hero: "var(--space-hero)",
} as const;

/* ── Border Radius ───────────────────────────────────────────── */

export const radiusTokens = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  "2xl": "var(--radius-2xl)",
  full: "var(--radius-full)",
} as const;

/* ── Shadows ─────────────────────────────────────────────────── */

export const shadowTokens = {
  card: "var(--shadow-card)",
  panel: "var(--shadow-panel)",
  overlay: "var(--shadow-overlay)",
  elevated: "var(--shadow-elevated)",
} as const;

/* ── Motion ──────────────────────────────────────────────────── */

export const motionTokens = {
  fast: "var(--motion-fast)",
  normal: "var(--motion-normal)",
  slow: "var(--motion-slow)",
} as const;

export const easingTokens = {
  smooth: "var(--ease-smooth)",
  bounce: "var(--ease-bounce)",
  snappy: "var(--ease-snappy)",
} as const;

/* ── Z-Index ─────────────────────────────────────────────────── */

export const zIndexTokens = {
  dropdown: "var(--z-dropdown)",
  sticky: "var(--z-sticky)",
  modalBackdrop: "var(--z-modal-backdrop)",
  modal: "var(--z-modal)",
  popover: "var(--z-popover)",
  tooltip: "var(--z-tooltip)",
} as const;
