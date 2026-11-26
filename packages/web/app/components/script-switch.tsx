import { useContext } from 'react';
import { scriptLang } from '~/lib/script-lang';
import type { DisplayScript } from '~/sessions.server';
import { ScriptContext } from './script-context';
import { SCRIPT_OPTIONS } from './script-selector';

/**
 * A script control that sits next to the text it changes (the Lyrics heading). The header has
 * the same switch, but on a phone that one is inside the menu, and a reader who came for
 * "lyrics in tamil" should not have to find it. Same `setScript` as the header.
 */
export function ScriptSwitch({
  script,
  onChange,
  pending = false,
}: {
  script: DisplayScript;
  onChange: (script: DisplayScript) => void;
  pending?: boolean;
}) {
  return (
    <fieldset className="flex flex-wrap gap-1 min-w-0" aria-busy={pending}>
      <legend className="sr-only">Show lyrics in</legend>
      {SCRIPT_OPTIONS.map(option => {
        const selected = option.value === script;
        return (
          <label
            key={option.value}
            lang={scriptLang(option.value)}
            className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 ${
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-muted'
            }`}
          >
            <input
              type="radio"
              name="lyrics-script"
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </fieldset>
  );
}

/** The switch wired to the page's script context. */
export function LyricsScriptSwitch() {
  const { script, setScript, isPending } = useContext(ScriptContext);
  return <ScriptSwitch script={script} onChange={setScript} pending={isPending} />;
}
