# Copilot Instructions — Rasika.life

This file provides context for AI coding assistants working in this repository.

## Design Context

### Users
**Community-first** — every person in the Indian classical music ecosystem is the audience: casual listeners, serious rasikas, students, teachers, vidwans, organisers, and administrators. No single user type is privileged. Many users browse on **mobile while at concerts** — checking a raga mid-performance, logging a setlist, sharing a link with the person next to them. Others sit at a desk exploring compositions in depth. Both contexts must work equally well.

### Brand Personality
**Warm · Accessible · Welcoming**

Think *Wikipedia + warmth*: the same trustworthiness and depth, but friendlier and more human. Celebrating a living tradition, not preserving a relic.

Emotional targets (in priority order):
1. **Curiosity** — every page should make you want to click something else
2. **Warmth** — this is a gathering place, not a database
3. **Reverence** — the music deserves respect
4. **Authority** — when it says a raga has X lakshanas, you trust it

### Aesthetic Direction
- **Reference + warmth** — spirit of Wikipedia but warmer, not clinical
- **Warm palette anchored to the tradition** — rust/orange primary (HSL 17°) evokes earthenware, temple stone, the warmth of a kutcheri hall
- **Multi-script native** — Devanagari, Tamil, Telugu, Kannada, and Latin render via Noto Sans; script switching is a first-class feature
- **Mobile-first in reality** — many users are literally at a concert; 44px+ touch targets, scannable hierarchy
- NOT: cold clinical reference, music journalism bold aesthetic, generic SaaS blue/gradient, "ethnic" decoration overload

### Design System Rules
- **Framework**: React Router v7, Tailwind CSS, shadcn/ui (Radix primitives)
- **Tokens**: All color via CSS variables — `--primary`, `--success`, `--warning`, `--destructive`, `--raga`, `--tala`, `--language`. NEVER use raw Tailwind palette classes like `text-green-600` or `bg-amber-50`; these break dark mode and theming.
- **Dark mode**: Supported via `.dark` class; every new component needs dark variants tested
- **Focus**: Every interactive element needs `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`; never `focus:outline-none` without a ring replacement
- **Motion**: Animate `opacity`, `transform`, `grid-template-rows` — never layout properties like `max-height`, `width`, `top`
- **Touch targets**: Minimum 44×44px for all interactive elements
- **Imports in web routes**: Never import from bare `@rasika/core` in route files — use subpath exports (`@rasika/core/domain/artist/client`, etc.)

### Design Principles
1. **Community over catalog** — surfaces that help users connect, contribute, and discover are more valuable than purely informational displays
2. **Legible at a glance** — a student checking a raga mid-concert has seconds; hierarchy and scannability are paramount
3. **Culturally resonant** — warm earth tones, expressive but not garish, respectful of the tradition's depth
4. **Mobile-native patterns** — FABs for primary actions on detail pages, collapsible sections on mobile, no hover-only interactions on critical paths
5. **Token discipline** — every color must come from the design token system; hard-coded palette classes are a bug
