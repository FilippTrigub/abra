---
name: Abra
description: Agent de Branding, a content capture system that turns raw expertise into ready-to-post content.
colors:
  primary: "#FF6045"
  primary-hover: "#E85036"
  secondary: "#9340F0"
  accent: "#14B8A6"
  neutral-bg: "#FEFEFE"
  neutral-surface: "#F9F9FB"
  neutral-border: "#ECECF0"
  neutral-text: "#18182B"
  neutral-muted: "#606072"
  marketing-canvas: "#05070B"
  marketing-signal: "#7CFFB2"
typography:
  display:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "64px"
  hero: "128px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#FFFFFF"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.neutral-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "8px 16px"
  badge-brand:
    backgroundColor: "#FFE8DB"
    textColor: "#CC4028"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  card-default:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  panel-muted:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.xl}"
    padding: "16px"
---

# Design System: Abra

## Overview

**Creative North Star: "The Calm Content Operator"**

Abra should feel like a serious system for experts whose work depends on trust. The product surfaces are warm, clear, and operational. The marketing surfaces are sharper and darker, but they still come from the same brand logic: reduce the blank page, make the next step obvious, and keep the expert in control.

This is not an AI toy, not creator gimmick software, and not a developer control plane pretending to be a brand product. The design needs to make expertise feel visible, organized, and reviewable. That means strong hierarchy, short copy blocks, and interfaces that look deliberate without looking theatrical.

**Key Characteristics:**

- warm editorial-product core with restrained brand color
- strong display typography paired with plain-spoken body text
- rounded surfaces with subtle borders and soft shadows
- quiet motion, visible focus, and obvious next actions
- a darker, sharper marketing variant that still feels controlled

## Colors

Abra uses a warm product palette for the main application and a darker, signal-led palette for the marketing landing page.

### Primary
- **Warm Coral** (`#FF6045`): the main call-to-action color across product surfaces. Used for primary buttons, active emphasis, and brand-signaling states.

### Secondary
- **Vibrant Violet** (`#9340F0`): secondary action color. Used sparingly for alternate buttons, accent support, and decorative secondary emphasis.

### Tertiary
- **Fresh Teal** (`#14B8A6`): success and highlight accent inside the product system.
- **Signal Green** (`#7CFFB2`): darker marketing-surface highlight. Used for quiet labels, lines, and key markers on the landing page.

### Neutral
- **Soft Paper** (`#FEFEFE`): the default bright background.
- **Muted Surface** (`#F9F9FB`): card and panel background.
- **Quiet Border** (`#ECECF0`): subtle structural separators.
- **Deep Ink** (`#18182B`): strongest content color in the application.
- **Muted Copy** (`#606072`): secondary body and helper text.
- **Night Canvas** (`#05070B`): the marketing landing-page background.

**The Supporting Mechanics Rule.** Brand color should clarify hierarchy, not become the entire experience. Coral carries action, violet supports it, and green is reserved for signal, not decoration.

## Typography

**Display Font:** Outfit, system-ui, sans-serif  
**Body Font:** Geist, system-ui, sans-serif  
**Label/Mono Font:** Geist Mono, ui-monospace, monospace

**Character:** Display type is decisive and modern, but not flashy. Body copy is plain, readable, and workmanlike. Mono labels are used as operational markers, not as an aesthetic blanket.

### Hierarchy
- **Display** (800, 3.75rem, 1): for hero headlines and the strongest top-level promise.
- **Headline** (700, 2.25rem, 1.15): for section headings and page-level content pivots.
- **Title** (700, 1.5rem, 1.25): for cards, panels, and dense product summaries.
- **Body** (400, 1rem, 1.6): for default paragraphs, helper text, and descriptive copy. Keep body line length in the 65 to 75 character range.
- **Label** (600, 0.875rem, 1.5, slight tracking): for chips, tags, badges, and operational markers. On the marketing page, these can scale slightly above base caption size for readability.

**The Plain-Language Rule.** Body copy should read like a sharp operator speaking clearly. Strong hierarchy matters more than ornate typography.

## Elevation

Abra uses soft depth, not dramatic lift. Product surfaces rely on tonal layering, subtle borders, and lightly tinted shadows. Marketing surfaces on dark backgrounds can take slightly stronger shadow contrast, but they should still feel controlled rather than glossy.

### Shadow Vocabulary
- **Card** (`0 1px 3px 0 rgb(255 106 70 / 0.04), 0 1px 2px -1px rgb(255 106 70 / 0.03)`): default card depth.
- **Panel** (`0 2px 4px 0 rgb(255 106 70 / 0.06), 0 1px 3px -1px rgb(255 106 70 / 0.04)`): slightly stronger emphasis for grouped panels.
- **Overlay** (`0 8px 24px 0 rgb(255 106 70 / 0.08), 0 4px 8px -2px rgb(147 64 240 / 0.04)`): overlays and elevated floating surfaces.
- **Elevated** (`0 16px 40px 0 rgb(255 106 70 / 0.1), 0 8px 16px -4px rgb(147 64 240 / 0.06)`): rare high-emphasis depth.

**The Soft-Depth Rule.** Shadows should clarify hierarchy, not advertise themselves. If the user notices the shadow before the information, the surface is too loud.

## Components

### Buttons
- **Shape:** rounded, with size-specific radii from 12px to 24px.
- **Primary:** warm coral fill with white text in product surfaces. On the marketing page, primary buttons may invert to white-on-dark for stronger CTA contrast.
- **Hover / Focus:** fast transitions, slight press scale, and a visible token-based focus ring.
- **Secondary / Ghost:** secondary uses violet fill; ghost stays transparent and relies on text plus hover background.

### Chips
- **Style:** pill-shaped, compact, and quiet. Product badges use tinted backgrounds keyed to semantic roles. Marketing chips can drop uppercase mono in favor of slightly larger, cleaner support text.
- **State:** brand, secondary, success, warning, danger, and info all map to tinted background plus stronger text.

### Cards / Containers
- **Corner Style:** 24px cards for the main card primitive, 16px panels for smaller groupings.
- **Background:** default product cards sit on `surface-default` or `surface-muted`. Marketing cards on the landing page use translucent dark fills over the night canvas.
- **Shadow Strategy:** subtle by default, stronger only when a surface is elevated on a dark background.
- **Border:** optional but common, especially for muted or dark panels.
- **Internal Padding:** 24px on cards, 16px on smaller panels.

### Inputs / Fields
- **Style:** neutral backgrounds, subtle borders, and the same rounded system as the rest of the UI.
- **Focus:** explicit focus-ring variants are part of the system and should remain visible.
- **Error / Disabled:** validation states use semantic coloring plus a left-edge indicator in the current implementation.

### Navigation
- **Product nav:** quiet, readable, and stateful. Active links use coral text and a soft brand background.
- **Marketing nav:** minimal, with one sign-in CTA and no extra sales clutter.

### Decorative Utilities
- **Patterns:** grid, dots, nodes, checker, gradients, and abstract shapes exist as optional utilities.
- **Use:** only when they clarify atmosphere or hierarchy. The value proposition plan explicitly says not to let decorative systems overpower the promise.

## Do's and Don'ts

### Do:
- **Do** use the existing token system as the implementation base for colors, typography, spacing, radii, and shadows.
- **Do** keep product surfaces warm, organized, and plain-spoken.
- **Do** let marketing surfaces become sharper and darker when the value proposition needs more contrast.
- **Do** use large, high-contrast headlines and short blocks of supporting copy.
- **Do** preserve visible focus states, readable body copy, and clear next actions.

### Don't:
- **Don't** lead with skill counts, orchestration complexity, GPU hosting, or infrastructure mechanics.
- **Don't** make Abra look like a generic AI writer, a creator gimmick, or an autopublishing robot.
- **Don't** default to glassmorphism, heavy gradients, or decorative dashboard screenshots on marketing surfaces.
- **Don't** use dense feature grids, icon-heavy repetition, or novelty visual language when the page's job is to make the promise obvious.
- **Don't** let the dashboard drift into playful SaaS cues if the goal is a more credible, operational product feel.
