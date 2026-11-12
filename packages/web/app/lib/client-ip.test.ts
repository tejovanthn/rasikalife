import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders, parseForwardedFor, parseIp, parseViewerAddress } from './client-ip';

describe('parseViewerAddress (CloudFront-Viewer-Address)', () => {
  it('reads ip:port for IPv4', () => {
    expect(parseViewerAddress('203.0.113.9:5555')).toBe('203.0.113.9');
  });
  it('reads IPv6 with a trailing port and no brackets', () => {
    expect(parseViewerAddress('2001:db8::1:5555')).toBe('2001:db8::1');
    expect(parseViewerAddress('2001:DB8:0:0:0:0:0:1:443')).toBe('2001:db8:0:0:0:0:0:1');
  });
  it('reads bracketed IPv6 with a port', () => {
    expect(parseViewerAddress('[2001:db8::1]:5555')).toBe('2001:db8::1');
  });
  it('refuses junk and a bad port', () => {
    expect(parseViewerAddress('')).toBeUndefined();
    expect(parseViewerAddress(null)).toBeUndefined();
    expect(parseViewerAddress('not-an-ip:80')).toBeUndefined();
    expect(parseViewerAddress('999.1.1.1:80')).toBeUndefined();
  });
});

describe('parseIp and parseForwardedFor', () => {
  it('reads a bare address', () => {
    expect(parseIp('203.0.113.9')).toBe('203.0.113.9');
    expect(parseIp('2001:db8::1')).toBe('2001:db8::1');
    expect(parseIp('[2001:db8::1]')).toBe('2001:db8::1');
  });
  it('takes the first X-Forwarded-For entry', () => {
    expect(parseForwardedFor('198.51.100.7, 10.0.0.1, 130.176.1.1')).toBe('198.51.100.7');
    expect(parseForwardedFor('2001:db8::7,10.0.0.1')).toBe('2001:db8::7');
  });
  it('refuses junk', () => {
    expect(parseForwardedFor('unknown, 1.2.3.4')).toBeUndefined();
    expect(parseForwardedFor(null)).toBeUndefined();
    expect(parseIp('<script>')).toBeUndefined();
  });
});

describe('clientIpFromHeaders', () => {
  it('prefers the edge-set header, then the viewer address, then X-Forwarded-For', () => {
    const all = new Headers({
      'x-rasika-client-ip': '203.0.113.1',
      'cloudfront-viewer-address': '203.0.113.2:1',
      'x-forwarded-for': '203.0.113.3',
    });
    expect(clientIpFromHeaders(all)).toBe('203.0.113.1');
    all.delete('x-rasika-client-ip');
    expect(clientIpFromHeaders(all)).toBe('203.0.113.2');
    all.delete('cloudfront-viewer-address');
    expect(clientIpFromHeaders(all)).toBe('203.0.113.3');
  });
  it('is undefined with no header', () => {
    expect(clientIpFromHeaders(new Headers())).toBeUndefined();
  });
});
