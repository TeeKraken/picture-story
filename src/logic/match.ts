// Finds which pictures' words a child has used in their sentences.
// Pure functions, no DOM: tested in match.test.ts.

export interface Token {
  /** The word as matched, lowercased and without accents. */
  norm: string;
  /** Where the word sits in the original text (for highlighting). */
  start: number;
  end: number;
}

export interface Range {
  start: number;
  end: number;
}

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** Lowercase, straight apostrophes, accents removed (café matches cafe). */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/’/g, "'")
    .toLowerCase()
    .trim();
}

/** Splits text into words, remembering where each one is. "dog's" counts as "dog". */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(WORD)) {
    let norm = normalize(m[0]);
    if (norm.endsWith("'s")) norm = norm.slice(0, -2);
    out.push({ norm, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

const IRREGULAR: Record<string, string> = {
  child: "children",
  man: "men",
  woman: "women",
  person: "people",
  mouse: "mice",
  goose: "geese",
  foot: "feet",
  tooth: "teeth",
  ox: "oxen",
  die: "dice",
  louse: "lice",
  cactus: "cacti",
  octopus: "octopuses",
};
const IRREGULAR_BACK = Object.fromEntries(Object.entries(IRREGULAR).map(([a, b]) => [b, a]));

/** The plural spellings a child might use for a word (dog → dogs, fox → foxes, baby → babies). */
export function pluralForms(word: string): Set<string> {
  const forms = new Set<string>([word + "s", word + "es"]);
  if (IRREGULAR[word]) forms.add(IRREGULAR[word]);
  if (/[^aeiou]y$/.test(word)) forms.add(word.slice(0, -1) + "ies");
  if (word.endsWith("fe")) forms.add(word.slice(0, -2) + "ves");
  else if (word.endsWith("f")) forms.add(word.slice(0, -1) + "ves");
  return forms;
}

/** True when a typed word is the same as the picture's word, or a plural or singular of it. */
export function sameWord(typed: string, word: string): boolean {
  if (!typed || !word) return false;
  if (typed === word) return true;
  if (pluralForms(word).has(typed)) return true;
  if (pluralForms(typed).has(word)) return true;
  if (IRREGULAR_BACK[typed] === word || IRREGULAR_BACK[word] === typed) return true;
  return false;
}

/**
 * Splits what a grown-up typed into the words that count for a picture.
 * "Cat, kitten , kitty" → ["cat", "kitten", "kitty"]. Each may be a phrase ("ice cream").
 */
export function parseWords(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of input.split(/[,;\n]/)) {
    const phrase = tokenize(part)
      .map((t) => t.norm)
      .join(" ");
    if (phrase && !seen.has(phrase)) {
      seen.add(phrase);
      out.push(phrase);
    }
  }
  return out;
}

/**
 * Finds every place a word or phrase is used in the text. In a phrase, only the
 * last word may be plural ("ice creams").
 */
export function findPhrase(tokens: Token[], phrase: string): Range[] {
  const parts = phrase.split(" ").filter(Boolean);
  if (parts.length === 0) return [];
  const found: Range[] = [];
  for (let i = 0; i + parts.length <= tokens.length; i++) {
    let ok = true;
    for (let j = 0; j < parts.length; j++) {
      const t = tokens[i + j].norm;
      const p = parts[j];
      const last = j === parts.length - 1;
      if (last ? !sameWord(t, p) : t !== p) {
        ok = false;
        break;
      }
    }
    if (ok) found.push({ start: tokens[i].start, end: tokens[i + parts.length - 1].end });
  }
  return found;
}

export interface MatchResult {
  /** One entry per picture: has the child used one of its words? */
  used: boolean[];
  /** Spans of the text to highlight, sorted and not overlapping. */
  ranges: Range[];
}

/** For each picture (a list of accepted words), whether the text uses it, plus where. */
export function matchPictures(text: string, pictures: string[][]): MatchResult {
  const tokens = tokenize(text);
  const ranges: Range[] = [];
  const used = pictures.map((words) => {
    let hit = false;
    for (const w of words) {
      const r = findPhrase(tokens, w);
      if (r.length) {
        hit = true;
        ranges.push(...r);
      }
    }
    return hit;
  });
  return { used, ranges: mergeRanges(ranges) };
}

export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}
