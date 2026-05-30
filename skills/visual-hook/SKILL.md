---
name: visual-hook
description: >-
  Add a bold visual hook text overlay to images or videos for Instagram.
  Places high-contrast text in safe zones for Reels, feed portrait, and square posts.
  Use this skill when the user wants to add a hook line, question, teaser, or bold claim
  before publishing social content.
metadata:
  {
    "openclaw":
      {
        "emoji": "🪝",
        "requires": { "bins": ["ffmpeg", "uv"], "env": [] },
      },
  }
---

# visual-hook — Instagram Visual Hook Overlay

Add a bold visual hook to images or videos using high-contrast typography in
Instagram-safe zones. For videos, the skill prepends a selected hook clip from
brand assets after overlaying the hook text onto that clip. The skill is CPU-only
and works well as a pre-publication step before captioning or scheduling.

## When to Use

Use this skill when the user wants to:
- Add a strong first-frame hook to a Reel or Story
- Overlay a bold question, teaser, or claim onto an image post
- Increase scroll-stopping contrast before publishing to Instagram
- Apply a reusable visual style (`bold-white`, `neon-red`, `minimal`, etc.)

## Setup

```bash
cd "$SKILL_DIR" && uv sync
```

The skill tries fonts in this order:
1. `hook.font` if set to a file path
2. A brand font from `skills/brand-manager/brand-assets/asset-manifest.json`
3. Common system fonts such as DejaVu Sans Bold

For videos, the skill resolves the hook clip from `brand-assets/asset-manifest.json`:
1. `--hook-video <name|path>` if provided
2. the manifest entry under `videos` with `"default": true`
3. otherwise the run fails with a clear error

## Agent Workflow

### 1. Ask the user

```
Before I add the hook, I need:

📝 Hook text
  Short is best: 4–7 words, ideally 2 lines max

🎨 Style preset
  - bold-white
  - bold-black
  - neon-red
  - neon-yellow
  - minimal

📍 Position
  - upper-middle (recommended)
  - center
  - lower-middle

📐 Format
  - auto
  - reels (9:16)
  - feed-portrait (4:5)
  - feed-square (1:1)
```

### 2. Edit config.json

Set `hook.text`, `hook.preset`, `hook.position`, and `format`.
For videos, optionally set `video_hook.selection` to a brand asset name or manifest path.

### 3. Run

```bash
cd "$SKILL_DIR" && uv run python scripts/hook.py
```

Override defaults via CLI:

```bash
cd "$SKILL_DIR" && uv run python scripts/hook.py \
  --input ./input \
  --output ./output \
  --text "Stop doing this" \
  --preset neon-red \
  --format reels \
  --hook-video intro-fast
```

### 4. Report results

Tell the user:
- how many files were processed
- the output file locations
- which font was used
- whether the hook was applied to images, videos, or both

## Config Reference

| Key | Values | Default | Description |
|-----|--------|---------|-------------|
| `input_dir` | path | `./input` | Folder containing source images/videos |
| `output_dir` | path | `./output` | Destination folder for processed output |
| `format` | `auto`, `reels`, `feed-portrait`, `feed-square` | `auto` | Layout profile for safe-zone calculations |
| `video_hook.selection` | `auto`, brand asset name, manifest path | `auto` | Hook-video selection for video inputs |
| `hook.text` | string | `You need to see this →` | The visual hook copy |
| `hook.preset` | `bold-white`, `bold-black`, `neon-red`, `neon-yellow`, `minimal` | `bold-white` | Hook styling preset |
| `hook.position` | `upper-middle`, `center`, `lower-middle` | `upper-middle` | Vertical placement within safe zone |
| `hook.font_size` | integer or `null` | `null` | Explicit font size; auto-scales when null |
| `hook.stroke_width` | integer | `4` | Text outline width |
| `hook.duration` | float | `3.0` | Seconds to show hook on videos |
| `hook.font` | `auto` or file path | `auto` | Explicit font path override |

## Output

- Images: same file name and extension in `output_dir`
- Videos: MP4 output named `<original-stem>.mp4`, containing the selected hook clip first and the source video second

## Error Handling

- **Missing ffmpeg**: install `ffmpeg` on the system
- **No supported media found**: the skill prints a clear message and exits successfully
- **Font not found**: falls back through brand font and system font candidates, then exits with guidance
- **No hook video configured**: add a video entry in brand assets and mark one as default, or pass `--hook-video`
- **Invalid preset / format / position**: config validation error with allowed values

---

## Hook Psychology & Writing Guide

Understanding *why* hooks work makes it easier to choose and write the right text for each use case.

### The core mechanism: curiosity loop

A hook works by creating a gap between what the viewer already believes (A) and what the content reveals (B). The bigger the gap, the stronger the pull. The opening should make the viewer feel: *"Wait, what is this?"*

The hook's job is not to be clever. It is to keep the viewer alive long enough for the actual content to matter. Platforms penalize early drop-off — a weak opening hurts algorithmic reach even if the rest of the content is strong.

### The six hook archetypes

Any topic can be framed through these six archetypes. The real skill is choosing the archetype that best matches the strongest available contrast in the material.

| Archetype | What it creates | Best for |
|-----------|----------------|----------|
| **Fortune Teller** — *"This is going to change..."* | Anticipation and authority | Trend forecasting, new products, category-defining ideas |
| **Experimentor** — *"I tried X so you don't have to"* | Proof and curiosity (peer-to-peer) | Product demos, workflows, transformation shows |
| **Teacher** — *"Here's what you should know..."* | Authority and trust | Educational content, tutorials, B2B thought leadership |
| **Magician** — *"Check this out"* + striking visual | Immediate attention (scroll-stop) | Visually rich content, transformations, stylish edits |
| **Investigator** — *"Here's what most people don't know..."* | Discovery and intrigue | Research, hidden insights, behind-the-scenes |
| **Contrarian** — *"You're doing X wrong"* | Tension and strong positioning | Expert opinion, category disruption, "most people are wrong" |

The Magician archetype can be layered on top of any other — it adds visual punch to whatever frame is chosen.

### The three-step hook formula (spoken text)

1. **Context lean-in** — state the topic immediately; make the viewer feel this is for them
2. **Scroll-stop interjection** — a contrasting line using "but...", "however...", "yet..." to interrupt the expected direction
3. **Contrarian snapback** — reverse the expected conclusion and create a curiosity loop

Example: "The Sphere has an insane screen [context lean-in] — but get this [interjection] — the screen is actually the least impressive part; the audio is what's revolutionary [snapback]."

### Multi-layer alignment

A hook is not just text. All four layers must point in the same direction:

- **Spoken hook** — what you say
- **Visual hook** — what the viewer sees first (most important)
- **Text hook** — on-screen text overlay (this skill's primary output)
- **Audio hook** — sound, music, or effect cues

If any layer contradicts the others, the viewer gets confused and drops off. The visual is processed first — if the visual is weak or off-message, even a perfect text overlay will not save it.

### The key visual principle

Before writing hook text, ask: what is the most interesting thing the viewer can actually see in the first 3–5 seconds? Start from the visual, then write the text around it. If there is no compelling visual, the hook text will underperform regardless of how well it is written.

### Writing rules for hook text

- **Short is better**: 4–7 words per line, 2 lines maximum
- **Staccato over flowing**: short, punchy, no warm-up clauses or filler words
- **Specific over clever**: avoid generic inspiration; name a concrete situation, number, or outcome
- **Clarity over surprise**: the viewer must understand the premise instantly — abstract or jargon-heavy openings cause comprehension loss even if they look interesting
- **Match the content**: if the hook overpromises, trust breaks. The text must align with what the video actually delivers

### Reusable hook line templates

```
Stop doing [X].
I don't know who needs to hear this, but...
Most people don't realize...
If I had to start over tomorrow, here's what I'd do.
This is why you're stuck at [X].
Here's what's really going on with [X].
Don't make this mistake when you're [X].
This will shift how you think about [X].
If you're [X], pay attention.
I wish I knew this sooner.
[Number] things you can learn from [X].
```

### Hook quality checklist

Before finalizing the hook text, verify:

- [ ] Is the key visual obvious in the first 3–5 seconds?
- [ ] Does the text create contrast or open a curiosity gap?
- [ ] Did I choose the right archetype for the idea?
- [ ] Do the text, visual, and spoken line all match?
- [ ] Can a viewer understand the premise without any prior context?
- [ ] Is the concept clear enough to express without jargon?
- [ ] Is the line staccato — short, punchy, no filler words?
