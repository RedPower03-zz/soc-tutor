// Inline SVG icons (stroke style, 24x24, inherit the current text colour).
const PATHS = {
  shield: '<path d="M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  host: '<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4M6.5 8h4"/>',
  network: '<rect x="9" y="2.5" width="6" height="5"/><rect x="2.5" y="16.5" width="6" height="5"/><rect x="15.5" y="16.5" width="6" height="5"/><path d="M12 7.5V12M5.5 16.5V12h13v4.5"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6.4-6.4"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  review: '<path d="M3.5 11a8.5 8.5 0 0 1 14.6-5.2L20.5 8"/><path d="M20.5 3v5h-5"/><path d="M20.5 13a8.5 8.5 0 0 1-14.6 5.2L3.5 16"/><path d="M3.5 21v-5h5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  alert: '<path d="M12 3 2 20.5h20z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  ret: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>',
  terminal: '<rect x="3" y="4" width="18" height="16"/><path d="m7 9 3 3-3 3M13 15h4"/>',
  reset: '<path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3L3.5 8"/><path d="M3.5 3v5h5"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  play: '<path d="M7 4.5 19 12 7 19.5z"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" focusable="false">${PATHS[name] || ''}</svg>`;
}
