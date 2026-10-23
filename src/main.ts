import "./style.css";
import { shrinkPhoto } from "./image";
import { matchPictures } from "./logic/match";
import { EMOJI, STARTERS } from "./logic/starters";
import {
  LIMITS,
  checkDraft,
  fitProgress,
  pageDone,
  pagesDone,
  rowState,
  storyParagraphs,
  toDraft,
  type Draft,
  type DraftError,
  type DraftPicture,
  type Picture,
  type Progress,
  type StorySet,
} from "./logic/story";
import { canSpeak, initSpeech, say, stopSpeaking } from "./speech";
import { allWriting, withSetDeleted, withSetSaved, withStartersRestored, withStoryRestarted } from "./logic/edits";
import { createSaveStatus } from "./save-status";
import { load, save, type Stored } from "./storage";

const IDEA_URL = "https://somebodybuildthis.dev/ideas/37-a-picture-story-writing-game-for-kids-that-lights-up-each-pi";
const REPO_URL = "https://github.com/TeeKraken/picture-story";

const main = document.getElementById("main")!;
const announcer = document.getElementById("announce")!;
let data: Stored = load();
/** A message to show at the top of the next screen (e.g. "Saved."). */
let notice = "";

// ---------- Small helpers ----------

type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;
type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = String(v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

function announce(text: string) {
  // Clear first so the same words are read again if repeated.
  announcer.textContent = "";
  window.setTimeout(() => (announcer.textContent = text), 50);
}

const saveStatus = createSaveStatus({
  root: document.getElementById("save-status")!,
  retry: () => save(data),
  backupText: () => allWriting(data),
});

/** Saves the current data. Every save goes through here, so a failure always shows the warning. */
function persist(): boolean {
  window.clearTimeout(saveTimer);
  const ok = save(data);
  saveStatus.report(ok);
  return ok;
}

/** Saves a changed copy of the data, and only switches to it if the save worked. */
function commit(next: Stored): boolean {
  window.clearTimeout(saveTimer);
  const ok = save(next);
  if (ok) {
    data = next;
    saveStatus.report(true);
  }
  // On failure `data` is untouched; the caller says what didn't happen.
  return ok;
}

let saveTimer = 0;
function persistSoon() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persist, 300);
}
window.addEventListener("pagehide", () => persist());

function current(): StorySet | undefined {
  return data.sets.find((s) => s.id === data.currentId) ?? data.sets[0];
}

function progressFor(set: StorySet): Progress {
  const p = fitProgress(set, data.progress[set.id]);
  data.progress[set.id] = p;
  return p;
}

function pictureFace(pic: Picture | DraftPicture, cls = "face") {
  if (pic.photo) return h("img", { class: `${cls} photo`, src: pic.photo, alt: "", draggable: "false" });
  if (pic.emoji) return h("span", { class: `${cls} emoji`, "aria-hidden": "true" }, pic.emoji);
  return h("span", { class: `${cls} empty`, "aria-hidden": "true" }, "?");
}

function speakAllowed() {
  return data.speak && canSpeak();
}

function noticeEl() {
  if (!notice) return null;
  const el = h("p", { class: "notice", role: "status" }, notice);
  notice = "";
  return el;
}

const POST_IDEA_URL = "https://somebodybuildthis.dev/ideas/new";

// The "post a wish" line is for grown-ups, so it only shows on the stories
// screen (next to "For grown-ups"), never on the writing or story pages.
function footer({ wish = false }: { wish?: boolean } = {}) {
  return h(
    "footer",
    { class: "foot" },
    h(
      "p",
      {},
      "Stories, writing and photos are saved on this device only. The app has no account or tracking, and never uploads them.",
    ),
    h(
      "p",
      {},
      "Made entirely by an AI (Claude, by Anthropic) from ",
      h("a", { href: IDEA_URL }, "an idea on Somebody Build This"),
      ". ",
      h("a", { href: REPO_URL }, "Open source"),
      ".",
    ),
    wish
      ? h(
          "p",
          {},
          "Made from a wish someone posted on Somebody Build This. Wish something existed? ",
          h("a", { href: POST_IDEA_URL }, "Post it there"),
          ", no tech words needed.",
        )
      : null,
  );
}

function focusHeading() {
  const h1 = main.querySelector("h1");
  if (h1) {
    h1.setAttribute("tabindex", "-1");
    h1.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
}

// ---------- Routing ----------

function route() {
  stopSpeaking();
  const hash = location.hash.replace(/^#\/?/, "");
  main.replaceChildren();
  if (!data.sets.length && !hash.startsWith("edit")) return renderStories();
  if (hash === "story") return renderStory();
  if (hash === "stories") return renderStories();
  if (hash.startsWith("edit/")) return renderEditor(decodeURIComponent(hash.slice(5)));
  return renderPlay();
}

function go(hash: string) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

window.addEventListener("hashchange", () => {
  route();
  focusHeading();
});

// ---------- Play: write under each row ----------

function renderPlay() {
  const set = current();
  if (!set) return renderStories();
  const progress = progressFor(set);
  const pageIndex = progress.page;
  const page = set.pages[pageIndex];
  const texts = progress.texts[pageIndex];
  const revealed = new Set<string>();

  const doneCount = h("p", { class: "page-progress" });
  const storyBtn = h("button", { type: "button", class: "btn btn-go", id: "to-story" }, "Read my story");
  const storyHint = h("p", { class: "hint", id: "story-hint" });

  function updatePageStatus() {
    const states = page.rows.map((r, i) => rowState(r, texts[i]));
    const done = states.filter((s) => s.done).length;
    doneCount.textContent = `${done} of ${page.rows.length} rows done`;
    const all = done === page.rows.length;
    storyBtn.setAttribute("aria-disabled", String(!all));
    if (all) storyBtn.removeAttribute("aria-describedby");
    else storyBtn.setAttribute("aria-describedby", "story-hint");
    storyHint.textContent = all
      ? ""
      : "Light up every picture on this page to read your story. Stuck? Tap a picture to see its word.";
    return all;
  }

  storyBtn.addEventListener("click", () => {
    if (!updatePageStatus()) {
      announce(storyHint.textContent ?? "");
      return;
    }
    persist();
    go("#/story");
  });

  const rows = page.rows.map((row, ri) => {
    const textId = `text-${ri}`;
    const status = h("p", { class: "row-status", id: `status-${ri}` });
    const mirror = h("div", { class: "mirror", "aria-hidden": "true" });
    const area = h("textarea", {
      id: textId,
      rows: 2,
      maxlength: LIMITS.text,
      autocomplete: "off",
      autocapitalize: "sentences",
      // Off: some browsers' spellcheck sends text to an online service.
      spellcheck: "false",
      autocorrect: "off",
      "aria-describedby": `status-${ri}`,
    }) as HTMLTextAreaElement;
    area.value = texts[ri];

    const picButtons = row.pictures.map((pic, ci) => {
      const word = h("span", { class: "pic-word" }, pic.words[0]);
      const btn = h(
        "button",
        { type: "button", class: "pic", "data-lit": "false" },
        pictureFace(pic),
        h("span", { class: "check", "aria-hidden": "true" }, "✓"),
      );
      btn.addEventListener("click", () => {
        revealed.add(`${ri}-${ci}`);
        update(false);
        announce(`This picture is: ${pic.words[0]}.`);
        if (speakAllowed()) say(pic.words[0]);
      });
      return { btn, word, pic, ci };
    });

    let lastUsed: boolean[] | null = null;
    function update(announceChanges: boolean) {
      const text = area.value;
      const state = rowState(row, text);
      const { ranges } = matchPictures(
        text,
        row.pictures.map((p) => p.words),
      );
      // Highlight the words that lit a picture, behind the text box.
      const parts: Node[] = [];
      let at = 0;
      for (const r of ranges) {
        parts.push(document.createTextNode(text.slice(at, r.start)));
        parts.push(h("mark", {}, text.slice(r.start, r.end)));
        at = r.end;
      }
      parts.push(document.createTextNode(text.slice(at) + "​"));
      mirror.replaceChildren(...parts);
      area.style.height = "auto";
      area.style.height = `${area.scrollHeight}px`;

      const n = row.pictures.length;
      picButtons.forEach(({ btn, word, pic, ci }) => {
        const lit = state.used[ci];
        const shown = lit || revealed.has(`${ri}-${ci}`);
        btn.dataset.lit = String(lit);
        if (shown && !btn.contains(word)) btn.append(word);
        if (!shown) word.remove();
        btn.setAttribute(
          "aria-label",
          lit
            ? `Picture ${ci + 1} of ${n}: ${pic.words[0]}. Lit up.`
            : shown
              ? `Picture ${ci + 1} of ${n}: ${pic.words[0]}. Not lit yet.`
              : `Picture ${ci + 1} of ${n}. Not lit yet. Show its word.`,
        );
      });
      status.textContent = state.done
        ? `Row done: all ${n} pictures lit.`
        : `${state.usedCount} of ${n} pictures lit.`;
      status.dataset.done = String(state.done);

      if (announceChanges && lastUsed) {
        const newly = state.used
          .map((u, i) => (u && !lastUsed![i] ? row.pictures[i].words[0] : null))
          .filter(Boolean);
        if (newly.length) {
          announce(
            `Lit up: ${newly.join(", ")}. ${state.done ? `Row ${ri + 1} done.` : `${state.usedCount} of ${n} in row ${ri + 1}.`}`,
          );
          if (window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
            picButtons.forEach(({ btn, ci }) => {
              if (state.used[ci] && !lastUsed![ci]) {
                btn.classList.remove("pop");
                void btn.offsetWidth;
                btn.classList.add("pop");
              }
            });
          }
        }
      }
      lastUsed = state.used;
    }

    area.addEventListener("input", () => {
      texts[ri] = area.value;
      progress.finished = false;
      update(true);
      updatePageStatus();
      persistSoon();
    });

    const card = h(
      "section",
      { class: "row-card", "aria-labelledby": `row-title-${ri}` },
      h("h2", { class: "row-title", id: `row-title-${ri}` }, `Row ${ri + 1}`),
      h("ul", { class: "pics", role: "list" }, ...picButtons.map(({ btn }) => h("li", {}, btn))),
      h(
        "div",
        { class: "write" },
        h("label", { for: textId, class: "visually-hidden" }, `Your sentences for row ${ri + 1}`),
        mirror,
        area,
      ),
      status,
    );
    // Size and paint once the box is in the page.
    queueMicrotask(() => update(false));
    return card;
  });

  const nav = h("div", { class: "page-nav" });
  if (pageIndex > 0) {
    nav.append(
      h(
        "button",
        {
          type: "button",
          class: "btn btn-quiet btn-small",
          onclick: () => {
            progress.page = pageIndex - 1;
            persist();
            route();
            focusHeading();
          },
        },
        "Back a page",
      ),
    );
  }

  main.append(
    h(
      "header",
      { class: "top" },
      h("a", { class: "btn btn-quiet btn-small", href: "#/stories" }, "All stories"),
      h("p", { class: "page-of" }, `Page ${pageIndex + 1} of ${set.pages.length}`),
    ),
    noticeEl() ?? "",
    h("h1", { class: "title" }, set.title),
    h(
      "p",
      { class: "lede" },
      "Write a sentence or two about each row. When you use a picture's word, the picture lights up. Stuck? Tap a picture.",
    ),
    ...rows,
    h("div", { class: "finish" }, doneCount, storyBtn, storyHint, nav),
    footer(),
  );
  updatePageStatus();
}

// ---------- Story: read it back ----------

function renderStory() {
  const set = current();
  if (!set) return renderStories();
  const progress = progressFor(set);
  const paragraphs = storyParagraphs(set, progress);
  const finished = pagesDone(set, progress);
  const thisPageDone = pageDone(set.pages[progress.page], progress.texts[progress.page]);
  const isLast = progress.page === set.pages.length - 1;
  const allDone = finished === set.pages.length;
  if (allDone) progress.finished = true;
  persist();

  const pagesWithText = set.pages
    .map((page, pi) => ({ page, pi }))
    .filter(({ page, pi }) => pageDone(page, progress.texts[pi]));

  const storyEl = h(
    "article",
    { class: "story", "aria-labelledby": "story-title" },
    ...pagesWithText.map(({ page }, i) =>
      h(
        "section",
        { class: "story-page" },
        h(
          "div",
          { class: "story-pics", "aria-hidden": "true" },
          ...page.rows.flatMap((r) => r.pictures.map((p) => pictureFace(p, "mini"))),
        ),
        h("p", {}, paragraphs[i]),
      ),
    ),
    allDone ? h("p", { class: "the-end" }, "The end.") : null,
  );

  const summary = allDone
    ? `You finished all ${set.pages.length} ${set.pages.length === 1 ? "page" : "pages"}.`
    : `You have finished ${finished} of ${set.pages.length} pages so far.`;

  const actions = h("div", { class: "actions" });
  const readBtn = h("button", { type: "button", class: "btn btn-quiet", id: "read-aloud" }, "Read it to me");
  if (speakAllowed() && paragraphs.length) {
    let reading = false;
    readBtn.addEventListener("click", () => {
      if (reading) {
        stopSpeaking();
        reading = false;
        readBtn.textContent = "Read it to me";
        return;
      }
      reading = true;
      readBtn.textContent = "Stop reading";
      say([set.title, ...paragraphs, allDone ? "The end." : ""].join(" "), () => {
        reading = false;
        readBtn.textContent = "Read it to me";
      });
    });
    actions.append(readBtn);
  }

  if (thisPageDone && !isLast) {
    actions.prepend(
      h(
        "button",
        {
          type: "button",
          class: "btn btn-go",
          onclick: () => {
            progress.page += 1;
            persist();
            notice = `Page ${progress.page + 1}: new pictures!`;
            go("#/");
          },
        },
        "Turn the page",
      ),
    );
  }
  if (allDone) {
    actions.prepend(h("a", { class: "btn btn-go", href: "#/stories" }, "Choose another story"));
    actions.append(
      h(
        "button",
        {
          type: "button",
          class: "btn btn-quiet",
          onclick: () => {
            if (!confirm("Start this story again? The writing in it will be cleared.")) return;
            if (!commit(withStoryRestarted(data, set.id))) {
              announce("Couldn't start again: this device's storage is full or blocked. Nothing was cleared.");
              return;
            }
            notice = "Starting again from page 1.";
            go("#/");
          },
        },
        "Write this one again",
      ),
    );
  }
  actions.append(
    h("button", { type: "button", class: "btn btn-quiet", onclick: () => window.print() }, "Print"),
    h("a", { class: "btn btn-quiet", href: "#/" }, allDone ? "Look at my writing" : "Back to writing"),
  );

  main.append(
    h("header", { class: "top" }, h("a", { class: "btn btn-quiet btn-small", href: "#/stories" }, "All stories")),
    h("h1", { class: "title", id: "story-title" }, set.title),
    h("p", { class: "lede" }, summary),
    paragraphs.length
      ? storyEl
      : h("p", { class: "empty-state" }, "No finished pages yet. Light up every picture on a page and your story appears here."),
    actions,
    footer(),
  );
}

// ---------- Stories: choose one, and grown-up settings ----------

function renderStories() {
  const list = h("ul", { class: "set-list", role: "list" });
  for (const set of data.sets) {
    const p = fitProgress(set, data.progress[set.id]);
    const pics = set.pages.reduce((n, pg) => n + pg.rows.reduce((m, r) => m + r.pictures.length, 0), 0);
    const done = pagesDone(set, p);
    const started = p.texts.some((t) => t.some((x) => x.trim()));
    const state =
      done === set.pages.length ? "Finished" : started ? `On page ${p.page + 1} of ${set.pages.length}` : "Not started";
    const first = set.pages[0].rows[0].pictures.slice(0, 3);
    list.append(
      h(
        "li",
        { class: "set-card" },
        h("div", { class: "set-pics", "aria-hidden": "true" }, ...first.map((x) => pictureFace(x, "mini"))),
        h(
          "div",
          { class: "set-text" },
          h("h3", {}, set.title),
          h(
            "p",
            { class: "hint" },
            `${set.pages.length} ${set.pages.length === 1 ? "page" : "pages"} · ${pics} pictures · ${state}`,
          ),
        ),
        h(
          "div",
          { class: "set-actions" },
          h(
            "button",
            {
              type: "button",
              class: "btn btn-go btn-small",
              "aria-label": `Play ${set.title}`,
              onclick: () => {
                data.currentId = set.id;
                persist();
                go("#/");
              },
            },
            "Play",
          ),
          h(
            "a",
            { class: "btn btn-quiet btn-small", href: `#/edit/${encodeURIComponent(set.id)}`, "aria-label": `Change ${set.title}` },
            "Change",
          ),
        ),
      ),
    );
  }

  const missing = STARTERS.filter((s) => !data.sets.some((x) => x.id === s.id));
  const speakBox = h("input", { type: "checkbox", id: "speak" }) as HTMLInputElement;
  speakBox.checked = data.speak;
  speakBox.addEventListener("change", () => {
    data.speak = speakBox.checked;
    persist();
    voiceNote.textContent = voiceText();
  });
  const voiceText = () =>
    canSpeak()
      ? data.speak
        ? "Words and stories can be read aloud with a voice built into this device."
        : "Reading aloud is off."
      : "This device has no built-in voice the app can use, so it stays text-only. (Some voices send text online; the app never uses those.)";
  const voiceNote = h("p", { class: "hint", id: "voice-note", "aria-live": "polite" }, voiceText());
  refreshVoiceNote = () => (voiceNote.textContent = voiceText());

  main.append(
    noticeEl() ?? "",
    h(
      "header",
      { class: "brand" },
      h("h1", {}, "Picture Story"),
      h("p", { class: "lede" }, "Write about the pictures, light them all up, and make a story."),
    ),
    data.sets.length
      ? h("section", { "aria-labelledby": "choose-title" }, h("h2", { id: "choose-title" }, "Choose a story"), list)
      : h("p", { class: "empty-state" }, "There are no stories yet. Make one below, or add the starter stories back."),
    h(
      "section",
      { class: "grown-ups", "aria-labelledby": "grown-title" },
      h("h2", { id: "grown-title" }, "For grown-ups"),
      h(
        "p",
        {},
        "Make your own story: choose rows of pictures (emoji, or your own photos and drawings) and the word for each. Your child writes about each row; a picture lights up when its word is used, plurals too (dog, dogs).",
      ),
      h("a", { class: "btn btn-go", href: "#/edit/new" }, "Make a new story"),
      h(
        "div",
        { class: "setting" },
        h("label", { class: "check", for: "speak" }, speakBox, " Read words and stories aloud"),
        voiceNote,
      ),
      missing.length
        ? h(
            "button",
            {
              type: "button",
              class: "btn btn-quiet",
              onclick: () => {
                if (!commit(withStartersRestored(data))) {
                  announce("Couldn't add the starter stories: this device's storage is full or blocked.");
                  return;
                }
                notice = "The starter stories are back.";
                route();
                focusHeading();
              },
            },
            "Add the starter stories back",
          )
        : null,
    ),
    footer({ wish: true }),
  );
}

// ---------- Editor: grown-ups make or change a story ----------

let refreshVoiceNote: (() => void) | null = null;
let draft: Draft | null = null;
let draftFor = "";
let pickerTarget: DraftPicture | null = null;
let afterPick: (() => void) | null = null;

function renderEditor(id: string) {
  const existing = data.sets.find((s) => s.id === id);
  if (id !== "new" && !existing) {
    notice = "That story isn't on this device any more.";
    return renderStories();
  }
  if (!draft || draftFor !== id) {
    draft = existing
      ? toDraft(existing)
      : { title: "", pages: [{ rows: [{ pictures: [{ words: "" }, { words: "" }, { words: "" }] }] }] };
    draftFor = id;
  }
  const d = draft;
  const errorBox = h("div", { class: "error-box", id: "errors", tabindex: "-1", hidden: true });

  const title = h("input", {
    id: "title",
    type: "text",
    maxlength: LIMITS.title,
    autocomplete: "off",
    placeholder: "At the park",
  }) as HTMLInputElement;
  title.value = d.title;
  title.addEventListener("input", () => (d.title = title.value));

  function rerender(focusSelector?: string) {
    main.replaceChildren();
    renderEditor(id);
    if (focusSelector) (main.querySelector(focusSelector) as HTMLElement | null)?.focus();
  }

  const pages = d.pages.map((page, pi) => {
    const rows = page.rows.map((row, ri) => {
      const pics = row.pictures.map((pic, ci) => {
        const key = `p${pi}-r${ri}-c${ci}`;
        const words = h("input", {
          id: `${key}-words`,
          type: "text",
          maxlength: LIMITS.words,
          autocomplete: "off",
          autocapitalize: "off",
          placeholder: "dog, puppy",
          "aria-describedby": "words-hint",
        }) as HTMLInputElement;
        words.value = pic.words;
        words.addEventListener("input", () => (pic.words = words.value));
        return h(
          "li",
          { class: "edit-pic", id: key },
          h(
            "button",
            {
              type: "button",
              class: "pick",
              id: `${key}-pick`,
              "aria-label": `Picture ${ci + 1}: ${pic.photo ? "your photo" : pic.emoji ? pic.emoji : "none yet"}. Choose a picture`,
              onclick: () =>
                openPicker(pic, () => rerender(`#${key}-words`)),
            },
            pictureFace(pic),
          ),
          h("label", { for: `${key}-words`, class: "small-label" }, `Word ${ci + 1}`),
          words,
          h(
            "button",
            {
              type: "button",
              class: "link-btn",
              "aria-label": `Remove picture ${ci + 1} from page ${pi + 1}, row ${ri + 1}`,
              onclick: () => {
                row.pictures.splice(ci, 1);
                rerender(`#add-p${pi}-r${ri}`);
              },
            },
            "Remove",
          ),
        );
      });
      return h(
        "div",
        { class: "edit-row", id: `p${pi}-r${ri}` },
        h(
          "div",
          { class: "edit-row-head" },
          h("h3", {}, `Row ${ri + 1}`),
          h(
            "button",
            {
              type: "button",
              class: "link-btn",
              "aria-label": `Remove row ${ri + 1} from page ${pi + 1}`,
              onclick: () => {
                page.rows.splice(ri, 1);
                rerender(`#addrow-p${pi}`);
              },
            },
            "Remove row",
          ),
        ),
        h("ul", { class: "edit-pics", role: "list" }, ...pics),
        row.pictures.length < LIMITS.pictures
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn-quiet btn-small",
                id: `add-p${pi}-r${ri}`,
                onclick: () => {
                  const pic: DraftPicture = { words: "" };
                  row.pictures.push(pic);
                  const ci = row.pictures.length - 1;
                  rerender();
                  openPicker(pic, () => rerender(`#p${pi}-r${ri}-c${ci}-words`));
                },
              },
              "Add a picture",
            )
          : h("p", { class: "hint", id: `add-p${pi}-r${ri}`, tabindex: "-1" }, `A row holds up to ${LIMITS.pictures} pictures.`),
      );
    });
    return h(
      "fieldset",
      { class: "edit-page", id: `p${pi}` },
      h("legend", {}, `Page ${pi + 1}`),
      ...rows,
      h(
        "div",
        { class: "edit-page-actions" },
        page.rows.length < LIMITS.rows
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn-quiet btn-small",
                id: `addrow-p${pi}`,
                onclick: () => {
                  page.rows.push({ pictures: [{ words: "" }, { words: "" }] });
                  rerender(`#p${pi}-r${page.rows.length - 1}-c0-pick`);
                },
              },
              "Add a row",
            )
          : h("p", { class: "hint", id: `addrow-p${pi}`, tabindex: "-1" }, `A page holds up to ${LIMITS.rows} rows.`),
        d.pages.length > 1
          ? h(
              "button",
              {
                type: "button",
                class: "link-btn",
                onclick: () => {
                  d.pages.splice(pi, 1);
                  rerender("#addpage");
                },
              },
              `Remove page ${pi + 1}`,
            )
          : null,
      ),
    );
  });

  function showErrors(errors: DraftError[]) {
    errorBox.hidden = false;
    errorBox.replaceChildren(
      h("h2", {}, errors.length === 1 ? "One thing to fix" : `${errors.length} things to fix`),
      h(
        "ul",
        {},
        ...errors.slice(0, 12).map((e) =>
          h(
            "li",
            {},
            h(
              "a",
              {
                href: `#/edit/${encodeURIComponent(id)}`,
                onclick: (ev: Event) => {
                  ev.preventDefault();
                  const target =
                    main.querySelector<HTMLElement>(`#${e.at}-words`) ??
                    main.querySelector<HTMLElement>(`#${e.at}-pick`) ??
                    main.querySelector<HTMLElement>(e.at === "title" ? "#title" : `#${e.at} button`);
                  target?.focus();
                },
              },
              e.message,
            ),
          ),
        ),
      ),
    );
    // Tie each error to its field, so screen readers hear it there too.
    main.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
    main.querySelectorAll(".field-error").forEach((el) => el.remove());
    main.querySelectorAll("[aria-invalid]").forEach((el) => {
      el.removeAttribute("aria-invalid");
      const ids = (el.getAttribute("aria-describedby") ?? "").split(" ").filter((x) => x && !x.startsWith("err-"));
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
      else el.removeAttribute("aria-describedby");
    });
    errors.forEach((e, i) => {
      const box = main.querySelector<HTMLElement>(e.at === "title" ? "#title-field" : `#${e.at}`);
      if (!box) return;
      box.classList.add("invalid");
      const errId = `err-${i}`;
      const msg = h("p", { class: "error field-error", id: errId }, e.message);
      const controls =
        e.at === "title"
          ? [main.querySelector<HTMLElement>("#title")]
          : [
              main.querySelector<HTMLElement>(`#${e.at}-pick`),
              main.querySelector<HTMLElement>(`#${e.at}-words`),
              main.querySelector<HTMLElement>(`#add-${e.at}`),
              main.querySelector<HTMLElement>(`#addrow-${e.at}`),
            ];
      for (const c of controls) {
        if (!c) continue;
        c.setAttribute("aria-invalid", "true");
        c.setAttribute("aria-describedby", `${c.getAttribute("aria-describedby") ?? ""} ${errId}`.trim());
      }
      box.append(msg);
    });
    errorBox.focus();
  }

  function onSave() {
    const r = checkDraft(d);
    if (!r.ok) return showErrors(r.errors);
    // Built from the current data on every attempt, so a retry after a failed save applies the edit again.
    const { next, message } = withSetSaved(data, id, r, `s-${Date.now().toString(36)}`);
    if (!commit(next)) {
      showErrors([
        {
          at: "save",
          message:
            "Not saved: this device is out of room for stories, or storage is blocked. Use emoji instead of some photos, or delete a story you don't need, then save again.",
        },
      ]);
      return;
    }
    draft = null;
    notice = message;
    go("#/stories");
  }

  function onDelete() {
    if (!existing) return;
    if (!confirm(`Delete “${existing.title}”? This can't be undone.`)) return;
    if (!commit(withSetDeleted(data, existing.id))) {
      showErrors([
        { at: "save", message: "Not deleted: this device's storage is full or blocked. Try again in a moment." },
      ]);
      return;
    }
    draft = null;
    notice = `Deleted “${existing.title}”.`;
    go("#/stories");
  }

  main.append(
    h(
      "header",
      { class: "top" },
      h(
        "a",
        {
          class: "btn btn-quiet btn-small",
          href: "#/stories",
          onclick: () => {
            draft = null;
          },
        },
        "Cancel",
      ),
    ),
    h("h1", { class: "title" }, existing ? "Change story" : "Make a story"),
    h(
      "p",
      { class: "lede" },
      "Each row is a few pictures your child writes about. Give every picture the word that lights it up. Other words that should count go after a comma.",
    ),
    errorBox,
    h(
      "div",
      { class: "field", id: "title-field" },
      h("label", { for: "title" }, "Story name"),
      title,
    ),
    h("p", { class: "hint", id: "words-hint" }, "Words: the first one is shown when your child taps the picture. Plurals count on their own (dog, dogs)."),
    ...pages,
    d.pages.length < LIMITS.pages
      ? h(
          "button",
          {
            type: "button",
            class: "btn btn-quiet",
            id: "addpage",
            onclick: () => {
              d.pages.push({ rows: [{ pictures: [{ words: "" }, { words: "" }] }] });
              rerender(`#p${d.pages.length - 1}-r0-c0-pick`);
            },
          },
          "Add a page",
        )
      : h("p", { class: "hint", id: "addpage", tabindex: "-1" }, `A story holds up to ${LIMITS.pages} pages.`),
    h(
      "div",
      { class: "actions" },
      h("button", { type: "button", class: "btn btn-go", onclick: onSave }, "Save story"),
      existing ? h("button", { type: "button", class: "btn btn-danger", onclick: onDelete }, "Delete story") : null,
    ),
    footer(),
  );
}

// ---------- Picture picker ----------

const picker = document.getElementById("picker") as HTMLDialogElement;
const photoInput = document.getElementById("photo-input") as HTMLInputElement;
const photoError = document.getElementById("photo-error")!;
const groups = document.getElementById("emoji-groups")!;

for (const g of EMOJI) {
  groups.append(
    h(
      "section",
      { class: "emoji-group" },
      h("h3", {}, g.group),
      h(
        "div",
        { class: "emoji-grid" },
        ...g.items.map(([emoji, word]) =>
          h(
            "button",
            {
              type: "button",
              class: "emoji-btn",
              "aria-label": word,
              title: word,
              onclick: () => {
                if (!pickerTarget) return;
                pickerTarget.emoji = emoji;
                delete pickerTarget.photo;
                if (!pickerTarget.words.trim()) pickerTarget.words = word;
                closePicker();
              },
            },
            h("span", { "aria-hidden": "true" }, emoji),
          ),
        ),
      ),
    ),
  );
}

document.getElementById("photo-btn")!.addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", async () => {
  const file = photoInput.files?.[0];
  photoInput.value = "";
  if (!file || !pickerTarget) return;
  photoError.textContent = "";
  try {
    pickerTarget.photo = await shrinkPhoto(file);
    delete pickerTarget.emoji;
    closePicker();
  } catch {
    photoError.textContent = "That file couldn't be opened as a picture. Try a JPG or PNG photo.";
  }
});

function openPicker(target: DraftPicture, then: () => void) {
  pickerTarget = target;
  afterPick = then;
  photoError.textContent = "";
  picker.showModal();
}

function closePicker() {
  picker.close();
}

// Picked or cancelled, redraw the editor and put focus back on that picture's word.
picker.addEventListener("close", () => {
  const then = afterPick;
  pickerTarget = null;
  afterPick = null;
  then?.();
});

// ---------- Start ----------

initSpeech(() => {
  // Voices can load after the page. Update what depends on having one.
  if (main.contains(document.getElementById("voice-note"))) refreshVoiceNote?.();
  const hash = location.hash.replace(/^#\/?/, "");
  if (hash === "story" && speakAllowed() && !document.getElementById("read-aloud")) {
    main.replaceChildren();
    renderStory();
  }
});
route();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is a bonus; the app works without it */
    });
  });
}
