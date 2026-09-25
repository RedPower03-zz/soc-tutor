// Saves progress in the browser's localStorage (stays on this device only).
import { createState, ensureState } from './engine.js';

const KEY = 'soc-tutor:v1';

export function loadState(content) {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return ensureState(JSON.parse(raw), content);
  } catch (err) {
    console.warn('Could not load saved progress, starting fresh.', err);
  }
  return createState(content);
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not save progress.', err);
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
