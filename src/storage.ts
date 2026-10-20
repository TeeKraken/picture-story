import { STARTERS } from "./logic/starters";
import { cleanSets, type Progress, type StorySet } from "./logic/story";

export interface Stored {
  sets: StorySet[];
  progress: Record<string, Progress>;
  currentId: string;
  /** Say words and stories aloud (only ever with a voice that runs on this device). */
  speak: boolean;
}

const KEY = "picture-story:v1";

export function defaults(): Stored {
  const sets = structuredClone(STARTERS);
  return { sets, progress: {}, currentId: sets[0].id, speak: true };
}

/** Reads saved data, falling back to the starter stories if storage is empty, blocked or corrupt. */
export function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
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

/** Saves everything. Returns false if the browser refused (for example, it is out of space). */
export function save(data: Stored): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
