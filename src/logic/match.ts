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

/** Words ending in -o whose plural adds -es. Others just add -s (pianos, photos). */
const O_ES = new Set(["potato", "tomato", "hero", "echo", "mosquito", "torpedo", "veto", "volcano", "domino"]);

/** Words that are the same in the plural. */
const SAME_PLURAL = new Set(["sheep", "deer", "moose", "fish", "salmon", "trout", "aircraft", "series", "species"]);

/**
 * The correct plural spellings of a word (dog → dogs, fox → foxes, baby → babies).
 * Conservative on purpose: misspellings like "foxs" or "babys" don't count.
 */
export function pluralForms(word: string): Set<string> {
  const forms = new Set<string>();
  if (SAME_PLURAL.has(word)) {
    if (word === "fish") forms.add("fishes");
    return forms;
  }
  if (IRREGULAR[word]) {
    forms.add(IRREGULAR[word]);
    return forms;
  }
  if (/(s|x|z|ch|sh)$/.test(word)) forms.add(word + "es");
  else if (/[^aeiou]y$/.test(word)) forms.add(word.slice(0, -1) + "ies");
  else if (O_ES.has(word)) forms.add(word + "es"); // potatoes (pianos, zoos: the usual +s)
  else if (word.endsWith("fe")) {
    forms.add(word.slice(0, -2) + "ves"); // knives
    forms.add(word + "s"); // giraffes, cafes
  } else if (word.endsWith("f")) {
    forms.add(word.slice(0, -1) + "ves"); // leaves
    forms.add(word + "s"); // roofs
  } else forms.add(word + "s");
  return forms;
}

/**
 * Singulars of a word a grown-up typed in the plural ("grapes" → "grape"), so the
 * child can use either. A typed word must be a real singular whose plural is
 * exactly this word: "bu" doesn't count for "bus", nor "glas" for "glass".
 */
function singularForms(word: string): string[] {
  const out: string[] = [];
  if (IRREGULAR_BACK[word]) out.push(IRREGULAR_BACK[word]);
  if (word.length < 4 || /(ss|us|is)$/.test(word)) return out;
  const candidates: string[] = [];
  if (word.endsWith("ies")) {
    candidates.push(word.slice(0, -3) + "y"); // babies → baby, never "babie"
    if (word.length <= 4) candidates.push(word.slice(0, -1)); // pies → pie
  } else if (word.endsWith("ves")) {
    candidates.push(word.slice(0, -3) + "f", word.slice(0, -3) + "fe"); // leaves, knives
    candidates.push(word.slice(0, -1)); // gloves → glove
  } else if (word.endsWith("es")) {
    const stem = word.slice(0, -2);
    // potatoes → potato only (not "potatoe"); shoes → shoe; foxes → fox; horses → horse
    if (word.endsWith("oes") && pluralForms(stem).has(word)) candidates.push(stem);
    else {
      // buses → bus, glasses → glass; but not horses → "hors"
      if (!stem.endsWith("s") || /[aeiou]s$|ss$/.test(stem)) candidates.push(stem);
      candidates.push(word.slice(0, -1));
    }
  } else if (word.endsWith("s")) {
    candidates.push(word.slice(0, -1)); // grapes → grape
  }
  for (const c of candidates) if (c.length >= 2 && pluralForms(c).has(word)) out.push(c);
  return out;
}

/** True when a typed word is the picture's word, or its correct plural or singular. */
export function sameWord(typed: string, word: string): boolean {
  if (!typed || !word) return false;
  if (typed === word) return true;
  if (pluralForms(word).has(typed)) return true;
  return singularForms(word).includes(typed);
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
