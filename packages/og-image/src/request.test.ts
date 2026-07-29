import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { isAllowedPhotoUrl, parsePath } from './request';

function eventWithPath(rawPath: string): APIGatewayProxyEventV2 {
  return { rawPath } as APIGatewayProxyEventV2;
}

describe('parsePath', () => {
  it('parses /og/{type}/{id}', () => {
    expect(parsePath(eventWithPath('/og/artist/abc123'))).toEqual({
      type: 'artist',
      id: 'abc123',
    });
  });

  it('parses /{type}/{id} without the og prefix', () => {
    expect(parsePath(eventWithPath('/raga/xyz'))).toEqual({ type: 'raga', id: 'xyz' });
  });

  it('rejects an unknown type but still surfaces the id', () => {
    expect(parsePath(eventWithPath('/og/venue/abc'))).toEqual({ type: null, id: 'abc' });
  });

  it('rejects a path missing an id', () => {
    expect(parsePath(eventWithPath('/og/artist'))).toEqual({ type: null, id: null });
  });

  it('rejects an empty path', () => {
    expect(parsePath(eventWithPath('/'))).toEqual({ type: null, id: null });
  });
});

// This Lambda sits on a public unauthenticated URL and fetches whatever `artist.photoUrl`
// holds, and that field is a bare z.string().url() any editor can set. The allowlist is the
// only thing standing between that and an SSRF primitive, so each way in gets a test.
describe('isAllowedPhotoUrl', () => {
  const CDN = 'https://d123abc.cloudfront.net';

  it('allows a photo served by the CDN the uploads land on', () => {
    expect(isAllowedPhotoUrl(`${CDN}/images/artist/abc/portrait.jpg`, CDN)).toBe(true);
  });

  it('refuses the EC2 instance metadata endpoint', () => {
    expect(
      isAllowedPhotoUrl('http://169.254.169.254/latest/meta-data/iam/security-credentials/', CDN)
    ).toBe(false);
  });

  it('refuses other hosts, including ones that merely start the same', () => {
    expect(isAllowedPhotoUrl('https://evil.example.com/x.jpg', CDN)).toBe(false);
    expect(isAllowedPhotoUrl('https://d123abc.cloudfront.net.evil.com/x.jpg', CDN)).toBe(false);
    expect(isAllowedPhotoUrl('http://10.0.0.5/internal', CDN)).toBe(false);
  });

  it('refuses plaintext http even on the right host', () => {
    expect(isAllowedPhotoUrl('http://d123abc.cloudfront.net/x.jpg', CDN)).toBe(false);
  });

  it('refuses non-http schemes', () => {
    expect(isAllowedPhotoUrl('file:///etc/passwd', CDN)).toBe(false);
    expect(isAllowedPhotoUrl('data:image/png;base64,AAAA', CDN)).toBe(false);
  });

  it('refuses an unparseable URL rather than throwing', () => {
    expect(isAllowedPhotoUrl('not a url', CDN)).toBe(false);
  });

  it('refuses everything when the CDN is unconfigured, rather than allowing everything', () => {
    expect(isAllowedPhotoUrl(`${CDN}/x.jpg`, '')).toBe(false);
  });
});
