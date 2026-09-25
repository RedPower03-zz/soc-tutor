// Saves progress in the browser's localStorage (stays on this device only).
import { createState } from './engine.js';
import { migrateState } from './migrate.js';

const KEY = 'soc-tutor:v1'; // storage slot name; the state itself carries its version number

export function newState(content) {
  return migrateState(createState(content), content);
}

export function loadState(content) {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrateState(JSON.parse(raw), content);
  } catch (err) {
    console.warn('Could not load saved progress, starting fresh.', err);
  }
  return newState(content);
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
