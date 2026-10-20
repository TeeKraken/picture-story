// Starter stories and the emoji a grown-up can pick from.

import type { Picture, StorySet } from "./story";

const p = (emoji: string, ...words: string[]): Picture => ({ emoji, words });

export const STARTERS: StorySet[] = [
  {
    id: "starter-farm",
    title: "A day on the farm",
    version: 1,
    pages: [
      {
        rows: [
          { pictures: [p("🐄", "cow"), p("🐖", "pig"), p("🚜", "tractor")] },
          { pictures: [p("🐔", "hen", "chicken"), p("🥚", "egg"), p("🧺", "basket")] },
          { pictures: [p("🐕", "dog", "puppy"), p("🐑", "sheep", "lamb"), p("🌧️", "rain", "rainy", "raining")] },
        ],
      },
      {
        rows: [
          { pictures: [p("🍎", "apple"), p("🌳", "tree"), p("🪜", "ladder")] },
          { pictures: [p("🐴", "horse", "pony"), p("🥕", "carrot")] },
          { pictures: [p("🌙", "moon"), p("🦉", "owl"), p("🛏️", "bed")] },
        ],
      },
    ],
  },
  {
    id: "starter-beach",
    title: "At the beach",
    version: 1,
    pages: [
      {
        rows: [
          { pictures: [p("☀️", "sun", "sunny"), p("🏖️", "beach", "sand"), p("🪣", "bucket", "pail")] },
          { pictures: [p("🦀", "crab"), p("🐚", "shell"), p("🌊", "wave", "sea", "ocean")] },
          { pictures: [p("🍦", "ice cream"), p("🕶️", "sunglasses")] },
        ],
      },
      {
        rows: [
          { pictures: [p("⛵", "boat", "sailboat"), p("🐬", "dolphin"), p("🐟", "fish")] },
          { pictures: [p("🏰", "castle", "sandcastle"), p("🚩", "flag")] },
          { pictures: [p("🌅", "sunset"), p("🏠", "home", "house")] },
        ],
      },
    ],
  },
  {
    id: "starter-space",
    title: "A trip to space",
    version: 1,
    pages: [
      {
        rows: [
          { pictures: [p("🚀", "rocket"), p("🧑‍🚀", "astronaut"), p("🌍", "earth", "world")] },
          { pictures: [p("⭐", "star"), p("🌙", "moon")] },
          { pictures: [p("👽", "alien"), p("🛸", "spaceship", "flying saucer", "ufo")] },
        ],
      },
      {
        rows: [
          { pictures: [p("🪐", "planet", "saturn"), p("☄️", "comet")] },
          { pictures: [p("🍕", "pizza"), p("🥤", "drink", "cup")] },
          { pictures: [p("🏠", "home", "house"), p("🛏️", "bed"), p("😴", "sleep", "asleep", "sleepy", "slept", "sleeping")] },
        ],
      },
    ],
  },
];

/** Emoji a grown-up can choose from, each with a suggested word. */
export const EMOJI: { group: string; items: [string, string][] }[] = [
  {
    group: "Animals",
    items: [
      ["🐶", "dog"], ["🐱", "cat"], ["🐭", "mouse"], ["🐰", "rabbit"], ["🦊", "fox"], ["🐻", "bear"],
      ["🐼", "panda"], ["🐯", "tiger"], ["🦁", "lion"], ["🐮", "cow"], ["🐷", "pig"], ["🐸", "frog"],
      ["🐵", "monkey"], ["🐔", "chicken"], ["🐧", "penguin"], ["🐦", "bird"], ["🦆", "duck"], ["🦉", "owl"],
      ["🐴", "horse"], ["🦄", "unicorn"], ["🐝", "bee"], ["🐛", "caterpillar"], ["🦋", "butterfly"], ["🐌", "snail"],
      ["🐢", "turtle"], ["🐍", "snake"], ["🐙", "octopus"], ["🦀", "crab"], ["🐟", "fish"], ["🐬", "dolphin"],
      ["🐳", "whale"], ["🦈", "shark"], ["🐘", "elephant"], ["🦒", "giraffe"], ["🦓", "zebra"], ["🦖", "dinosaur"],
      ["🐑", "sheep"], ["🐐", "goat"], ["🦔", "hedgehog"], ["🐿️", "squirrel"],
    ],
  },
  {
    group: "Food",
    items: [
      ["🍎", "apple"], ["🍌", "banana"], ["🍓", "strawberry"], ["🍇", "grapes"], ["🍉", "watermelon"], ["🍊", "orange"],
      ["🥕", "carrot"], ["🌽", "corn"], ["🥦", "broccoli"], ["🍞", "bread"], ["🧀", "cheese"], ["🥚", "egg"],
      ["🍕", "pizza"], ["🍔", "burger"], ["🍝", "spaghetti"], ["🥞", "pancake"], ["🍪", "cookie"], ["🎂", "cake"],
      ["🍦", "ice cream"], ["🍩", "doughnut"], ["🥛", "milk"], ["🍯", "honey"], ["🥪", "sandwich"], ["🍿", "popcorn"],
    ],
  },
  {
    group: "Things",
    items: [
      ["⚽", "ball"], ["🪁", "kite"], ["🧸", "teddy"], ["🎈", "balloon"], ["🎁", "present"], ["📚", "book"],
      ["✏️", "pencil"], ["🎨", "paint"], ["🎸", "guitar"], ["🥁", "drum"], ["🔑", "key"], ["🕰️", "clock"],
      ["☂️", "umbrella"], ["👑", "crown"], ["🎩", "hat"], ["👟", "shoe"], ["🧦", "sock"], ["🕶️", "sunglasses"],
      ["🪣", "bucket"], ["🧺", "basket"], ["🛏️", "bed"], ["🪑", "chair"], ["🚪", "door"], ["🗺️", "map"],
      ["💎", "jewel"], ["🪄", "wand"], ["🔦", "flashlight"], ["📮", "letter"],
    ],
  },
  {
    group: "Going places",
    items: [
      ["🚗", "car"], ["🚌", "bus"], ["🚂", "train"], ["🚲", "bike"], ["✈️", "plane"], ["🚀", "rocket"],
      ["⛵", "boat"], ["🚜", "tractor"], ["🚒", "fire engine"], ["🚑", "ambulance"], ["🛸", "spaceship"], ["🚁", "helicopter"],
      ["🏠", "house"], ["🏰", "castle"], ["🏫", "school"], ["⛺", "tent"], ["🏖️", "beach"], ["🏔️", "mountain"],
    ],
  },
  {
    group: "Nature and weather",
    items: [
      ["☀️", "sun"], ["🌙", "moon"], ["⭐", "star"], ["☁️", "cloud"], ["🌧️", "rain"], ["❄️", "snow"],
      ["⛄", "snowman"], ["🌈", "rainbow"], ["⚡", "lightning"], ["🌊", "wave"], ["🌳", "tree"], ["🌸", "flower"],
      ["🍄", "mushroom"], ["🍂", "leaf"], ["🌵", "cactus"], ["🔥", "fire"], ["🌍", "earth"], ["🪐", "planet"],
    ],
  },
  {
    group: "People and feelings",
    items: [
      ["👶", "baby"], ["👧", "girl"], ["👦", "boy"], ["👵", "grandma"], ["👴", "grandpa"], ["🧑‍🚀", "astronaut"],
      ["🧑‍🍳", "cook"], ["🧑‍🚒", "firefighter"], ["🧙", "wizard"], ["🧚", "fairy"], ["🤖", "robot"], ["👽", "alien"],
      ["👻", "ghost"], ["🏴‍☠️", "pirate"], ["😀", "happy"], ["😢", "sad"], ["😠", "angry"], ["😴", "sleep"],
      ["😱", "scared"], ["🤣", "laugh"],
    ],
  },
];
