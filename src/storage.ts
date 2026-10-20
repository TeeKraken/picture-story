import type { Data } from "./logic/edits";
import { STARTERS } from "./logic/starters";
import { cleanSets, type Progress } from "./logic/story";

export type Stored = Data;

export const KEY = "picture-story:v1";

export function defaults(): Stored {
  const sets = structuredClone(STARTERS);
  return { sets, progress: {}, currentId: sets[0].id, speak: true };
}

/** The browser's storage, or null when the browser blocks it (reading `localStorage` itself can throw). */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Reads saved data, falling back to the starter stories if storage is empty, blocked or corrupt. */
export function load(storage: Storage | null = browserStorage()): Stored {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<Stored>;
    const sets = cleanSets(parsed.sets);
    const progress =
      parsed.progress && typeof parsed.progress === "object" && !Array.isArray(parsed.progress)
        ? (parsed.progress as Record<string, Progress>)
        : {};
    const currentId =
      typeof parsed.currentId === "string" && sets.some((s) => s.id === parsed.currentId)
        ? parsed.currentId
        : (sets[0]?.id ?? "");
    return { sets, progress, currentId, speak: parsed.speak !== false };
  } catch {
    return defaults();
  }
}

/** Saves everything. Returns false if the browser refused (blocked, or out of space). */
export function save(data: Stored, storage: Storage | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
