/// <reference lib="webworker" />
import { run, type ConvertRequest } from './engine.js';

// Conversion runs here so long documents never freeze the page.
self.addEventListener('message', (event: MessageEvent<ConvertRequest>) => {
  self.postMessage(run(event.data));
});
