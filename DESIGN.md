---
name: Rasika.life
description: A warm, community-built reference for Indian classical arts, legible at a glance in a concert hall.
colors:
  fired-earthenware: "#bc4110"
  fired-earthenware-dark: "#ed5e25"
  hall-light: "#ffede5"
  lamp-black: "#130a06"
  ink: "#181310"
  warm-white: "#fffbfa"
  paper-ink: "#e7e5e4"
  clay-surface: "#f2e0d9"
  ash-rose: "#e4d4cd"
  ash-rose-deep: "#32211b"
  quiet-ink: "#5e5755"
  quiet-ink-dark: "#9e9794"
  clay-line: "#a66f59"
  clay-line-dark: "#3c2820"
  raga-violet: "#ebdef7"
  raga-violet-ink: "#4d1f7a"
  tala-amber: "#fbebda"
  tala-amber-ink: "#8a4d0f"
  language-indigo: "#dee7f7"
  language-indigo-ink: "#1f3d7a"
  affirm-green: "#21c45d"
  caution-amber: "#f59f0a"
  alarm-red: "#990000"
  alarm-red-dark: "#ff0000"
typography:
  display:
    fontFamily: "Noto Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Noto Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Noto Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Noto Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "normal"
  label:
    fontFamily: "Noto Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.fired-earthenware}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.fired-earthenware}"
    textColor: "{colors.warm-white}"
  button-outline:
    backgroundColor: "{colors.hall-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  input-text:
    backgroundColor: "{colors.hall-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.clay-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge-raga:
    backgroundColor: "{colors.raga-violet}"
    textColor: "{colors.raga-violet-ink}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-tala:
    backgroundColor: "{colors.tala-amber}"
    textColor: "{colors.tala-amber-ink}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-language:
    backgroundColor: "{colors.language-indigo}"
    textColor: "{colors.language-indigo-ink}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Rasika.life

## 1. Overview

**Creative North Star: "The Sabha Notebook"**

The annotated notebook a rasika keeps at the sabha. Dense, personal, warm with use, built by many hands over many seasons. It is not a museum vitrine and it is not a database dump: it is the thing you actually carry, marked up in the margins, that gets more valuable as more people write in it.

Everything follows from that. The surface is warm paper, never clinical white, because the notebook has been handled. Type is one humanist sans across five scripts, because the notebook does not switch alphabets grudgingly. Depth is almost absent, because paper does not float. Colour is spent on two things only: the accent that marks an action, and the three domain hues that let a reader tell a raga from a tala at a glance while a concert is going on around them.

The system explicitly rejects four things PRODUCT.md names. It is not a **cold, clinical reference tool**: no bleached white, no hairline grey on grey. It is not **music-journalism editorial**: no aggressive display type, no dark magazine posturing. It is not **startup SaaS**: no generic blue, no gradient CTAs, no AI-slop aesthetic. And it is not **"ethnic" decoration overload**: the cultural resonance lives in the palette and the multi-script typography, never in mandala borders or ornamental frames.

**Key Characteristics:**
- One warm hue (17°) tints every surface, border, and neutral; nothing on screen is untinted grey.
- Five scripts, one family. Noto Sans carries Latin, Devanagari, Tamil, Telugu, and Kannada as equals.
- Flat at rest. Shadow is a response to interaction, not a decoration.
- Three domain colours (raga, tala, language) form a fixed vocabulary a returning reader learns once.
- Density is a feature. Screens are designed to fill as the archive grows, not to look good empty.
- Legible at arm's length in a dim hall, on a phone, mid-performance.

## 2. Colors

A single warm hue at 17° runs through every surface, line, and neutral, with three cool domain hues admitted for one job each.

### Primary
- **Fired Earthenware** (`#bc4110` light, `#ed5e25` dark): The one accent. Links, primary buttons, the focus ring, current selection. Named for the material PRODUCT.md names: earthenware, temple stone. The two values are the same clay at two temperatures, and they are deliberately different lightnesses so that link text clears 4.73:1 on warm paper and 5.78:1 on lamp black. It is never used as decoration, never as a fill behind body text, never as a gradient.

### Secondary
- **Raga Violet** (`#ebdef7` surface / `#4d1f7a` ink): Marks a raga, and only a raga.
- **Tala Amber** (`#fbebda` surface / `#8a4d0f` ink): Marks a tala, and only a tala.
- **Language Indigo** (`#dee7f7` surface / `#1f3d7a` ink): Marks a script or language, and only that.

These three are a vocabulary, not a palette. A reader who learns them once can scan a composition page and separate raga from tala without reading a word, which is the whole point when the reader is checking something mid-concert.

### Tertiary
- **Affirm Green** (`#21c45d`): Success only.
- **Caution Amber** (`#f59f0a`): Warning only. Note it sits close to Tala Amber; caution amber is saturated and used on text or icons, tala amber is a pale surface behind a badge. Never let them meet in the same component.
- **Alarm Red** (`#990000` light, `#ff0000` dark): Destructive actions and error text. The dark value is much lighter than the light one on purpose: the shared value read 2.19:1 on lamp black and made form errors nearly invisible.

### Neutral
- **Hall Light** (`#ffede5`): The page. Warm paper, not white.
- **Lamp Black** (`#130a06`): The dark page. Warm black, not neutral black.
- **Clay Surface** (`#f2e0d9`): Cards and raised panels, one step down from the page.
- **Ash Rose** (`#e4d4cd` light, `#32211b` dark): Muted blocks, placeholder avatars, the About panel.
- **Quiet Ink** (`#5e5755` light, `#9e9794` dark): Secondary text, captions, metadata. Clears 4.5:1 on both the page and on Ash Rose.
- **Clay Line** (`#a66f59` light, `#3c2820` dark): Borders and dividers.
- **Ink** (`#181310`) / **Paper Ink** (`#e7e5e4`): Body text.
- **Warm White** (`#fffbfa`): The label on a filled accent button. Not `#ffffff`.

### Named Rules

**The One Hue Rule.** Every surface, border, neutral, and text colour sits on hue 17. There is no untinted grey anywhere in this system, and no pure `#000` or `#fff`: a token at lightness 0% or 100% discards its hue and saturation entirely, which is the same failure by another route. Nine tokens once resolved to pure black or white and two more carried hue `-21`, which CSS normalises to 339 and renders rose. Nothing looked broken in either case.

**The Filled Surface Rule.** Any token ending in `-foreground` names a label sitting on its matching fill, and that pairing is a contrast obligation, not a formality. White on `--success` read 2.30:1, and `bg-success` is what the moderator Approve button uses, so the worst pairing on the site was on an action. Every `-foreground` pair is asserted in `app/lib/contrast.test.ts`.

**The Two Temperatures Rule.** Light and dark are not one value on two backgrounds. `--primary`, `--primary-foreground`, and `--destructive` all differ between themes because a single value cannot clear contrast on both. Any new colour token must be checked in both blocks before it ships.

**The Vocabulary Rule.** Raga violet, tala amber, and language indigo mean exactly one thing each. Using raga violet for emphasis, or tala amber for a warning, destroys a scanning aid it took a reader months to internalise.

## 3. Typography

**Display Font:** Noto Sans (with `ui-sans-serif`, `system-ui`, `sans-serif`)
**Body Font:** Noto Sans (same stack)
**Script Companions:** Noto Sans Devanagari, Noto Sans Tamil, Noto Sans Telugu, Noto Sans Kannada, all at weights 400/500/600/700

**Character:** One humanist sans doing every job, chosen for coverage rather than flavour. The personality does not come from the typeface; it comes from the warmth behind it and the confidence of the weight jumps. Noto Sans is the only family here that renders Latin, Devanagari, Tamil, Telugu, and Kannada with matching proportions, so a composition title in Tamil sits beside its English transliteration without either looking like a fallback.

### Hierarchy
- **Display** (800, 2.25rem, rising to 3rem at `lg`, tight tracking): Page titles, one per screen. The extrabold weight is the single loudest thing in the system.
- **Headline** (600, 1.875rem, tight tracking): Major section breaks on long documents.
- **Title** (600, 1.25rem): Section headings inside a page. The workhorse.
- **Body** (400, 1rem, 1.75 line-height): Prose. Cap at 65–75ch; biography and description blocks are the main crawlable content on the site and must stay readable at length.
- **Label** (500, 0.875rem, 0.05em tracking, uppercase): Subsection markers and metadata rows. Uppercase plus letter-spacing is what separates a label from a title at the same size.

### Named Rules

**The Weight Jump Rule.** Hierarchy is carried by weight, not by size alone. Display is 800 against Title's 600 against Body's 400. A flat scale where everything is semibold reads as noise, and this system leans on scanability harder than most.

**The Script Parity Rule.** Indic script is never smaller, never lighter, and never a fallback. If a term exists in Tamil and in transliteration, both get the same treatment. A script selector is a first-class control, not a footnote.

**The Stored Name Rule.** Person names render exactly as stored and never pass through transliteration. Musical terms (raga, tala, composition titles, lyrics) do transliterate. The split is per field, not per page.

## 4. Elevation

Flat at rest, lift on response. Surfaces are separated by tone, not by shadow: the page is Hall Light, a card steps down to Clay Surface, a muted block to Ash Rose. That tonal ladder does the structural work. Shadow is reserved for two cases: a hover response on something clickable, and a layer that genuinely floats above the page, which in practice means the sticky navigation and modal surfaces.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): The near-invisible baseline on a card. Present so the hover has somewhere to travel from.
- **Hover lift** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): The response when a card is interactive. Paired with a 200ms transition on shadow alone.
- **Floating layer** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): Sticky navigation, dialogs, dropdowns. Things that are literally above the page.

### Named Rules

**The Response-Only Rule.** A shadow that is not answering an interaction or marking a floating layer is decoration, and decoration is prohibited here. If a static panel has a shadow, use a tonal step instead.

**The 2014 Test.** If a surface looks like a 2014 mobile app, the shadow is too dark and its blur too small. Shadows in this system are wide, faint, and warm-neutral, never a hard drop.

## 5. Components

Quiet, legible, unafraid of density. Components are shadcn/ui over Radix primitives: familiar shapes, standard behaviour, no invented affordances. The warmth comes from the palette and the content, never from the control.

### Buttons
- **Shape:** Gently curved (6px, `--radius` minus 2). Never pill, never square.
- **Primary:** Fired Earthenware fill with a white label, 40px tall, 16px horizontal padding. Reserved for the one main action on a surface.
- **Hover / Focus:** Fill drops to 90% opacity on hover, 150ms on colour only. Focus is a 2px Fired Earthenware ring with a 2px offset, and it is never removed without a replacement.
- **Outline / Secondary / Ghost:** Outline carries a Clay Line border on the page colour; ghost is transparent until hover. Both fill with Ash Rose on hover.
- **Sizes:** 40px default, 36px small, 44px large, 40px square for icon-only. Touch targets on public mobile surfaces must reach 44px; use large or add `min-h-11` rather than shipping a 36px tap target where a phone user is expected.

### Chips
- **Style:** Fully round (9999px), 12px text at weight 600, 10px horizontal padding, transparent border.
- **Domain variants:** `raga`, `tala`, and `language` each pair their pale surface with their own deep ink. These are the vocabulary from section 2, and they are the reason chips exist here.
- **State:** Static markers, not filters. A chip in this system labels a thing; it does not toggle.

### Cards / Containers
- **Corner Style:** Gently curved (8px).
- **Background:** Clay Surface against the Hall Light page, one tonal step of separation.
- **Shadow Strategy:** Resting card at rest, Hover lift when interactive. See Elevation.
- **Border:** 1px Clay Line, always full, never a coloured stripe on one edge.
- **Internal Padding:** 24px, dropping to 12px vertical for compact rows.
- **When not to use one:** A list of rows is a list, not a stack of cards. A title, a date and a role belong in a hairline-separated row with a leading `<time>` column, not in a bordered container each.

### Inputs / Fields
- **Style:** 1px Clay Line on the page colour, 6px radius, 40px tall, 12px horizontal padding. 16px text on mobile and 14px from `md` up, because 16px is what stops iOS zooming on focus.
- **Focus:** 2px Fired Earthenware ring with a 2px offset. The outline is removed only where the ring replaces it.
- **Error:** Alarm Red text below the field. **Disabled:** 50% opacity with the cursor blocked.
- Every input has a `<Label htmlFor>`. A placeholder is not a label.

### Navigation
- **Style:** Sticky top bar on the page colour with a Floating layer shadow, 56px tall on mobile and 64px from `md`.
- **States:** Links are Fired Earthenware, underlining on hover. Current section is carried by weight, not by a coloured bar.
- **Mobile:** Collapses to a sheet. Nothing critical is reachable by hover alone.

### The Domain Badge
The signature component. A pale domain surface with its own deep ink, fully rounded, carrying a raga, tala, or language name. It exists so a reader scanning a composition page can separate the three without reading, which is what makes this a reference for people in a hall rather than a database on a desk. Three variants, three meanings, no others.

## 6. Do's and Don'ts

### Do:
- **Do** take every colour from the token system. `--primary`, `--muted`, `--raga`, `--warning`, and their siblings are the entire palette.
- **Do** check both themes when adding or changing a colour token. Run `app/lib/contrast.test.ts`, which parses `globals.css` and asserts each on-screen pair against 4.5:1 for text and 3:1 for the focus ring.
- **Do** keep every surface, neutral, and border on hue 17.
- **Do** give Indic script the same size, weight, and prominence as Latin.
- **Do** hide a section cleanly when it has no content. A bare heading over nothing is worse than an absent section.
- **Do** reach 44px touch targets on anything a phone user taps at a concert.
- **Do** use `transition-colors`, `transition-opacity`, and `transition-shadow`. Motion conveys state and nothing else.
- **Do** design for density. The archive grows; screens should fill well, not look sparse-by-design.

### Don't:
- **Don't** hard-code a Tailwind palette class. `text-amber-600` and `bg-green-50` are bugs, not style choices: they break dark mode and they break future theming.
- **Don't** build a **cold, clinical reference tool**. No bleached white, no untinted grey, none of Wikipedia's visual bleakness.
- **Don't** reach for **music-journalism editorial**. No Pitchfork typography, no dark magazine aesthetic.
- **Don't** ship **startup SaaS**. No generic blue, no gradient CTAs, no AI slop aesthetic.
- **Don't** apply **"ethnic" decoration overload**. No mandala patterns, no ornate borders. The culture is in the palette and the scripts.
- **Don't** use `border-left` or `border-right` above 1px as a coloured accent stripe. Use a full border, a background tint, or nothing.
- **Don't** use gradient text, `background-clip: text`, or decorative glassmorphism anywhere.
- **Don't** repeat an identical card grid of icon plus heading plus generic line. Three cards saying "Browse other musicians" tell a reader nothing they could not guess.
- **Don't** nest a card inside a card, ever.
- **Don't** animate layout properties. `prefers-reduced-motion` is honoured globally and must stay that way.
- **Don't** rely on hover for anything critical. Many readers are on a phone in a dark hall.
- **Don't** put a raga colour on a non-raga, or a tala colour on a warning. The vocabulary only works while it is exact.
- **Don't** show a counter that reads "0 rasikas attended". An empty community signal is worse than no signal.
