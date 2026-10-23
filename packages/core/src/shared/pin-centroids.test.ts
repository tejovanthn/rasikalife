import { describe, expect, it } from 'vitest';
import { isPinCode, pinCentroid } from './pin-centroids';

describe('pinCentroid', () => {
  it('places a Malleswaram PIN in Malleswaram, not at the district centre', () => {
    const hit = pinCentroid('560 003');
    expect(hit?.lat).toBeCloseTo(13.0, 1);
    expect(hit?.lng).toBeCloseTo(77.57, 1);
  });

  it('knows nothing outside the table', () => {
    expect(pinCentroid('411001')).toBeNull();
  });
});

describe('isPinCode', () => {
  it('takes six digits not starting with zero', () => {
    expect(isPinCode('560003')).toBe(true);
    expect(isPinCode('060003')).toBe(false);
  });
});
