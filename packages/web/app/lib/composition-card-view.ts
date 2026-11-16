import { fromItrans } from '@rasika/core/utils/transliteration';
import { titleCaseName } from '~/lib/utils';

type Script = Parameters<typeof fromItrans>[1];

type Named = { id: string; name: string };

type CardSource = {
  title: string;
  ragas?: Named[];
  talas?: Named[];
};

/**
 * What `CompositionCard` shows for one composition, in the reader's display script.
 *
 * Stored titles and raga/tala names are ITRANS ("ArUrAn2 pADiya"). `title` is the display
 * text; `linkTitle` keeps the stored title so the URL slug is the same as before. Run this
 * once, in the loader. It is not idempotent: a second pass would transliterate display text.
 * Names only: never pass lyrics or swara notation through it.
 */
export function compositionCardView<T extends CardSource>(
  composition: T,
  script: Script
): T & { linkTitle: string } {
  const show = (text: string) => titleCaseName(fromItrans(text, script));
  const view: T & { linkTitle: string } = {
    ...composition,
    title: show(composition.title),
    linkTitle: composition.title,
  };
  if (composition.ragas) view.ragas = composition.ragas.map(r => ({ ...r, name: show(r.name) }));
  if (composition.talas) view.talas = composition.talas.map(t => ({ ...t, name: show(t.name) }));
  return view;
}
