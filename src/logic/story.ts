// The story model: sets of pages, rows of pictures, and a child's progress.
// Pure functions, no DOM: tested in story.test.ts.

import { matchPictures, parseWords } from "./match";

export interface Picture {
  /** An emoji, or a small photo as a data: URL. Exactly one is set. */
  emoji?: string;
  photo?: string;
  /** Words that count for this picture. The first is the one shown when tapped. */
  words: string[];
}

export interface Row {
  pictures: Picture[];
}

export interface Page {
  rows: Row[];
}

export interface StorySet {
  id: string;
  title: string;
  pages: Page[];
  /** Changes whenever the pictures change, so old progress isn't applied to new pictures. */
  version: number;
}

export interface Progress {
  version: number;
  page: number;
  /** texts[page][row]: what the child wrote under that row. */
  texts: string[][];
  /** The child finished the last page. */
  finished: boolean;
}

export const LIMITS = {
  title: 60,
  pages: 10,
  rows: 6,
  pictures: 5,
  words: 80,
  text: 600,
};

export function emptyProgress(set: StorySet): Progress {
  return {
    version: set.version,
    page: 0,
    texts: set.pages.map((p) => p.rows.map(() => "")),
    finished: false,
  };
}

/**
 * Makes saved progress safe to use with this set: starts over if the pictures
 * changed, and fills any gaps so every page and row has a text.
 */
export function fitProgress(set: StorySet, saved: Progress | undefined): Progress {
  if (!saved || saved.version !== set.version || !Array.isArray(saved.texts)) return emptyProgress(set);
  const texts = set.pages.map((p, pi) =>
    p.rows.map((_, ri) => {
      const t = saved.texts[pi]?.[ri];
      return typeof t === "string" ? t.slice(0, LIMITS.text) : "";
    }),
  );
  const page = Number.isInteger(saved.page) ? Math.min(Math.max(saved.page, 0), set.pages.length - 1) : 0;
  return { version: set.version, page, texts, finished: saved.finished === true };
}

export interface RowState {
  used: boolean[];
  usedCount: number;
  done: boolean;
}

export function rowState(row: Row, text: string): RowState {
  const { used } = matchPictures(
    text,
    row.pictures.map((p) => p.words),
  );
  const usedCount = used.filter(Boolean).length;
  return { used, usedCount, done: usedCount === row.pictures.length && text.trim().length > 0 };
}

export function pageDone(page: Page, texts: string[]): boolean {
  return page.rows.every((row, i) => rowState(row, texts[i] ?? "").done);
}

/** Tidies one row's writing for the story: trimmed, single spaces, ends with a full stop. */
export function tidySentence(text: string): string {
  let s = text.replace(/\s+/g, " ").trim();
  if (!s) return "";
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?…"”')]$/.test(s)) s += ".";
  return s;
}

/**
 * The story so far: one paragraph per page that the child has finished,
 * made of what they wrote under each row, in order. Pages they haven't
 * finished are left out, so the story only ever shows their own completed writing.
 */
export function storyParagraphs(set: StorySet, progress: Progress): string[] {
  const out: string[] = [];
  set.pages.forEach((page, pi) => {
    const texts = progress.texts[pi] ?? [];
    if (!pageDone(page, texts)) return;
    const para = texts.map(tidySentence).filter(Boolean).join(" ");
    if (para) out.push(para);
  });
  return out;
}

/** How many pages the child has fully finished. */
export function pagesDone(set: StorySet, progress: Progress): number {
  return set.pages.filter((p, i) => pageDone(p, progress.texts[i] ?? [])).length;
}

// ---------- Checking a set a grown-up made ----------

export interface DraftPicture {
  emoji?: string;
  photo?: string;
  /** Raw text from the words box, e.g. "cat, kitten". */
  words: string;
}

export interface Draft {
  title: string;
  pages: { rows: { pictures: DraftPicture[] }[] }[];
}

export interface DraftError {
  /** Where the problem is, so the editor can point at it: "title" or "p0-r1-c2". */
  at: string;
  message: string;
}

/** Turns an editor draft into a story set, or explains what to fix. */
export function checkDraft(
  draft: Draft,
): { ok: true; title: string; pages: Page[] } | { ok: false; errors: DraftError[] } {
  const errors: DraftError[] = [];
  const title = draft.title.replace(/\s+/g, " ").trim();
  if (!title) errors.push({ at: "title", message: "Give the story a name, like “At the park”." });
  if (title.length > LIMITS.title)
    errors.push({ at: "title", message: `Keep the name under ${LIMITS.title} letters.` });
  if (draft.pages.length === 0) errors.push({ at: "pages", message: "Add at least one page." });

  const pages: Page[] = draft.pages.map((page, pi) => {
    if (page.rows.length === 0)
      errors.push({ at: `p${pi}`, message: `Page ${pi + 1} has no rows. Add a row of pictures or remove the page.` });
    return {
      rows: page.rows.map((row, ri) => {
        if (row.pictures.length === 0)
          errors.push({
            at: `p${pi}-r${ri}`,
            message: `Page ${pi + 1}, row ${ri + 1} has no pictures. Add one or remove the row.`,
          });
        return {
          pictures: row.pictures.map((pic, ci) => {
            const words = parseWords(pic.words.slice(0, LIMITS.words));
            const where = `Page ${pi + 1}, row ${ri + 1}, picture ${ci + 1}`;
            const noImage = !pic.emoji && !pic.photo;
            const at = `p${pi}-r${ri}-c${ci}`;
            if (noImage && words.length === 0)
              errors.push({ at, message: `${where} is empty. Choose a picture, and type the word that lights it up.` });
            else if (noImage) errors.push({ at, message: `${where} needs a picture. Choose an emoji or a photo.` });
            else if (words.length === 0)
              errors.push({ at, message: `${where} needs a word, like “dog”. Your child uses it to light up the picture.` });
            return pic.photo ? { photo: pic.photo, words } : { emoji: pic.emoji, words };
          }),
        };
      }),
    };
  });
  return errors.length ? { ok: false, errors } : { ok: true, title, pages };
}

/** True if the pictures or their words differ, which means old progress no longer fits. */
export function picturesChanged(a: Page[], b: Page[]): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

export function toDraft(set: StorySet): Draft {
  return {
    title: set.title,
    pages: set.pages.map((p) => ({
      rows: p.rows.map((r) => ({
        pictures: r.pictures.map((c) => ({ emoji: c.emoji, photo: c.photo, words: c.words.join(", ") })),
      })),
    })),
  };
}

// ---------- Reading saved data safely ----------

function isPicture(x: unknown): x is Picture {
  if (!x || typeof x !== "object") return false;
  const p = x as Picture;
  const hasImage =
    (typeof p.emoji === "string" && p.emoji.length > 0 && p.emoji.length <= 16) ||
    (typeof p.photo === "string" && p.photo.startsWith("data:image/"));
  return hasImage && Array.isArray(p.words) && p.words.length > 0 && p.words.every((w) => typeof w === "string");
}

/** Keeps only well-formed sets from storage; anything odd is dropped rather than crashing the app. */
export function cleanSets(raw: unknown): StorySet[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is StorySet => {
    if (!s || typeof s !== "object") return false;
    const set = s as StorySet;
    return (
      typeof set.id === "string" &&
      typeof set.title === "string" &&
      typeof set.version === "number" &&
      Array.isArray(set.pages) &&
      set.pages.length > 0 &&
      set.pages.every(
        (p) =>
          p &&
          Array.isArray(p.rows) &&
          p.rows.length > 0 &&
          p.rows.every((r) => r && Array.isArray(r.pictures) && r.pictures.length > 0 && r.pictures.every(isPicture)),
      )
    );
  });
}
