import { CHAKRA_NAMES, chakraOfMela, melakartaScale } from '@rasika/core/domain/raga/melakarta';
import { fromItrans } from '@rasika/core/utils/transliteration';
import { ChevronDown } from 'lucide-react';
import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { MELAKARTA_LINKS } from '~/lib/melakarta-links';
import { generateRagaUrl } from '~/lib/url-slug';
import { cn, titleCaseName } from '~/lib/utils';
import { ScriptContext } from './script-context';

// One pastel per chakra, Indu through Aditya, so the 12 arcs read as a rainbow
// winding clockwise from the top.
const CHAKRA_COLORS = [
  '#fde68a',
  '#fdba74',
  '#fca5a5',
  '#fda4af',
  '#f9a8d4',
  '#d8b4fe',
  '#a5b4fc',
  '#93c5fd',
  '#7dd3fc',
  '#5eead4',
  '#86efac',
  '#bef264',
];

const SIZE = 440;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUT = 196;
const R_IN = 120;
// Mela numbers alternate between two rings so neighbours never collide.
const NUMBER_RADII = [176, 158];
const LABEL_RADIUS = 217;

type MelakartaEntry = {
  mela: number;
  displayName: string;
  url: string;
  chakra: number;
};

function polar(radius: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

/** Annular-sector path from angle `fromDeg` to `toDeg`, sweeping clockwise. */
function wedgePath(fromDeg: number, toDeg: number): string {
  const outerFrom = polar(R_OUT, fromDeg);
  const outerTo = polar(R_OUT, toDeg);
  const innerTo = polar(R_IN, toDeg);
  const innerFrom = polar(R_IN, fromDeg);
  return [
    `M ${outerFrom.x} ${outerFrom.y}`,
    `A ${R_OUT} ${R_OUT} 0 0 1 ${outerTo.x} ${outerTo.y}`,
    `L ${innerTo.x} ${innerTo.y}`,
    `A ${R_IN} ${R_IN} 0 0 0 ${innerFrom.x} ${innerFrom.y}`,
    'Z',
  ].join(' ');
}

export function MelakartaWheel() {
  const { script } = useContext(ScriptContext);
  const [open, setOpen] = useState(true);

  // Open on desktop, collapsed on mobile. Seeded after mount so the server
  // render and the first client render agree.
  useEffect(() => {
    setOpen(window.matchMedia('(min-width: 640px)').matches);
  }, []);

  const entries: MelakartaEntry[] = useMemo(
    () =>
      Object.entries(MELAKARTA_LINKS)
        .map(([mela, link]) => {
          const melaNumber = Number(mela);
          return {
            mela: melaNumber,
            displayName: titleCaseName(fromItrans(link.name, script)),
            url: generateRagaUrl(link.name, link.id),
            chakra: chakraOfMela(melaNumber),
          };
        })
        .sort((a, b) => a.mela - b.mela),
    [script]
  );

  const chakras = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const chakra = index + 1;
        // The chakra's R/G pair is fixed by its first mela's scale.
        const rg = melakartaScale((chakra - 1) * 6 + 1)
          .split(' ')
          .slice(1, 3)
          .join(' ');
        return {
          chakra,
          name: CHAKRA_NAMES[index],
          rg,
          melas: entries.filter(entry => entry.chakra === chakra),
        };
      }),
    [entries]
  );

  return (
    <section aria-labelledby="melakarta-heading" className="mb-8">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        aria-controls="melakarta-panel"
        className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span id="melakarta-heading" className="text-xl font-semibold">
          The 72 Melakartas
        </span>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform duration-200',
            !open && '-rotate-90'
          )}
        />
      </button>
      <p className="mb-4 px-1 text-sm text-muted-foreground">
        The parent scales of Carnatic ragas, grouped into 12 chakras. Each segment links to the
        raga.
      </p>

      <div id="melakarta-panel">
        <div className="hidden sm:block">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mx-auto h-auto w-full max-w-xl"
            role="img"
            aria-label="The 72 melakartas arranged in 12 chakras, each segment linking to a raga"
          >
            {chakras.map(({ chakra, name }) => {
              const { x, y } = polar(LABEL_RADIUS, (chakra - 1) * 30 + 15);
              return (
                <text
                  key={chakra}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10.5"
                  fontWeight="600"
                  fill="#64748b"
                >
                  {name}
                </text>
              );
            })}

            {entries.map(entry => {
              const fromDeg = (entry.mela - 1) * 5;
              const toDeg = entry.mela * 5;
              const { x, y } = polar(NUMBER_RADII[(entry.mela - 1) % 2], fromDeg + 2.5);
              return (
                <Link
                  key={entry.mela}
                  to={entry.url}
                  className="group"
                  aria-label={`${entry.displayName}, melakarta ${entry.mela}`}
                >
                  <title>{`${entry.mela}. ${entry.displayName}`}</title>
                  <path
                    d={wedgePath(fromDeg, toDeg)}
                    fill={CHAKRA_COLORS[entry.chakra - 1]}
                    stroke="#ffffff"
                    strokeWidth="1"
                    className="transition-[filter] duration-150 group-hover:brightness-[0.85] group-focus-visible:brightness-[0.85]"
                  />
                  <text
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="9.5"
                    fontWeight="600"
                    fill="#334155"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    style={{ paintOrder: 'stroke' }}
                  >
                    {entry.mela}
                  </text>
                </Link>
              );
            })}

            <text
              x={CX}
              y={CY - 10}
              textAnchor="middle"
              fontSize="26"
              fontWeight="700"
              fill="#334155"
            >
              72
            </text>
            <text x={CX} y={CY + 14} textAnchor="middle" fontSize="11" fill="#64748b">
              Melakartas
            </text>
          </svg>
        </div>

        <div className="space-y-3 sm:hidden">
          {chakras.map(({ chakra, name, rg, melas }) => (
            <div key={chakra} className="rounded-xl border bg-card p-3">
              <h3 className="mb-1 flex items-baseline justify-between px-2 text-sm font-semibold">
                <span>
                  {chakra}. {name}
                </span>
                <span className="font-normal tabular-nums text-muted-foreground">{rg}</span>
              </h3>
              <ul>
                {melas.map(entry => (
                  <li key={entry.mela}>
                    <Link
                      to={entry.url}
                      className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="w-5 shrink-0 text-right tabular-nums text-muted-foreground">
                        {entry.mela}
                      </span>
                      <span className="truncate">{entry.displayName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
