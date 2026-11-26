/**
 * The header's links. Concerts leads: `/events` is the most-visited page and many readers are
 * at a concert. The rarer event pages sit in a small "More" menu.
 */
export const NAV_LINKS = [
  { href: '/events', label: 'Concerts' },
  { href: '/carnatic/compositions', label: 'Compositions' },
  { href: '/artists', label: 'Artists' },
  { href: '/carnatic/ragas', label: 'Ragas' },
];

export const MORE_LINKS = [
  { href: '/past-events', label: 'Past concerts' },
  { href: '/festivals', label: 'Festivals' },
  { href: '/venues', label: 'Venues' },
  { href: '/organisers', label: 'Organisers' },
  { href: '/events/new', label: 'List your event' },
];

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * Class for a nav link. The current section is carried by weight, not by a filled block
 * (DESIGN.md, "Current section is carried by weight"). `NavLink` adds `aria-current="page"`.
 */
export function navLinkClass(isActive: boolean, size: 'sm' | 'base' = 'sm'): string {
  const text = size === 'sm' ? 'text-sm' : 'text-base';
  const state = isActive
    ? 'text-foreground font-semibold'
    : 'text-muted-foreground font-medium hover:text-foreground';
  return `px-3 py-2 rounded-md ${text} ${state} transition-colors duration-150 ${FOCUS}`;
}
