import { describe, expect, it } from 'vitest';
import { MORE_LINKS, NAV_LINKS, navLinkClass } from './nav-links';

describe('header links', () => {
  it('leads with Concerts, pointing at /events', () => {
    expect(NAV_LINKS[0]).toEqual({ href: '/events', label: 'Concerts' });
  });

  it('lists each link once', () => {
    const hrefs = [...NAV_LINKS, ...MORE_LINKS].map(l => l.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('marks the current section with weight, not a filled block', () => {
    const active = navLinkClass(true);
    expect(active).toContain('font-semibold');
    expect(active).toContain('text-foreground');
    expect(active).not.toContain('bg-primary');
    expect(navLinkClass(false)).toContain('text-muted-foreground');
  });
});
