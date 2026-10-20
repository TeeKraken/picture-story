import { describe, expect, it } from "vitest";
import { findPhrase, matchPictures, mergeRanges, parseWords, sameWord, tokenize } from "./match";

describe("sameWord", () => {
  it.each([
    ["dog", "dog"],
    ["dogs", "dog"],
    ["foxes", "fox"],
    ["babies", "baby"],
    ["boys", "boy"],
    ["leaves", "leaf"],
    ["knives", "knife"],
    ["mice", "mouse"],
    ["children", "child"],
    ["sheep", "sheep"],
    ["dog", "dogs"],
    ["mouse", "mice"],
  ])("%s counts for %s", (typed, word) => {
    expect(sameWord(typed, word)).toBe(true);
  });

  it.each([
    ["cat", "catch"],
    ["catch", "cat"],
    ["do", "dog"],
    ["be", "bee"],
    ["", "dog"],
  ])("%s does not count for %s", (typed, word) => {
    expect(sameWord(typed, word)).toBe(false);
  });
});

describe("tokenize", () => {
  it("finds words with their positions, ignoring case, accents and possessives", () => {
    const t = tokenize("The Dog’s café!");
    expect(t.map((x) => x.norm)).toEqual(["the", "dog", "cafe"]);
    expect(t[1]).toMatchObject({ start: 4, end: 9 });
  });
  it("handles letters beyond English", () => {
    expect(tokenize("Ñandú y pingüino").map((x) => x.norm)).toEqual(["nandu", "y", "pinguino"]);
  });
});

describe("parseWords", () => {
  it("splits on commas, tidies and drops repeats", () => {
    expect(parseWords(" Cat, kitten ,, KITTY; cat\nice  cream ")).toEqual(["cat", "kitten", "kitty", "ice cream"]);
  });
  it("returns nothing for punctuation only", () => {
    expect(parseWords(" , ; ")).toEqual([]);
  });
});

describe("findPhrase", () => {
  it("matches a phrase across words, with the last word plural", () => {
    const tokens = tokenize("We ate two ice creams and more ice cream.");
    expect(findPhrase(tokens, "ice cream")).toEqual([
      { start: 11, end: 21 },
      { start: 31, end: 40 },
    ]);
  });
  it("needs the phrase in order", () => {
    expect(findPhrase(tokenize("cream ice"), "ice cream")).toEqual([]);
  });
});

describe("matchPictures", () => {
  it("lights each picture whose word is used, and marks where", () => {
    const text = "My dogs chased a kitten.";
    const r = matchPictures(text, [["dog"], ["cat", "kitten"], ["ball"]]);
    expect(r.used).toEqual([true, true, false]);
    expect(r.ranges.map((x) => text.slice(x.start, x.end))).toEqual(["dogs", "kitten"]);
  });
  it("does not light a picture from part of a longer word", () => {
    expect(matchPictures("I can catch it", [["cat"]]).used).toEqual([false]);
  });
  it("works on empty text", () => {
    expect(matchPictures("", [["dog"]])).toEqual({ used: [false], ranges: [] });
  });
});

describe("mergeRanges", () => {
  it("joins overlapping spans", () => {
    expect(mergeRanges([{ start: 5, end: 9 }, { start: 0, end: 3 }, { start: 2, end: 4 }])).toEqual([
      { start: 0, end: 4 },
      { start: 5, end: 9 },
    ]);
  });
});
