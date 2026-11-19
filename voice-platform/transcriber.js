import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
let ready;

self.addEventListener('message', async ({ data }) => {
  try {
    const larger = data.model === 'small';
    const modelId = larger ? 'Xenova/whisper-small' : 'Xenova/whisper-tiny';
    ready ??= pipeline('automatic-speech-recognition', modelId, {
      device: 'wasm', dtype: 'q8', revision: larger ? '5cfd31acdccf24bc3731005c0e9cabae434f21c8' : '5332fcc35e32a33b86612b9a57a89be7906102b1',
      progress_callback: progress => {
        if (progress.status === 'initiate') self.postMessage({ type: 'loading' });
      },
    });
    const transcribe = await ready;
    self.postMessage({ type: 'processing' });
    const result = await transcribe(data.samples, { language: data.language, task: data.task });
    self.postMessage({ type: 'complete', text: result.text.trim() });
  } catch {
    ready = undefined;
    self.postMessage({ type: 'error' });
  }
});
