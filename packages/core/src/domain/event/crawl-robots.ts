/**
 * robots.txt, read the way RFC 9309 says: the group for our agent if there is one, else `*`;
 * the longest matching rule wins; `Allow` wins a tie. Pure, so the crawler's first duty is tested.
 */

export interface RobotsRule {
  allow: boolean;
  path: string;
}

export function parseRobots(text: string, agent: string): RobotsRule[] {
  const token = agent.toLowerCase();
  const groups: Array<{ agents: string[]; rules: RobotsRule[] }> = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === 'allow' || field === 'disallow') && current) {
      lastWasAgent = false;
      // An empty Disallow allows everything, so it adds no rule.
      if (value) current.rules.push({ allow: field === 'allow', path: value });
    } else {
      lastWasAgent = false;
    }
  }
  const named = groups.filter(g => g.agents.some(a => a !== '*' && token.includes(a)));
  const chosen = named.length ? named : groups.filter(g => g.agents.includes('*'));
  return chosen.flatMap(g => g.rules);
}

function matches(rulePath: string, path: string): boolean {
  const anchored = rulePath.endsWith('$');
  const pattern = (anchored ? rulePath.slice(0, -1) : rulePath)
    .split('*')
    .map(p => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${pattern}${anchored ? '$' : ''}`).test(path);
}

export function robotsAllows(rules: RobotsRule[], pathWithQuery: string): boolean {
  let best: RobotsRule | null = null;
  for (const rule of rules) {
    if (!matches(rule.path, pathWithQuery)) continue;
    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}

export type RobotsVerdict = 'allowed' | 'disallowed' | 'blocked';

/** What a robots.txt fetch status means: 404/410 is "no rules"; 401/403/5xx is "do not crawl". */
export function robotsStatusVerdict(status: number): 'rules' | 'no-rules' | 'stop' {
  if (status >= 200 && status < 300) return 'rules';
  if (status === 404 || status === 410) return 'no-rules';
  return 'stop';
}
