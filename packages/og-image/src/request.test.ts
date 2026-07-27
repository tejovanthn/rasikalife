import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { parsePath } from './request';

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
