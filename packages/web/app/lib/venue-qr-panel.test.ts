import { describe, expect, it } from 'vitest';
import { canAct, formatLastScanned, panelActionUrl, sortPanelRows } from './venue-qr-panel';
import type { PanelStat } from './venue-qr-panel';

const row = (over: Partial<PanelStat>): PanelStat => ({
  code: 'AAAAAAAA',
  status: 'active',
  scansLast7Days: 0,
  scansTotal: 0,
  follows: 0,
  ...over,
});

describe('sortPanelRows', () => {
  it('puts retired codes last and orders the rest by label', () => {
    const sorted = sortPanelRows([
      row({ code: 'C', status: 'retired', label: 'A door' }),
      row({ code: 'B', label: 'Side door' }),
      row({ code: 'A', label: 'Main entrance' }),
    ]);
    expect(sorted.map(r => r.code)).toEqual(['A', 'B', 'C']);
  });

  it('does not change its input', () => {
    const input = [row({ code: 'B' }), row({ code: 'A' })];
    sortPanelRows(input);
    expect(input.map(r => r.code)).toEqual(['B', 'A']);
  });
});

describe('formatLastScanned', () => {
  it('reads the instant in IST', () => {
    expect(formatLastScanned('2026-11-12T12:30:00.000Z')).toBe('12 Nov 2026, 6:00 pm');
  });

  it('says Never for no scan or a bad value', () => {
    expect(formatLastScanned(undefined)).toBe('Never');
    expect(formatLastScanned('x')).toBe('Never');
  });
});

describe('panelActionUrl', () => {
  it('opens the admin app of the same stage', () => {
    expect(panelActionUrl('https://admin.rasika.life', 'ABCDEFGH', 'retire')).toBe(
      'https://admin.rasika.life/qr/ABCDEFGH/retire'
    );
    expect(panelActionUrl('https://admin.dev.rasika.life', 'ABCDEFGH', 'label')).toBe(
      'https://admin.dev.rasika.life/qr/ABCDEFGH/edit?intent=label'
    );
    expect(panelActionUrl('https://admin.rasika.life', 'ABCDEFGH', 'reassign')).toBe(
      'https://admin.rasika.life/qr/ABCDEFGH/edit?intent=reassign'
    );
  });
});

describe('canAct', () => {
  it('allows actions on active codes only', () => {
    expect(canAct('active')).toBe(true);
    expect(canAct('retired')).toBe(false);
    expect(canAct('unassigned')).toBe(false);
  });
});
