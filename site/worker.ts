/// <reference lib="webworker" />
import { readDocx, type DocxDocument } from './docx.js';
import { run, runDocx, type ConvertRequest } from './engine.js';

export type WorkerRequest =
  | ({ type: 'text' } & ConvertRequest)
  | ({ type: 'docx' } & Omit<ConvertRequest, 'text'>)
  | { type: 'docx-load'; id: number; buffer: ArrayBuffer }
  | { type: 'docx-close' };

// The open Word document stays here so changing the direction does not resend the file.
let doc: DocxDocument | undefined;

// Conversion runs here so long documents never freeze the page.
self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'text') {
      self.postMessage({ type: 'result', ...run(request) });
    } else if (request.type === 'docx-load') {
      doc = readDocx(request.buffer);
      self.postMessage({ type: 'docx-loaded', id: request.id, text: doc.text });
    } else if (request.type === 'docx-close') {
      doc = undefined;
    } else if (doc) {
      const result = runDocx(doc, request);
      self.postMessage({ type: 'result', ...result }, [result.bytes.buffer]);
    }
  } catch (error) {
    const id = 'id' in request ? request.id : 0;
    self.postMessage({ type: 'error', id, message: String(error) });
  }
});
