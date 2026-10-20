import { describe, expect, it } from "vitest";
import { STARTERS, EMOJI } from "./starters";
import {
  checkDraft,
  cleanSets,
  emptyProgress,
  fitProgress,
  pageDone,
  pagesDone,
  picturesChanged,
  rowState,
  storyParagraphs,
  tidySentence,
  toDraft,
  type StorySet,
} from "./story";

const set: StorySet = {
  id: "t",
  title: "Test",
  version: 3,
  pages: [
    { rows: [{ pictures: [{ emoji: "🐶", words: ["dog"] }, { emoji: "⚽", words: ["ball"] }] }, { pictures: [{ emoji: "☀️", words: ["sun"] }] }] },
    { rows: [{ pictures: [{ emoji: "🌙", words: ["moon"] }] }] },
  ],
};

describe("rowState", () => {
  it("counts used pictures and is done only when all are used", () => {
    const row = set.pages[0].rows[0];
    expect(rowState(row, "the dog ran")).toEqual({ used: [true, false], usedCount: 1, done: false });
    expect(rowState(row, "the dog ran after two balls").done).toBe(true);
  });
});

describe("progress", () => {
  it("starts empty with a text slot for every row", () => {
    expect(emptyProgress(set)).toEqual({ version: 3, page: 0, texts: [["", ""], [""]], finished: false });
  });
  it("starts over when the set's pictures changed", () => {
    const old = { ...emptyProgress(set), version: 2, texts: [["x", "y"], ["z"]] };
    expect(fitProgress(set, old)).toEqual(emptyProgress(set));
  });
  it("keeps good progress, fills gaps and clamps the page", () => {
    const saved = { version: 3, page: 9, texts: [["a dog"]], finished: false } as never;
    expect(fitProgress(set, saved)).toEqual({ version: 3, page: 1, texts: [["a dog", ""], [""]], finished: false });
  });
  it("survives junk", () => {
    expect(fitProgress(set, { nonsense: true } as never)).toEqual(emptyProgress(set));
  });
});

describe("story", () => {
  it("tidies sentences", () => {
    expect(tidySentence("  the  dog\nran ")).toBe("The dog ran.");
    expect(tidySentence("wow!")).toBe("Wow!");
    expect(tidySentence("   ")).toBe("");
  });

  it("includes only finished pages, in order", () => {
    const pr = emptyProgress(set);
    pr.texts[0] = ["my dog has a ball", "the sun is hot"];
    pr.texts[1] = ["no match here"];
    expect(pageDone(set.pages[0], pr.texts[0])).toBe(true);
    expect(pageDone(set.pages[1], pr.texts[1])).toBe(false);
    expect(storyParagraphs(set, pr)).toEqual(["My dog has a ball. The sun is hot."]);
    expect(pagesDone(set, pr)).toBe(1);
    pr.texts[1] = ["Goodnight moon!"];
    expect(storyParagraphs(set, pr)).toEqual(["My dog has a ball. The sun is hot.", "Goodnight moon!"]);
  });
});

describe("checkDraft", () => {
  it("accepts a good draft and parses words", () => {
    const r = checkDraft({ title: "  At  the park ", pages: [{ rows: [{ pictures: [{ emoji: "🐶", words: "Dog, puppy" }] }] }] });
    expect(r).toEqual({ ok: true, title: "At the park", pages: [{ rows: [{ pictures: [{ emoji: "🐶", words: ["dog", "puppy"] }] }] }] });
  });
  it("explains every problem and where it is", () => {
    const r = checkDraft({
      title: "",
      pages: [{ rows: [{ pictures: [{ words: "" }] }, { pictures: [] }] }, { rows: [] }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.at)).toEqual(["title", "p0-r0-c0", "p0-r1", "p1"]);
    expect(r.errors[1].message).toContain("is empty. Choose a picture");
  });
  it("says exactly what one picture is missing", () => {
    const r = checkDraft({ title: "x", pages: [{ rows: [{ pictures: [{ emoji: "🐶", words: " , " }, { words: "cat" }] }] }] });
    expect(r.ok ? [] : r.errors.map((e) => e.message)).toEqual([
      "Page 1, row 1, picture 1 needs a word, like “dog”. Your child uses it to light up the picture.",
      "Page 1, row 1, picture 2 needs a picture. Choose an emoji or a photo.",
    ]);
  });
  it("round-trips through the editor draft", () => {
    for (const s of STARTERS) {
      const r = checkDraft(toDraft(s));
      expect(r.ok).toBe(true);
      if (r.ok) expect(picturesChanged(r.pages, s.pages)).toBe(false);
    }
  });
});

describe("cleanSets", () => {
  it("keeps the starters and drops broken sets", () => {
    expect(cleanSets(STARTERS)).toHaveLength(STARTERS.length);
    expect(cleanSets([{ id: "x" }, null, { ...set, pages: [] }, set])).toEqual([set]);
    expect(cleanSets("nope")).toEqual([]);
    const badPhoto = { ...set, pages: [{ rows: [{ pictures: [{ photo: "javascript:alert(1)", words: ["x"] }] }] }] };
    expect(cleanSets([badPhoto])).toEqual([]);
  });
});

describe("starter content", () => {
  it("every starter row can be finished with its own first words", () => {
    for (const s of STARTERS)
      for (const page of s.pages)
        for (const row of page.rows) {
          const text = row.pictures.map((p) => p.words[0]).join(" and ");
          expect(rowState(row, text).done).toBe(true);
        }
  });
  it("emoji suggestions have one word or phrase each", () => {
    for (const g of EMOJI) for (const [e, w] of g.items) expect(e && /^[a-z ]+$/.test(w)).toBeTruthy();
  });
});
