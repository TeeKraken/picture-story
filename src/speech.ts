// Speech that never leaves the device: only voices the browser marks as local
// (localService: true) are used. Some voices send text to an online service;
// those are never picked, and with no local voice the app stays text-only.

let voice: SpeechSynthesisVoice | null = null;
const listeners = new Set<() => void>();

function pick() {
  if (!("speechSynthesis" in window)) return;
  const local = speechSynthesis.getVoices().filter((v) => v.localService);
  const lang = (document.documentElement.lang || "en").toLowerCase();
  voice =
    local.find((v) => v.lang.toLowerCase().startsWith(lang) && v.default) ??
    local.find((v) => v.lang.toLowerCase().startsWith(lang)) ??
    null;
  listeners.forEach((fn) => fn());
}

export function initSpeech(onChange: () => void) {
  listeners.add(onChange);
  if (!("speechSynthesis" in window)) return;
  pick();
  speechSynthesis.addEventListener?.("voiceschanged", pick);
}

export function canSpeak(): boolean {
  return voice !== null;
}

/** Speaks text with the on-device voice. Does nothing without one. */
export function say(text: string, onEnd?: () => void): boolean {
  if (!voice) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.9;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}
