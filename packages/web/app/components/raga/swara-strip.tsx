import { type ScalePositions, scalePositions } from '@rasika/core/domain/raga/client';

/** The generic name of each semitone, shown under a key the raga does not use. */
const GENERIC = ['S', 'R1', 'R2', 'G2', 'G3', 'M1', 'M2', 'P', 'D1', 'D2', 'N2', 'N3', "S'"];

const CELL = 36;
const GAP = 4;
const ROW = 44;

/**
 * The twelve positions of the octave, with the ones the raga uses filled: one row going up,
 * one coming down, so a borrowed note (Bhairavi's D2 up, D1 down) shows as the one place the
 * rows differ. A borrowed note named in `anya` is outlined as well.
 *
 * Server-rendered SVG, no script. The text alternative lists the notes, because the drawing
 * alone says nothing to a screen reader.
 */
export function SwaraStrip({
  arohanam,
  avarohanam,
  anya = [],
}: {
  arohanam?: string | null;
  avarohanam?: string | null;
  anya?: string[];
}) {
  const positions = scalePositions(arohanam, avarohanam);
  if (positions.up.length < 4 && positions.down.length < 4) return null;

  const width = 13 * CELL + 12 * GAP;
  const label = `Notes going up: ${namesOf(positions, positions.up)}. Coming down: ${namesOf(
    positions,
    positions.down
  )}.`;

  return (
    <figure className="space-y-1">
      <svg
        viewBox={`0 0 ${width + 48} ${ROW * 2 + 20}`}
        className="w-full max-w-xl h-auto"
        role="img"
        aria-label={label}
      >
        {(['up', 'down'] as const).map((direction, row) => (
          <g key={direction} transform={`translate(48 ${row * ROW})`}>
            <text
              x={-8}
              y={CELL / 2 + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {direction === 'up' ? '↑' : '↓'}
            </text>
            {GENERIC.map((generic, i) => {
              const semitone = i % 12;
              const used = positions[direction].includes(semitone);
              const name = positions.names[semitone] ?? generic;
              const borrowed = used && anya.includes(name);
              return (
                <g key={generic} transform={`translate(${i * (CELL + GAP)} 0)`}>
                  <rect
                    width={CELL}
                    height={CELL}
                    rx={6}
                    className={
                      used ? 'fill-raga stroke-raga-foreground' : 'fill-transparent stroke-border'
                    }
                    strokeWidth={borrowed ? 2 : 1}
                    strokeDasharray={borrowed ? '4 3' : undefined}
                  />
                  <text
                    x={CELL / 2}
                    y={CELL / 2 + 4}
                    textAnchor="middle"
                    className={`font-mono text-[11px] ${
                      used ? 'fill-raga-foreground font-semibold' : 'fill-muted-foreground'
                    }`}
                  >
                    {i === 12 ? "S'" : name}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      {anya.length > 0 && (
        <figcaption className="text-xs text-muted-foreground">
          Dashed: borrowed from outside the parent scale ({anya.join(', ')}).
        </figcaption>
      )}
    </figure>
  );
}

function namesOf(positions: ScalePositions, semitones: number[]): string {
  return semitones.map(s => positions.names[s] ?? GENERIC[s]).join(' ');
}
