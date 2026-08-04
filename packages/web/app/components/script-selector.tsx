import { Languages, Loader2 } from 'lucide-react';
import { useContext } from 'react';
import type { DisplayScript } from '~/sessions.server';
import { ScriptContext } from './script-context';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

// `roman` leads, and is the default for anyone who has not chosen — it has to be
// first here too, or the picker labels itself IAST on a page rendering roman.
const SCRIPT_OPTIONS: { value: DisplayScript; label: string; sample: string }[] = [
  { value: 'roman', label: 'Roman', sample: 'Raga' },
  { value: 'iast', label: 'IAST', sample: 'Rāga' },
  { value: 'devanagari', label: 'देवनागरी', sample: 'राग' },
  { value: 'tamil', label: 'தமிழ்', sample: 'ராக' },
  { value: 'telugu', label: 'తెలుగు', sample: 'రాగ' },
  { value: 'kannada', label: 'ಕನ್ನಡ', sample: 'ರಾಗ' },
];

export function ScriptSelector() {
  const { script, setScript, isPending } = useContext(ScriptContext);
  const current = SCRIPT_OPTIONS.find(o => o.value === script) ?? SCRIPT_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title={`Script: ${current.label}`}>
          {isPending ? (
            <Loader2 className="h-[1.2rem] w-[1.2rem] animate-spin" />
          ) : (
            <Languages className="h-[1.2rem] w-[1.2rem]" />
          )}
          <span className="sr-only">Select script</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SCRIPT_OPTIONS.map(option => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setScript(option.value)}
            className={script === option.value ? 'font-semibold' : ''}
          >
            <span className="w-16">{option.label}</span>
            <span className="text-muted-foreground text-xs">{option.sample}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
