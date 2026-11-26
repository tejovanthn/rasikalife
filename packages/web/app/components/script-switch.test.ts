import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ScriptSwitch } from './script-switch';

const html = (script: 'roman' | 'tamil') =>
  renderToStaticMarkup(createElement(ScriptSwitch, { script, onChange: () => {} }));

describe('ScriptSwitch', () => {
  it('offers Roman, Devanagari, Tamil, Telugu and Kannada', () => {
    const out = html('roman');
    for (const value of ['roman', 'devanagari', 'tamil', 'telugu', 'kannada']) {
      expect(out).toContain(`value="${value}"`);
    }
  });

  it('checks only the current script', () => {
    expect(html('tamil').match(/checked/g)).toHaveLength(1);
    expect(html('tamil')).toMatch(/value="tamil"[^>]*checked|checked[^>]*value="tamil"/);
  });

  it('labels each native script with its language and keeps 44px targets', () => {
    const out = html('roman');
    expect(out).toContain('lang="ta"');
    expect(out).toContain('min-h-11');
  });
});
