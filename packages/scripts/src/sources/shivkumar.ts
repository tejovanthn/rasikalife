import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { mergeSources } from '@rasika/core/domain/composition/client';
import {
  SHIVKUMAR_INDEX_URLS,
  type ShivkumarEntry,
  type ShivkumarLesson,
  htmlToText,
  lessonArohanam,
  lessonAvarohanam,
  parseShivkumarIndex,
  parseShivkumarLesson,
} from '@rasika/core/domain/composition/shivkumar';
import type { SourceRecord } from '@rasika/core/domain/composition/source-import';
import type { SourceAdapter } from './types.js';

/**
 * Shivkumar Kalyanaraman's lesson archive (https://www.shivkumar.org/music/). Each lesson
 * is a PDF read with `pdftotext -layout` (poppler), which keeps the swara columns; the
 * HTML page is the fallback where a PDF link is dead.
 */

const USER_AGENT = 'rasika.life archive import (+https://rasika.life)';

interface LessonRecord extends ShivkumarEntry {
  lesson: ShivkumarLesson;
  /** Where the lesson text came from: the PDF keeps the notation's columns, HTML does not. */
  textFrom: 'pdf' | 'html' | 'none';
}

async function download(url: string, file: string): Promise<boolean> {
  if (existsSync(file)) return true;
  let response: Response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch (error) {
    console.warn(`  ⚠️  ${url}: ${(error as Error).message}`);
    return false;
  }
  if (!response.ok) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  await new Promise(resolve => setTimeout(resolve, 300));
  return true;
}

const localPath = (dir: string, url: string) =>
  path.join(dir, 'raw', new URL(url).pathname.replace(/^\/music\//, ''));

// The site is Windows-1252 throughout.
const readHtml = (file: string) => new TextDecoder('windows-1252').decode(readFileSync(file));

async function fetchLessons(outDir: string): Promise<void> {
  const entries: ShivkumarEntry[] = [];
  for (const url of SHIVKUMAR_INDEX_URLS) {
    const file = localPath(outDir, url);
    if (!(await download(url, file))) throw new Error(`Could not fetch ${url}`);
    entries.push(...parseShivkumarIndex(readHtml(file), url));
  }
  console.log(`📚 ${entries.length} lessons on the index`);

  const records: LessonRecord[] = [];
  for (const [i, entry] of entries.entries()) {
    let text = '';
    let textFrom: LessonRecord['textFrom'] = 'none';
    // Some index links differ in case from the file on the server; the HTML page is
    // the fallback for those.
    if (entry.pdfUrl && (await download(entry.pdfUrl, localPath(outDir, entry.pdfUrl)))) {
      try {
        text = execFileSync('pdftotext', ['-layout', localPath(outDir, entry.pdfUrl), '-'], {
          encoding: 'utf8',
        });
        textFrom = 'pdf';
      } catch {
        text = '';
      }
    }
    if (!text.trim() && entry.htmlUrl) {
      if (await download(entry.htmlUrl, localPath(outDir, entry.htmlUrl))) {
        text = htmlToText(readHtml(localPath(outDir, entry.htmlUrl)));
        textFrom = 'html';
      }
    }
    if (textFrom === 'none') console.warn(`  ⚠️  no text for ${entry.title}`);
    records.push({ ...entry, lesson: parseShivkumarLesson(text), textFrom });
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${entries.length}`);
  }

  const out = path.join(outDir, 'lessons.json');
  writeFileSync(out, JSON.stringify(records, null, 2));
  const fromHtml = records.filter(r => r.textFrom === 'html').length;
  const none = records.filter(r => r.textFrom === 'none').length;
  console.log(
    `✅ wrote ${records.length} lessons to ${out} (${fromHtml} from HTML, ${none} empty)`
  );
}

function toSourceRecord(record: LessonRecord): SourceRecord {
  return {
    key: record.pdfUrl ?? record.htmlUrl ?? record.title,
    title: record.title,
    raga: record.raga,
    tala: record.tala,
    composer: record.composer,
    compositionType: record.compositionType,
    // The lesson's pages, its class recordings, and the sites its header credits.
    sources: mergeSources(
      [],
      [
        record.htmlUrl,
        record.pdfUrl,
        ...record.audioUrls,
        ...record.videoUrls,
        ...record.lesson.creditUrls,
      ].filter((url): url is string => Boolean(url))
    ),
    notation: record.lesson.body || undefined,
    lyrics: record.lesson.lyrics,
    scale: {
      arohanam: lessonArohanam(record.lesson),
      avarohanam: lessonAvarohanam(record.lesson),
    },
    note: `text from ${record.textFrom}`,
  };
}

export const shivkumar: SourceAdapter = {
  name: 'shivkumar',
  romanisation: 'plain',
  fetch: fetchLessons,
  load: outDir => {
    const file = path.join(outDir, 'lessons.json');
    if (!existsSync(file)) throw new Error(`${file} is missing; run source-fetch first`);
    return (JSON.parse(readFileSync(file, 'utf8')) as LessonRecord[]).map(toSourceRecord);
  },
};
