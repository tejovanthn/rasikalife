import { describe, expect, it } from 'vitest';
import { affiliationPeriod } from './affiliation-display';

describe('affiliationPeriod', () => {
  it('renders a closed range', () => {
    expect(affiliationPeriod({ startYear: 1998, endYear: 2015 })).toBe('1998–2015');
  });

  it('renders an open range as present when the role is current', () => {
    expect(affiliationPeriod({ startYear: 2017, isCurrent: true })).toBe('2017–present');
  });

  // The distinction the isCurrent flag exists for: a start year with nothing claiming the role
  // continues must not be rendered as though it does.
  it('renders a start year alone as "since", not as present', () => {
    expect(affiliationPeriod({ startYear: 2017 })).toBe('since 2017');
    expect(affiliationPeriod({ startYear: 2017, isCurrent: false })).toBe('since 2017');
  });

  it('renders an end year alone', () => {
    expect(affiliationPeriod({ endYear: 2015 })).toBe('until 2015');
  });

  it('renders a current role with no years at all', () => {
    expect(affiliationPeriod({ isCurrent: true })).toBe('current');
  });

  // Returning '' rather than a placeholder lets a caller drop the separator instead of
  // rendering empty brackets after the organisation name.
  it('returns an empty string when the row says nothing about time', () => {
    expect(affiliationPeriod({})).toBe('');
    expect(affiliationPeriod({ isCurrent: false })).toBe('');
  });

  // A closed range is a completed role, so an isCurrent left ticked by mistake must not turn
  // "1998–2015" into something self-contradictory.
  it('lets an explicit end year win over a stale isCurrent flag', () => {
    expect(affiliationPeriod({ startYear: 1998, endYear: 2015, isCurrent: true })).toBe(
      '1998–2015'
    );
  });
});
