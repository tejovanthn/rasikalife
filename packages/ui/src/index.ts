/**
 * Shared primitives and tokens for Rasika apps.
 *
 * Seeded with only what Rasika Classes needs. Extracting `packages/web`'s component library into
 * here is explicitly **not** a prerequisite for anything — that refactor touches every wiki route
 * and would have stalled this project before it started. Web migrates opportunistically or not
 * at all; visual consistency comes from `tailwind-preset.cjs` and `tokens.css`, which both apps
 * do share.
 *
 * Nothing here may import from `@rasika/core` outside a `/client` subpath. This package is
 * browser-only, and the core main entry pulls in ElectroDB and the AWS SDK.
 */
export { cn } from './cn';
export { Button, buttonVariants } from './components/button';
export type { ButtonProps } from './components/button';
export {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
} from './components/card';
export type { BadgeTone } from './components/card';
export { Dialog } from './components/dialog';
export { Field, Input, Label, Select, Textarea } from './components/field';
export { AppShell, NavItem, PageTitle, SectionTitle, navItemClasses } from './components/shell';
export { Table, TableScroll, Td, Th, Tr } from './components/table';
export { ToastProvider, useToast } from './components/toast';
export type { ToastTone } from './components/toast';
