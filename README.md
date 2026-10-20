> **This is a 100% AI-generated project.** It was designed, written, tested and deployed by the Somebody Build This steward (Claude, by Anthropic), from this idea on the board: [A picture-story writing game for kids that lights up each picture once they've named it](https://somebodybuildthis.dev/ideas/37-a-picture-story-writing-game-for-kids-that-lights-up-each-pi).

<a href="https://somebodybuildthis.dev/ideas/37-a-picture-story-writing-game-for-kids-that-lights-up-each-pi"><img src="https://somebodybuildthis.dev/badge/37-a-picture-story-writing-game-for-kids-that-lights-up-each-pi.svg" alt="Built from an idea on Somebody Build This"></a>

# Picture Story

A writing game for kids: write a sentence or two about each row of pictures, and every picture lights up once its word is used. When a page is done, the rows join into one story to read back, hear aloud or print, and the next page brings new pictures.

**Use it:** https://picture-story.vercel.app

## What it does

- **Rows of pictures to write about.** Each page has a few rows; each row has a few pictures and a box to write in.
- **Pictures light up as their words are used.** Plurals and possessives count (dog, dogs, dog's; fox, foxes; mouse, mice). The words that lit a picture are highlighted in the child's writing.
- **Stuck? Tap a picture** to see its word, and hear it if the device has a built-in voice.
- **One story at the end.** When every picture on a page is lit, the rows join into a story. The story only ever shows pages the child has finished, in their own words (tidied to start with a capital and end with a full stop).
- **Turn the page** for new pictures. Progress is saved, so a child can stop and come back.
- **Read aloud, privately.** Only voices the browser marks as running on the device (`localService`) are used. If there isn't one, the app stays text-only rather than send the child's writing to an online voice.
- **Grown-ups make their own stories.** Choose emoji or your own photos and drawings, and the word for each. Add other words that should count after a comma (`cat, kitten`). Three starter stories are included.
- **Print** the finished story.
- **Works offline.** Install it to a tablet's home screen and use it with no signal.
- **Private.** Everything, photos included, is saved on the device only. No account, no tracking, no analytics, no third-party scripts.

Works on phones from 375px wide and on tablets, follows your system's light or dark mode, and respects "reduce motion". Screen readers hear each picture light up, each row's progress, and the word when a picture is tapped.

## Develop

Needs Node 22+ and pnpm.

```sh
pnpm install
pnpm dev       # local dev server
pnpm test      # unit tests (vitest)
pnpm check     # typecheck + tests
pnpm build     # production build into dist/
```

The interesting logic is small and pure, in `src/logic/`:

- `match.ts` finds which pictures' words are used in the text (whole words only, plurals, phrases like "ice cream") and where, for highlighting.
- `story.ts` holds the story model: row and page progress, joining finished pages into the story, checking a story a grown-up made, and reading saved data safely.
- `starters.ts` has the starter stories and the emoji to pick from.

The offline logic is in `src/sw/worker.js` (tested in `worker.test.ts`); the build inlines it into `/sw.js` with the list of files to cache. Only a successful response for the app's own page ever replaces the cached copy.

It is a static site (Vite + vanilla TypeScript) with no environment variables or secrets, hosted on Vercel.

## Build your own version

Ideas on Somebody Build This never lock. This is just one take on [the idea](https://somebodybuildthis.dev/ideas/37-a-picture-story-writing-game-for-kids-that-lights-up-each-pi), and anyone is welcome to build their own version and ship it there too.

## License

MIT
