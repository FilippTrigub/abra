---
name: brand-manager
description: >-
  Maintains and applies brand identity across all content operations.
  Ensures every output aligns with the personal brand's voice, values, and visual identity.
---

# Brand Awareness Skill

**Description**: Maintains and applies brand identity across all content operations. This skill ensures every output aligns with the personal brand's voice, values, and visual identity.

**Category**: Identity & Branding

**Trigger**: Always active - applied to every content generation task

---

## Tools

### 1. read-about-me

**Purpose**: Analyzes available input about the brand and generates/updates BRAND.md with complete brand specifications.

**Input**:
- Raw text files, notes, documents about the persona/brand
- Existing BRAND.md (if present)
- Any profile information, resumes, bios, past content

**Output**:
- Generated or updated BRAND.md file
- Summary of brand characteristics extracted

**Usage**:
- Run during **Init phase** to establish brand state
- Re-run when new brand information becomes available
- Use to refresh brand understanding before major content batches

**Example Workflow**:
```
1. Provide raw input files (about.txt, resume.md, past-posts.md)
2. Skill analyzes all documents for:
   - Core values and principles
   - Voice and tone patterns
   - Areas of expertise
   - Audience and positioning
   - Visual preferences
3. Outputs structured BRAND.md
```

---

### 2. adapt-content-to-brand

**Purpose**: Takes raw content and adapts it to align with established brand identity.

**Input**:
- Draft content (social media post, article, message)
- BRAND.md specification
- Target channel/platform (Instagram, LinkedIn, Twitter, etc.)

**Output**:
- Brand-aligned content ready for publishing
- Notes on specific brand elements applied
- Suggestions for improvement

**Usage**:
- Run during **Regular phase** after initial content generation
- Specify target channel for platform-specific adaptation
- Iterate until content meets brand standards

**Example Workflow**:
```
1. Provide draft content
2. Specify target channel (e.g., "instagram")
3. Skill applies:
   - Brand voice and tone
   - Appropriate hashtags
   - Content length optimization
   - Call-to-action alignment
4. Returns polished, brand-compliant content
```

---

## Asset Storage

This skill manages brand assets (images, fonts, videos, and CTA definitions) that can be consumed by other skills.

**Asset Directory Structure**:
```
$SKILL_DIR/
├── brand-assets/
│   ├── images/          # Brand images (logos, profile pics, templates)
│   ├── fonts/           # Brand fonts (.ttf, .otf files)
│   ├── videos/          # Brand video clips (hook intros, bumpers)
│   └── asset-manifest.json  # Index of all stored assets and CTA definitions
```

---

### 3. store-brand-image

**Purpose**: Stores a brand-related image in the brand-assets repository and registers it in the manifest.

**Input**:
- Image file path (local file)
- Asset name (identifier for reference)
- Optional tags (e.g., "logo", "profile", "template", "background")

**Output**:
- Image copied to `brand-assets/images/`
- Manifest entry added with name, path, tags, and timestamp

**Script Usage**:
```bash
python scripts/brand_assets.py store-image \
  --input /path/to/logo.png \
  --name logo-square \
  --tags logo,primary
```

**Manifest Entry**:
```json
{
  "name": "logo-square",
  "path": "images/logo-square.png",
  "tags": ["logo", "primary"],
  "added": "2026-03-12T00:00:00Z"
}
```

---

### 4. store-brand-font

**Purpose**: Stores a brand-related font file in the brand-assets repository and registers it in the manifest.

**Input**:
- Font file path (.ttf, .otf, .woff, .woff2)
- Asset name (identifier for reference)
- Optional tags (e.g., "heading", "body", "logo")

**Output**:
- Font copied to `brand-assets/fonts/`
- Manifest entry added with name, path, tags, and timestamp

**Script Usage**:
```bash
python scripts/brand_assets.py store-font \
  --input /path/to/Inter-Bold.ttf \
  --name inter-bold \
  --tags heading
```

---

### 5. store-brand-video

**Purpose**: Stores a reusable brand video clip in the brand-assets repository and registers it in the manifest.

**Input**:
- Video file path (.mp4, .mov, .avi, .mkv, .m4v, .webm)
- Asset name
- Optional tags (e.g. "hook-video", "bumper")
- Optional `--default` flag to make it the default hook clip

**Script Usage**:
```bash
python scripts/brand_assets.py store-video \
  --input /path/to/intro-hook.mp4 \
  --name intro-fast \
  --tags hook-video \
  --default
```

---

### 6. list-brand-assets

**Purpose**: Lists all stored brand assets, optionally filtered by type or tags.

**Input**:
- Optional filter: "images", "fonts", "videos", "ctas", or specific tag

**Output**:
- List of all matching assets with names, paths, and tags

**Script Usage**:
```bash
# List all assets
python scripts/brand_assets.py list

# List only images
python scripts/brand_assets.py list --type images

# List assets with specific tag
python scripts/brand_assets.py list --tag logo
```

---

### 7. get-brand-asset-path

**Purpose**: Returns the absolute path to a specific brand asset for consumption by other skills.

**Input**:
- Asset name or tag

**Output**:
- Absolute file path to the asset
- Useful for other skills to reference brand assets

**Script Usage**:
```bash
# Get path by name
python scripts/brand_assets.py get-path --name logo-square

# Get first asset with tag (useful for scripts)
python scripts/brand_assets.py get-path --tag logo
```

---

### 8. remove-brand-asset

**Purpose**: Removes a brand asset from the repository and manifest.

**Input**:
- Asset name to remove

**Output**:
- File deleted from brand-assets/
- Entry removed from manifest

**Script Usage**:
```bash
python scripts/brand_assets.py remove --name logo-square
```

---

### 9. store-cta-definitions

**Purpose**: Registers CTA definitions in the manifest for downstream skills such as `end-cta`.

**Supported forms**:
- `store-cta-text` for inline text CTAs
- `store-cta-image` for CTAs backed by an existing stored image asset
- `store-cta-video` for CTAs backed by an existing stored video asset

**Script Usage**:
```bash
python scripts/brand_assets.py store-cta-text \
  --name book-call \
  --text "Book a call" \
  --tags cta \
  --default

python scripts/brand_assets.py store-cta-image \
  --name follow-instagram \
  --asset-name logo-square \
  --tags cta

python scripts/brand_assets.py store-cta-video \
  --name subscribe-endcard \
  --asset-name intro-fast \
  --tags cta
```

---

## Integration Points

### With Other Skills
- **Instagram Text Processing**: Receives brand-adapted content for channel formatting
- **Video Processing**: Ensures video content aligns with brand visual identity
- **Image Processing**: Applies brand colors, styles, and messaging; uses brand images/templates
- **Image/Video Gen**: Generates materials using brand specifications and assets
- **Schedule Publication**: Tags content with brand metadata for tracking
- **Brand Asset Access**: Other skills can read `asset-manifest.json` to discover and use brand assets

### Consuming Brand Assets (Other Skills)

Other skills can access brand assets by reading the manifest:

```python
import json
import os

MANIFEST_PATH = os.path.expanduser("~/.openclaw/skills/brand-awareness/brand-assets/asset-manifest.json")

def get_brand_image_by_tag(tag):
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)
    for img in manifest.get("images", []):
        if tag in img.get("tags", []):
            return os.path.join(os.path.dirname(MANIFEST_PATH), img["path"])
    return None

def get_brand_font_by_tag(tag):
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)
    for font in manifest.get("fonts", []):
        if tag in font.get("tags", []):
            return os.path.join(os.path.dirname(MANIFEST_PATH), font["path"])
    return None
```

### Required Dependencies
- BRAND.md file in project root (created by `read-about-me` tool)
- Brand assets directory at `~/.openclaw/skills/brand-awareness/brand-assets/`

---

## Brand Strategy Principles

These principles come from expert personal-branding research and should inform how this skill reads, extracts, and applies brand identity.

### Brand is association

A brand is what people think of when they hear your name. The goal is not just a polished profile — it is a consistent pairing of who you are, what you talk about, and what people can rely on you for. When reading source material in `read-about-me`, extract this pairing explicitly.

### Brand first, trust first, transactions later

Content should build credibility before it asks for anything. When adapting content, check that the piece gives value before promoting. The recommended sequence is: free content → lead magnets → low-ticket offers → services. Never lead with the offer.

### Niche beats generic

Recognized niche expertise commands attention and trust. Generic content competes with everything; niche content competes with a smaller, more interested slice. When defining brand positioning, push toward a specific domain rather than staying broad.

### Interest stacking

The brand should have a clear primary topic while adding enough human texture (side interests, process stories, honest failures) to feel real. Avoid becoming so narrow that the brand feels robotic. Extract secondary interests from source material and include them in BRAND.md.

### Consistency over perfection

Consistency matters more than polish. Ship, learn, improve. When adapting content, do not block publishing over minor style concerns — flag them as suggestions instead.

### Content pillars

A brand should have 4 recurring content types (e.g., educational how-to, personal storytelling, industry insight, conversion content). These pillars keep output from becoming random and help audiences know what to expect. Extract and name the pillars when building BRAND.md.

### Repurpose from long to short

Long-form source material (calls, workshops, articles) is the primary asset. Every long-form piece should be broken into several platform-native short pieces. When adapting content, always consider what shorter posts could come from the same source.

### Failure stories build trust

Vulnerability and honest failure stories create more trust than polished success claims. When the user shares source material about mistakes, challenges, or lessons learned, treat it as high-value branding material.

### Adapt to channel, not just to brand

The same idea behaves differently on Instagram, LinkedIn, and Twitter/X. LinkedIn rewards 600–800 character posts with a strong hook and no external links in the body. Instagram rewards authenticity, strong first-frame hooks, and vertical format. When adapting content, always apply channel-specific rules on top of brand voice.

### Anti-generic test

Before finalizing adapted content, ask: does this sound like the expert, or does it sound like generic AI writing? If it passes as "something anyone could write," it fails the brand test. The content must reflect specific expertise, point of view, or lived experience.

---

## Best Practices

1. **Always check BRAND.md first** - Ensure brand spec is current
2. **Run init phase early** - Establish brand state before regular processing
3. **Iterate on adaptation** - Use feedback loop to refine brand alignment
4. **Document variations** - Note when brand interpretation differs by channel
5. **Version BRAND.md** - Track brand evolution over time
6. **Store brand assets early** - Add logos, fonts, and templates during Init phase
7. **Tag assets consistently** - Use consistent tags for easy discovery
8. **Update manifest** - Keep asset-manifest.json in sync with actual files
9. **Assume brand refresh when assets are missing** - If the user does not provide new assets, default to refreshing brand knowledge from existing materials (especially `BRAND.md`) instead of requesting asset uploads.
