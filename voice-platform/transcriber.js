import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;

// A single cached model keeps mobile WASM memory bounded. Never reuse Tiny
// when the user explicitly switches to the more accurate Small model.
let ready = null;
let loadedModel = null;
let queued = Promise.resolve();

async function transcribeMessage(data) {
  try {
    const requestedModel = data.model === 'small' ? 'small' : 'tiny';
    if (!ready || loadedModel !== requestedModel) {
      loadedModel = requestedModel;
      const larger = requestedModel === 'small';
      ready = pipeline('automatic-speech-recognition',
        larger ? 'Xenova/whisper-small' : 'Xenova/whisper-tiny', {
          device: 'wasm',
          dtype: 'q8',
          revision: larger ? '5cfd31acdccf24bc3731005c0e9cabae434f21c8'
                           : '5332fcc35e32a33b86612b9a57a89be7906102b1',
          progress_callback: progress => {
            if (progress.status === 'initiate') self.postMessage({ type: 'loading' });
          },
        });
    }

    const transcribe = await ready;
    self.postMessage({ type: 'processing' });
    const result = await transcribe(data.samples, {
      language: data.language, task: data.task,
    });
    self.postMessage({ type: 'complete', text: result.text.trim() });
  } catch {
    // A failed model download/inference must not strand future recordings.
    ready = null;
    loadedModel = null;
    self.postMessage({ type: 'error' });
  }
}

// Browser workers receive events while prior model downloads are in flight.
// Process in order to avoid a later recording changing the cached model under
// an earlier one and delivering results in the wrong order.
self.addEventListener('message', ({ data }) => {
  queued = queued.then(() => transcribeMessage(data))
    .catch(() => self.postMessage({ type: 'error' }));
});
