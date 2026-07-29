# Rasika.life Design Context

## Design Context

### Users
**Community-first** — every person in the Indian classical music ecosystem is the audience: casual listeners, serious rasikas, students, teachers, vidwans, organisers, and administrators. No single user type is privileged. Many users browse on **mobile while at concerts** — checking a raga mid-performance, logging a setlist, sharing a link with the person next to them. Others sit at a desk exploring compositions in depth. Both contexts must work equally well. Skews toward people already embedded in the tradition rather than total newcomers, but newcomers should never feel locked out.

### Brand Personality
**Warm · Accessible · Welcoming**

The tone is a knowledgeable friend who loves this music as deeply as you do — not a cold encyclopedia, not a museum archive. Think *Wikipedia + warmth*: the same trustworthiness and depth, but friendlier and more human. Enthusiastic without being overwhelming. Celebrating a living tradition, not preserving a relic.

The four emotional targets, in order of priority:
1. **Curiosity** — every page should make you want to click something else, learn one more thing
2. **Warmth** — this is a gathering place, not a database
3. **Reverence** — the music deserves respect; the interface shouldn't feel disposable
4. **Authority** — when it says a raga has X lakshanas, you trust it

### Aesthetic Direction
- **Reference + warmth** — the spirit of Wikipedia (trustworthy, deep, community-built) but with visual warmth, not clinical whiteness. Not cold, not flashy.
- **Warm palette anchored to the tradition** — the rust/orange primary (HSL 17°) is deliberate; it evokes earthenware, temple stone, the warmth of a kutcheri hall. Lean into it. Domain tokens (raga = purple, tala = amber, language = blue) are part of the vocabulary.
- **Multi-script native** — Devanagari, Tamil, Telugu, Kannada, and Latin all render with Noto Sans. Script switching is a first-class feature. Never treat Indic script display as a footnote.
- **Mobile-first in reality** — generous touch targets (44px+), scannable hierarchy, no hover-only interactions on critical paths. Many users are literally at a concert.
- **Richer as it grows** — as the database fills, screens can breathe with more content. Don't design for emptiness; design for density done well.
- **Production-polished** — intentional and complete, not pixel-obsessed. Every screen should feel finished.

### Anti-References
- NOT: cold, clinical reference tool (avoid Wikipedia's visual bleakness)
- NOT: music journalism editorial (Pitchfork's aggressive typography, dark/magazine aesthetic)
- NOT: startup SaaS (generic blue, gradient CTAs, AI slop aesthetic)
- NOT: "ethnic" decoration overload (no excessive mandala patterns, overly ornate borders)

### Design System (from codebase)
- **Framework**: React Router v7, Tailwind CSS, shadcn/ui (Radix primitives)
- **Tokens**: CSS HSL variables via `globals.css`; all color via `--primary`, `--success`, `--warning`, `--destructive`, `--raga`, `--tala`, `--language` — NEVER raw Tailwind color classes
- **Dark mode**: Supported via `.dark` class; every new pattern needs dark variants
- **Radius**: `--radius: 0.5rem` (soft but not pill-shaped)
- **Motion**: `prefers-reduced-motion` respected globally in CSS; use `transition-colors`, `transition-opacity`, `transition-[grid-template-rows]` — avoid animating layout properties
- **Focus**: All interactive elements need `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`; never `focus:outline-none` without a replacement

### Design Principles
1. **Community over catalog** — surfaces that help users connect, contribute, and discover together are more valuable than purely informational displays. A "0 rasikas attended" state is worse than no counter at all.
2. **Legible at a glance** — a student checking a raga mid-concert has seconds. Hierarchy and scannability are paramount; the most important thing on the screen should be unmissable.
3. **Culturally resonant** — visual choices should feel native to Indian classical arts: warm earth tones, expressive but not garish, respectful of the tradition's depth. No generic SaaS aesthetic.
4. **Mobile-native patterns** — 44px+ touch targets, FABs for primary actions on detail pages, collapsible sections on mobile, no information that requires hover to access.
5. **Token discipline** — every color on screen must come from the design token system. Hard-coded Tailwind palette classes (`text-green-600`, `bg-amber-50`) are a bug, not a style choice. This enforces dark mode correctness and future theming flexibility.
