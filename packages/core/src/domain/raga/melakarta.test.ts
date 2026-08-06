import { describe, expect, it } from 'vitest';
import {
  CHAKRA_NAMES,
  chakraNameOfMela,
  chakraOfMela,
  melakartaScale,
  positionOfMela,
} from './melakarta';

describe('chakraOfMela', () => {
  it('groups 72 melakartas into 12 chakras of 6', () => {
    expect(chakraOfMela(1)).toBe(1);
    expect(chakraOfMela(6)).toBe(1);
    expect(chakraOfMela(7)).toBe(2);
    expect(chakraOfMela(12)).toBe(2);
    expect(chakraOfMela(37)).toBe(7);
    expect(chakraOfMela(72)).toBe(12);
  });

  it('rejects melas outside 1-72', () => {
    expect(() => chakraOfMela(0)).toThrow(RangeError);
    expect(() => chakraOfMela(73)).toThrow(RangeError);
    expect(() => chakraOfMela(2.5)).toThrow(RangeError);
  });
});

describe('positionOfMela', () => {
  it('cycles 1-6 within each chakra', () => {
    expect(positionOfMela(1)).toBe(1);
    expect(positionOfMela(6)).toBe(6);
    expect(positionOfMela(7)).toBe(1);
    expect(positionOfMela(12)).toBe(6);
    expect(positionOfMela(72)).toBe(6);
  });
});

describe('chakraNameOfMela', () => {
  it('maps melas to the right chakra name', () => {
    expect(chakraNameOfMela(1)).toBe('Indu');
    expect(chakraNameOfMela(6)).toBe('Indu');
    expect(chakraNameOfMela(22)).toBe('Veda');
    expect(chakraNameOfMela(65)).toBe('Rudra');
    expect(chakraNameOfMela(72)).toBe('Aditya');
  });

  it('has all 12 names, in order', () => {
    expect(CHAKRA_NAMES).toHaveLength(12);
    expect(CHAKRA_NAMES[0]).toBe('Indu');
    expect(CHAKRA_NAMES[11]).toBe('Aditya');
  });
});

describe('melakartaScale', () => {
  it('matches known melakartas', () => {
    expect(melakartaScale(1)).toBe('S R1 G1 M1 P D1 N1 S'); // Kanakangi
    expect(melakartaScale(8)).toBe('S R1 G2 M1 P D1 N2 S'); // Hanumatodi
    expect(melakartaScale(22)).toBe('S R2 G2 M1 P D2 N2 S'); // Kharaharapriya
    expect(melakartaScale(29)).toBe('S R2 G3 M1 P D2 N3 S'); // Shankarabharanam
    expect(melakartaScale(65)).toBe('S R2 G3 M2 P D2 N3 S'); // Mechakalyani
    expect(melakartaScale(72)).toBe('S R3 G3 M2 P D3 N3 S'); // Rasikapriya
  });

  it('produces a scale for every mela 1-72, bookended by the octave Sa', () => {
    for (let mela = 1; mela <= 72; mela++) {
      const swaras = melakartaScale(mela).split(' ');
      expect(swaras).toHaveLength(8);
      expect(swaras[0]).toBe('S');
      expect(swaras[7]).toBe('S');
    }
  });

  it("shares a chakra's R/G across its six melas", () => {
    const chakraTwo = [7, 8, 9, 10, 11, 12].map(melakartaScaleSwaras);
    for (const [r, g] of chakraTwo) {
      expect([r, g]).toEqual(['R1', 'G2']);
    }
  });
});

function melakartaScaleSwaras(mela: number): [string, string] {
  const swaras = melakartaScale(mela).split(' ');
  return [swaras[1], swaras[2]];
}
