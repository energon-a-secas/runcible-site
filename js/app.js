// Entry point. Reads storage, wires listeners, and hands the paint to the
// router. Everything else lives in a module: this file stays under 50 lines.

import { state, loadSaved, initSyncBridge } from './state.js';
import { render } from './render.js';
import { bindEvents } from './events.js';

function init() {
  loadSaved(state);
  document.documentElement.lang = state.prefs.lang;
  if (state.prefs.reduceMotion) document.documentElement.dataset.reduceMotion = 'on';
  // Before the first paint, so a merge that lands early has somewhere to
  // repaint. Dormant until a clerk-publishable-key meta is present (C7.2):
  // with no account it subscribes, reports signed out, and fetches nothing.
  initSyncBridge(render);
  bindEvents();
}

init();
