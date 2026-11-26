import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STRIP_MIN_WIDTH, SwaraStrip } from './swara-strip';

const html = renderToStaticMarkup(
  createElement(SwaraStrip, {
    arohanam: 'S R2 G3 M1 P D2 N3 S',
    avarohanam: 'S N3 D2 P M1 G3 R2 S',
  })
);

describe('SwaraStrip on a phone', () => {
  it('scrolls sideways instead of shrinking the labels', () => {
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain(`min-w-[${STRIP_MIN_WIDTH}px]`);
  });

  it('draws labels at 14px, not the 11px that rendered near 6px on a phone', () => {
    expect(html).toContain('text-[14px]');
    expect(html).not.toContain('text-[11px]');
  });

  it('renders nothing for a raga with no usable scale', () => {
    expect(renderToStaticMarkup(createElement(SwaraStrip, {}))).toBe('');
  });
});
