// Changes to the saved data, built as a new copy. The caller saves the copy and
// only adopts it once the save worked, so a failed save never half-applies.

import { STARTERS } from "./starters";
import { emptyProgress, picturesChanged, type Page, type Progress, type StorySet } from "./story";

export interface Data {
  sets: StorySet[];
  progress: Record<string, Progress>;
  currentId: string;
  speak: boolean;
}

/** Saves a story from the editor: `id` is an existing set's id, or "new". */
export function withSetSaved(
  data: Data,
  id: string,
  edit: { title: string; pages: Page[] },
  newId: string,
): { next: Data; message: string } {
  const next = structuredClone(data);
  const existing = next.sets.find((s) => s.id === id);
  if (!existing) {
    next.sets.push({ id: newId, title: edit.title, pages: structuredClone(edit.pages), version: 1 });
    next.currentId = newId;
    return { next, message: "Saved. It's ready to play." };
  }
  let message = "Saved.";
  if (picturesChanged(existing.pages, edit.pages)) {
    existing.version += 1;
    delete next.progress[existing.id];
    message = "Saved. The pictures changed, so this story starts again from page 1.";
  }
  existing.title = edit.title;
  existing.pages = structuredClone(edit.pages);
  return { next, message };
}

export function withSetDeleted(data: Data, id: string): Data {
  const next = structuredClone(data);
  next.sets = next.sets.filter((s) => s.id !== id);
  delete next.progress[id];
  if (next.currentId === id) next.currentId = next.sets[0]?.id ?? "";
  return next;
}

export function withStartersRestored(data: Data): Data {
  const next = structuredClone(data);
  for (const s of STARTERS) if (!next.sets.some((x) => x.id === s.id)) next.sets.push(structuredClone(s));
  if (!next.sets.some((s) => s.id === next.currentId)) next.currentId = next.sets[0]?.id ?? "";
  return next;
}

export function withStoryRestarted(data: Data, id: string): Data {
  const next = structuredClone(data);
  const set = next.sets.find((s) => s.id === id);
  if (set) next.progress[id] = emptyProgress(set);
  return next;
}

/** Everything the child has written, as plain text, so it can be copied somewhere safe. */
export function allWriting(data: Data): string {
  const out: string[] = [];
  for (const set of data.sets) {
    const texts = data.progress[set.id]?.texts;
    if (!texts || !texts.some((p) => p.some((t) => t.trim()))) continue;
    out.push(set.title);
    texts.forEach((rows, pi) => {
      const written = rows.map((t) => t.trim()).filter(Boolean);
      if (written.length) out.push(`Page ${pi + 1}:`, ...written);
    });
    out.push("");
  }
  return out.join("\n").trim();
}
