// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { allWriting, withSetDeleted, withSetSaved } from "./logic/edits";
import { emptyProgress } from "./logic/story";
import { createSaveStatus } from "./save-status";
import { KEY, browserStorage, defaults, load, save } from "./storage";

/** A Storage whose writes fail while `full` is true, like a browser that's out of quota. */
function quotaStorage() {
  const map = new Map<string, string>();
  const s = {
    full: false,
    writes: 0,
    getItem: (k: string) => map.get(k) ?? null,
    setItem(k: string, v: string) {
      s.writes++;
      if (s.full) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  };
  return s;
}
const asStorage = (s: ReturnType<typeof quotaStorage>) => s as unknown as Storage;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("storage that is denied or full", () => {
  it("falls back to the starter stories and reports saves as failed when access is denied", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Access denied", "SecurityError");
    });
    expect(browserStorage()).toBeNull();
    expect(load()).toEqual(defaults());
    expect(save(defaults())).toBe(false);
  });

  it("reports a failed save when over quota, and keeps the last good copy", () => {
    const store = quotaStorage();
    const data = defaults();
    expect(save(data, asStorage(store))).toBe(true);
    data.progress[data.sets[0].id] = { ...emptyProgress(data.sets[0]), texts: [["new writing"]] };
    store.full = true;
    expect(save(data, asStorage(store))).toBe(false);
    expect(load(asStorage(store)).progress).toEqual({});
  });
});

function mountStatus(retry: () => boolean, copy?: (t: string) => Promise<void>, text = "My story") {
  const root = document.createElement("div");
  root.hidden = true;
  document.body.append(root);
  const status = createSaveStatus({ root, retry, backupText: () => text, copy });
  const alertText = () => root.querySelector('[role="alert"]')!.textContent;
  const button = (name: string) =>
    [...root.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLButtonElement;
  const box = () => root.querySelector(".save-box") as HTMLElement;
  return { root, status, alertText, button, box };
}

describe("the not-saved warning", () => {
  it("shows and announces a lasting warning, then clears only after a save works", () => {
    let works = false;
    const ui = mountStatus(() => works);
    expect(ui.box().hidden).toBe(true);

    ui.status.report(false);
    expect(ui.status.unsaved).toBe(true);
    expect(ui.root.classList.contains("unsaved")).toBe(true);
    expect(ui.box().hidden).toBe(false);
    expect(ui.alertText()).toMatch(/^Not saved\./);

    // Retrying while storage is still full keeps the warning.
    ui.button("Try saving again").click();
    expect(ui.status.unsaved).toBe(true);
    expect(ui.alertText()).toMatch(/^Still not saved\./);

    works = true;
    ui.button("Try saving again").click();
    expect(ui.status.unsaved).toBe(false);
    expect(ui.box().hidden).toBe(true);
    expect(ui.alertText()).toMatch(/^Saved\./);
  });

  it("does not re-announce on every failed autosave", () => {
    const ui = mountStatus(() => false);
    ui.status.report(false);
    const first = ui.alertText();
    ui.status.report(false);
    expect(ui.alertText()).toBe(first);
  });

  it("copies all the writing", async () => {
    const copy = vi.fn(async () => {});
    const ui = mountStatus(() => false, copy, "A day on the farm\nPage 1:\nThe cow ran.");
    ui.status.report(false);
    ui.button("Copy all writing").click();
    await vi.waitFor(() => expect(copy).toHaveBeenCalledWith("A day on the farm\nPage 1:\nThe cow ran."));
    await vi.waitFor(() => expect(ui.root.textContent).toContain("Copied."));
  });

  it("shows the writing to copy by hand when the clipboard is refused", async () => {
    const ui = mountStatus(() => false, async () => Promise.reject(new Error("denied")), "The cow ran.");
    ui.status.report(false);
    ui.button("Copy all writing").click();
    const area = ui.root.querySelector("textarea")!;
    await vi.waitFor(() => expect(area.hidden).toBe(false));
    expect(area.value).toBe("The cow ran.");
    expect(area.getAttribute("spellcheck")).toBe("false");
  });
});

describe("saving changes when storage fails", () => {
  it("applies an edited story on retry after a failed save", () => {
    const store = quotaStorage();
    let data = defaults();
    const farm = data.sets[0];
    data.progress[farm.id] = { ...emptyProgress(farm), texts: [["the cow"]] };
    expect(save(data, asStorage(store))).toBe(true);

    const pages = structuredClone(farm.pages);
    pages[0].rows[0].pictures[0].words = ["cow", "calf"];
    const edit = { title: "Farm day", pages };

    // First attempt: storage is full. Nothing changes.
    store.full = true;
    const first = withSetSaved(data, farm.id, edit, "unused");
    expect(save(first.next, asStorage(store))).toBe(false);
    expect(data.sets[0].title).toBe("A day on the farm");

    // Space is freed; the retry is built from the current data again.
    store.full = false;
    const retry = withSetSaved(data, farm.id, edit, "unused");
    expect(save(retry.next, asStorage(store))).toBe(true);
    data = retry.next;

    const saved = JSON.parse(store.getItem(KEY)!);
    const set = saved.sets.find((s: { id: string }) => s.id === farm.id);
    expect(set.title).toBe("Farm day");
    expect(set.pages[0].rows[0].pictures[0].words).toEqual(["cow", "calf"]);
    expect(set.version).toBe(farm.version + 1);
    expect(saved.progress[farm.id]).toBeUndefined();
    expect(retry.message).toMatch(/starts again/);
  });

  it("leaves a story in place when deleting it can't be saved", () => {
    const store = quotaStorage();
    const data = defaults();
    store.full = true;
    const next = withSetDeleted(data, data.sets[0].id);
    expect(save(next, asStorage(store))).toBe(false);
    expect(data.sets).toHaveLength(3);
  });

  it("gathers everything written for copying", () => {
    const data = defaults();
    const farm = data.sets[0];
    data.progress[farm.id] = { ...emptyProgress(farm), texts: [["The cow ran.", "", "  "], ["An apple."]] };
    expect(allWriting(data)).toBe("A day on the farm\nPage 1:\nThe cow ran.\nPage 2:\nAn apple.");
  });
});
