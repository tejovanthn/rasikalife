import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouterProvider, createStaticHandler, createStaticRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DetailPageHeader } from './DetailPageHeader';

const base = {
  title: 'Bindumalini',
  subtitle: 'Raga',
  shareUrl: 'https://rasika.life/x',
  shareTitle: 'x',
  shareDescription: 'x',
};

// Link needs a data router, so render through a static one.
async function render(props: Record<string, unknown> = {}) {
  const routes = [
    { path: '/', Component: () => createElement(DetailPageHeader, { ...base, ...props }) },
  ];
  const { query, dataRoutes } = createStaticHandler(routes);
  const context = await query(new Request('http://localhost/'));
  if (context instanceof Response) throw new Error('unexpected response');
  const router = createStaticRouter(dataRoutes, context);
  return renderToStaticMarkup(createElement(StaticRouterProvider, { router, context }));
}

describe('DetailPageHeader on a phone', () => {
  it('has no floating button for a signed-out reader', async () => {
    expect(await render()).not.toContain('fixed bottom-6');
  });

  it('keeps Share in the header row, not in a floating stack', async () => {
    const html = await render({ editUrl: '/x/edit' });
    const header = html.slice(0, html.indexOf('fixed bottom-6'));
    expect(header).toContain('aria-label="Share"');
    expect(html.slice(html.indexOf('fixed bottom-6'))).not.toContain('aria-label="Share"');
  });

  it('floats only the Edit button for a signed-in editor', async () => {
    const html = await render({ editUrl: '/x/edit' });
    expect(html).toContain('fixed bottom-6');
    expect(html).toContain('aria-label="Edit"');
  });

  it('shows no edit link without an editUrl', async () => {
    expect(await render()).not.toContain('Edit');
  });
});
