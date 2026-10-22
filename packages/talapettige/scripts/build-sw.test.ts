import { describe, expect, it } from 'vitest';
import { precacheEntries, precacheVersion } from './build-sw.mjs';

describe('precacheEntries', () => {
  it('maps prerendered pages to the paths the app requests', () => {
    const urls = precacheEntries([
      'index.html',
      'about/index.html',
      'history/index.html',
      'assets/root-abc123.js',
      'manifest.webmanifest',
    ]).map(entry => entry.url);

    expect(urls).toEqual([
      '/',
      '/about',
      '/assets/root-abc123.js',
      '/history',
      '/manifest.webmanifest',
    ]);
  });

  it('leaves out the worker itself, the SPA fallback and robots.txt', () => {
    const urls = precacheEntries(['sw.js', '__spa-fallback.html', 'robots.txt', '.DS_Store']).map(
      entry => entry.url
    );

    expect(urls).toEqual([]);
  });

  it('keeps the file each URL was read from', () => {
    expect(precacheEntries(['about/index.html'])).toEqual([
      { file: 'about/index.html', url: '/about' },
    ]);
  });
});

describe('precacheVersion', () => {
  const entries = precacheEntries(['index.html', 'assets/a.js']);

  it('changes when a page changes under the same name', () => {
    const before = precacheVersion(entries, file => (file === 'index.html' ? 'old' : 'js'));
    const after = precacheVersion(entries, file => (file === 'index.html' ? 'new' : 'js'));

    expect(before).not.toEqual(after);
  });

  it('is stable for the same build', () => {
    const read = (file: string) => file;

    expect(precacheVersion(entries, read)).toEqual(precacheVersion(entries, read));
  });
});
