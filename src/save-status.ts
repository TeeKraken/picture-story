// The "not saved" warning. Shown whenever a save fails, kept until a save works.

export interface SaveStatusOptions {
  /** An empty element to fill; it is shown only while there are unsaved changes. */
  root: HTMLElement;
  /** Tries to save again. Returns true if it worked. */
  retry: () => boolean;
  /** Everything written so far, as plain text, for copying. */
  backupText: () => string;
  /** Copies text; defaults to the clipboard. Rejects if it can't. */
  copy?: (text: string) => Promise<void>;
}

export interface SaveStatus {
  /** Report how a save went. */
  report(ok: boolean): void;
  readonly unsaved: boolean;
}

export function createSaveStatus(opts: SaveStatusOptions): SaveStatus {
  const { root, retry, backupText } = opts;
  const copy = opts.copy ?? ((t: string) => navigator.clipboard.writeText(t));
  const doc = root.ownerDocument;
  let unsaved = false;

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ""): HTMLElementTagNameMap[K] {
    const e = doc.createElement(tag);
    e.className = className;
    e.textContent = text;
    return e;
  }

  // The alert region stays in the page so screen readers announce changes to it.
  const alert = el("p", "save-alert");
  alert.setAttribute("role", "alert");
  const retryBtn = el("button", "btn btn-go btn-small", "Try saving again");
  retryBtn.type = "button";
  const copyBtn = el("button", "btn btn-quiet btn-small", "Copy all writing");
  copyBtn.type = "button";
  const copyNote = el("p", "save-note");
  copyNote.setAttribute("role", "status");
  const fallback = el("textarea", "save-fallback");
  fallback.readOnly = true;
  fallback.hidden = true;
  fallback.rows = 5;
  fallback.setAttribute("aria-label", "All writing, to copy");
  fallback.setAttribute("spellcheck", "false");
  const actions = el("div", "save-actions");
  actions.append(retryBtn, copyBtn);
  const box = el("div", "save-box");
  box.hidden = true;
  box.append(actions, copyNote, fallback);
  root.replaceChildren(alert, box);
  root.hidden = false;

  const MESSAGE =
    "Not saved. This device's storage is full or blocked. Your writing is still here while this page is open: copy it, or free some space and try again.";

  function show() {
    root.classList.add("unsaved");
    box.hidden = false;
    if (!unsaved) alert.textContent = MESSAGE;
    unsaved = true;
  }
  function clear() {
    if (!unsaved) return;
    unsaved = false;
    root.classList.remove("unsaved");
    box.hidden = true;
    fallback.hidden = true;
    copyNote.textContent = "";
    alert.textContent = "Saved. Everything is kept on this device again.";
  }

  retryBtn.addEventListener("click", () => {
    if (retry()) clear();
    else alert.textContent = "Still not saved. " + MESSAGE.slice("Not saved. ".length);
  });
  copyBtn.addEventListener("click", async () => {
    const text = backupText() || "(Nothing written yet.)";
    try {
      await copy(text);
      copyNote.textContent = "Copied. Paste it somewhere safe, like a note or an email to yourself.";
    } catch {
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      copyNote.textContent = "Couldn't copy automatically. The writing is selected below: copy it from there.";
    }
  });

  return {
    report(ok: boolean) {
      if (ok) clear();
      else show();
    },
    get unsaved() {
      return unsaved;
    },
  };
}
