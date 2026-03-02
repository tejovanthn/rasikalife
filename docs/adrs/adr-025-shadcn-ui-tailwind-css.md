# ADR-025: shadcn/ui + Tailwind CSS for UI Components

## Status
Accepted

## Context
The web frontend needed a UI component strategy that provided:

- **Accessible components**: Keyboard navigation, ARIA, screen reader support out of the box
- **Customisability**: Components should be fully owned and styled to match the platform's aesthetic
- **No runtime overhead**: Avoid large component library bundles
- **React Router v7 compatibility**: Works with SSR and the existing stack
- **Developer experience**: Good TypeScript support, easy to extend

We evaluated full component libraries (MUI, Chakra UI, Mantine) and the copy-owned model (shadcn/ui).

## Decision
Use **shadcn/ui** as the component foundation with **Tailwind CSS** for styling.

shadcn/ui is not an npm dependency — components are copied into `packages/web/app/components/ui/` and owned directly. Each component is built on Radix UI primitives (for accessibility) and styled with Tailwind CSS + `class-variance-authority`.

## Consequences

### Positive
- ✅ **Owned code**: Components live in the repo, fully customisable with no upgrade friction
- ✅ **Accessible primitives**: Radix UI handles all ARIA/keyboard behaviour
- ✅ **No bundle bloat**: Only components actually used are in the codebase
- ✅ **Tailwind co-location**: Styles live alongside component markup
- ✅ **CVA for variants**: `class-variance-authority` provides type-safe variant APIs
- ✅ **SSR safe**: No client-side-only rendering issues
- ✅ **`cn()` utility**: `tailwind-merge` + `clsx` via `~/lib/utils` for safe class composition

### Negative
- ❌ **Manual updates**: shadcn/ui component improvements must be manually incorporated
- ❌ **Copy proliferation**: Each project copies components independently
- ❌ **Tailwind learning curve**: Utility-first CSS requires team familiarity

## Alternatives Considered

### Material UI (MUI)
- **Pros**: Comprehensive, well-documented, large community
- **Cons**: Heavy bundle, opinionated design system, difficult to customise deeply
- **Why rejected**: Design lock-in and bundle size

### Chakra UI
- **Pros**: Good DX, accessible, themeable
- **Cons**: Runtime CSS-in-JS overhead, SSR complexity
- **Why rejected**: Runtime overhead incompatible with serverless/streaming SSR goals

### Headless UI (by Tailwind Labs)
- **Pros**: Accessible, Tailwind-native
- **Cons**: Fewer components than Radix UI, less active development
- **Why rejected**: shadcn/ui covers more components with the same Tailwind approach

## Implementation Details

Component configuration in `packages/web/components.json`:
- Style: `default`, base color: `neutral`, CSS variables enabled
- Components live in `~/components/ui/`
- Utility function at `~/lib/utils` exports `cn()` helper

Current components: `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `navigation-menu`, `pagination`, `select`, `separator`, `sheet`, `table`, `tabs`, `textarea`, `sonner` (toast).

Toast notifications use **Sonner** (`sonner` package) rather than the shadcn/ui toast component, as Sonner provides a simpler API and better stacking behaviour.

## References
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [class-variance-authority](https://cva.style/docs)
- [Sonner](https://sonner.emilkowal.ski/)
