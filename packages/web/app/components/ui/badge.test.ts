import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders a span, so it is valid inside a paragraph', () => {
    const html = renderToStaticMarkup(
      createElement('p', null, 'Raga: ', createElement(Badge, null, 'Kalyani'))
    );
    expect(html).toMatch(/^<p>Raga: <span /);
    expect(html).not.toContain('<div');
  });
});
