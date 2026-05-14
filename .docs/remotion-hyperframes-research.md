# HyperFrames vs Remotion Research

## Status: COMPLETED

This note captures the research on how video composition fits into the current Abra codebase, how **HyperFrames** differs from **Remotion**, which one appears more mature, and whether Remotion is already implemented anywhere in this repository.

---

## Current Abra Setup

Abra is primarily a **file-based media pipeline**, not a timeline-first video composition application.

The core pattern across the repo is:
- each skill lives under `skills/<skill-name>/`
- most skills read from `input/` and write to `output/`
- workflows chain these outputs step by step
- the system thinks in terms of **asset transformation**, not in terms of a long-lived composition runtime

Key repo-level observations:
- `AGENTS.md` defines a standard skill structure with `input/`, `output/`, `scripts/`, `config.json`, and `SKILL.md`
- `README.md` describes Abra as a modular brand/content pipeline with workflows such as `video-to-reel`, `image-to-post`, and `audio-to-post`
- `SKILLS.md` reinforces that most tools are independent processing steps, not a shared composition engine

Relevant video-related skills include:
- `skills/video-generator/` — cloud video generation via Higgsfield models
- `skills/visual-hook/` — overlays hook text and prepends a hook clip
- `skills/end-cta/` — appends CTA cards or CTA videos
- `skills/video-captioner/`, `skills/video-enhancer/`, `skills/video-cutter/` — post-processing and editing steps

This means any Remotion or HyperFrames adoption would be an **additional rendering layer** inside a pipeline that currently operates mostly by file-to-file transformations.

---

## HyperFrames vs Remotion

### High-level difference

- **HyperFrames** is **HTML-first**
- **Remotion** is **React-first**

Both are deterministic, code-driven video rendering approaches, but they assume different authoring models.

### HyperFrames

HyperFrames is designed around:
- plain HTML documents
- timing and scene behavior through `data-*` attributes
- browser preview
- deterministic frame capture through headless Chrome
- final encoding through FFmpeg

It is a better fit when the input model is already close to:
- HTML/CSS layout
- website-like scenes
- agent-generated templates
- simple deterministic rendering pipelines

### Remotion

Remotion is designed around:
- React components
- explicit video metadata like `fps`, `width`, `height`, and `durationInFrames`
- frame-driven rendering
- compositions registered in a React app structure
- rendering through CLI, SSR, or cloud workflows

It is a better fit when the team wants:
- reusable typed components
- data-driven batch rendering
- multiple video templates/compositions
- app-like video rendering infrastructure
- React-native developer ergonomics

### Practical framing for this repo

For Abra specifically:
- **HyperFrames** would fit best if the goal is to add a new skill that renders branded HTML/CSS scenes into video assets
- **Remotion** would fit best if the goal is to introduce a dedicated programmable video composition subsystem with reusable components and data-fed templates

Because Abra already has many discrete transformation steps, HyperFrames is conceptually closer to the existing "render an asset from a template" mindset, while Remotion is closer to adding a separate video application inside the repo.

---

## Which Seems More Mature?

The research conclusion was:

> **Remotion appears to be the more mature solution overall.**

Reasons:
- broader documentation surface
- more established ecosystem and production usage patterns
- richer rendering modes (CLI, SSR, Lambda/cloud)
- a longer-standing component/composition model

HyperFrames looks more specialized and more opinionated around:
- HTML-native rendering
- agent-friendly deterministic generation
- simpler website-to-video style workflows

So the maturity split is:
- **Remotion** = more mature general platform
- **HyperFrames** = more specialized rendering approach

---

## Marketing Skills References to Remotion

Two local files mention Remotion explicitly:

### `marketingskills/skills/ad-creative/SKILL.md`

This file recommends a scaled-production workflow:
1. generate hero creative with AI tools
2. build **Remotion templates** from winning patterns
3. batch produce variations with Remotion using data feeds
4. keep using AI for new angles and Remotion for scale

This is guidance, not proof of implementation.

### `marketingskills/skills/ad-creative/references/generative-tools.md`

This file categorizes Remotion as the tool for:
- templated video ads at scale
- personalized video using data
- code-based video rendering

Again, this is a recommendation/reference document, not local runtime wiring.

---

## Is Remotion Already Implemented Here?

### Conclusion

**No. Remotion is not implemented in this repository as checked-in local application code.**

### What was found

- `marketingskills/skills/ad-creative/SKILL.md` — docs-only mention
- `marketingskills/skills/ad-creative/references/generative-tools.md` — docs-only mention
- `marketingskills/.gitignore` — ignores a `video/` folder labeled as a Remotion video project
- `Dockerfile` — installs an external `remotion-video-toolkit` via `clawhub`

### What was not found

- no `remotion` or `@remotion/*` dependencies in `package.json`
- no local Remotion app folder
- no composition files
- no `remotion.config.*`
- no imports from Remotion packages
- no render scripts or workflow integration that actually invokes Remotion

### Interpretation

The repository currently treats Remotion as:
- a documented recommendation in the embedded marketing-skills content
- a possibly intended external toolkit/project shape
- but **not** as a local implemented subsystem

---

## Evidence Pointers

Files inspected during this research:
- `AGENTS.md`
- `README.md`
- `SKILLS.md`
- `skills/video-generator/SKILL.md`
- `skills/visual-hook/SKILL.md`
- `skills/end-cta/SKILL.md`
- `marketingskills/skills/ad-creative/SKILL.md`
- `marketingskills/skills/ad-creative/references/generative-tools.md`
- `Dockerfile`
- `package.json`
- `platform/package.json`
- `marketingskills/.gitignore`

---

## Bottom Line

Abra today is a **workflow-driven media processing system**.

If a code-based video templating layer is added later:
- choose **HyperFrames** for HTML/CSS-native, deterministic template rendering
- choose **Remotion** for a fuller React-based video composition platform

At the time of this research, **Remotion is referenced but not implemented locally**.
