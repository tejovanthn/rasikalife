import { describe, expect, it } from 'vitest';
import { parseRobots, robotsAllows, robotsStatusVerdict } from './crawl-robots';

describe('robots.txt', () => {
  it('allows everything on an empty Disallow', () => {
    const rules = parseRobots('# x\nUser-agent: *\nDisallow:\n', 'EventResearchBot/1.0');
    expect(robotsAllows(rules, '/events?ci=101')).toBe(true);
  });

  it('blocks a disallowed prefix and lets a longer Allow win', () => {
    const rules = parseRobots(
      'User-agent: *\nDisallow: /private\nAllow: /private/open\n',
      'EventResearchBot'
    );
    expect(robotsAllows(rules, '/private/x')).toBe(false);
    expect(robotsAllows(rules, '/private/open/y')).toBe(true);
    expect(robotsAllows(rules, '/public')).toBe(true);
  });

  it('prefers the group named for our agent over *', () => {
    const rules = parseRobots(
      'User-agent: *\nDisallow: /\n\nUser-agent: EventResearchBot\nDisallow: /admin\n',
      'EventResearchBot/1.0'
    );
    expect(robotsAllows(rules, '/events')).toBe(true);
    expect(robotsAllows(rules, '/admin')).toBe(false);
  });

  it('supports * and $', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /*.json$\n', 'x');
    expect(robotsAllows(rules, '/a/b.json')).toBe(false);
    expect(robotsAllows(rules, '/a/b.json.gz')).toBe(true);
  });

  it('reads the fetch status', () => {
    expect(robotsStatusVerdict(200)).toBe('rules');
    expect(robotsStatusVerdict(404)).toBe('no-rules');
    expect(robotsStatusVerdict(403)).toBe('stop');
    expect(robotsStatusVerdict(503)).toBe('stop');
  });
});
