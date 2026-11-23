# AAROHAN Voice Platform and Remote Voice Agent Manager

## First release

- `index.html` accepts a microphone recording or short audio file, runs multilingual speech recognition and optional English translation in a dedicated browser Worker, and downloads the transcript. The system synthesizes speech using installed device voices, when supported.
- The browser agent is a scripted, configurable test. Its managed mode loads a specific deployment's configuration before each test. It transmits basic activity event types to Supabase. The visitor's text, transcript and audio are not sent to the manager.
- `remote.html` lets the owner create, update, assign, enable and disable browser deployments and see recent activity. An operator can access an enabled deployment assigned to their Supabase Auth user ID. Admin access uses the existing Campaign Manager role.
- Apply `supabase/migrations/20261119001000_voice_deployments.sql` to the dedicated Campaign Manager Supabase project before publishing. In a live verification, sign in as Admin, create a temporary deployment, connect it from the Voice Platform, test a reply, and confirm the activity and disable flow. Verify microphone permission, transcription and device voices with sample audio on mobile and desktop.

## Worker model selection regression (draft QA)

- `transcriber.js` tracks the **selected Whisper model size** alongside the cached pipeline. Direct Worker requests asking for `small` cannot accidentally reuse an earlier `tiny` pipeline, and a failed download resets the cache for retry.
- Pending Worker messages are serialized to avoid an in-flight model download swapping state for an earlier request. The existing Studio UI also terminates/recreates its Worker on model selection changes; this Worker-level guard is additional protection.
- Run `node --test voice-platform/tests/transcriber-model.test.mjs` on Node.js 22. Tests inject fake pinned Whisper pipelines and **synthetic audio arrays** without loading models, recording a microphone or making external calls. They verify Tiny/Small revisions, repeated-model reuse, fallback to Tiny for unknown model strings, load recovery, FIFO order and Gujarati translation task propagation.
- These checks do **not** prove Gujarati transcription quality, natural voice output, recording permissions, real model memory usage, Zoom microphone integration, or phone-call translation. Those still need authorized device/hardware testing.

## Dependencies

- Transformers.js 3.8.1 is loaded from jsDelivr in the transcription Worker. [Source and license](https://github.com/huggingface/transformers.js/tree/3.8.1)
- The Worker retrieves the [Xenova Whisper Tiny ONNX model](https://huggingface.co/Xenova/whisper-tiny/tree/5332fcc35e32a33b86612b9a57a89be7906102b1) at a pinned revision. The conversion's model repository lists Apache 2.0. The [underlying OpenAI Whisper model](https://github.com/openai/whisper/blob/main/LICENSE) uses MIT.
- The first transcription needs network access for the inference library and model files. Browsers may restrict microphone access to HTTPS and select different installed TTS voices. Browser audio conversion and local speech recognition performance vary by device and language.
- The dashboard cannot manage an arbitrary account or telephony service. Each managed runtime must be configured in AAROHAN and authorized to access its assigned deployment.

## Production roadmap

1. Add self-hosted speech inference, audio exports, a shared voice library and language quality benchmarks.
2. Add consent-managed custom voices, dubbing and audio cleanup with clear asset provenance.
3. Add knowledge-backed conversation, workflows, human transfer and authorized tool actions.
4. Connect telephony and messaging providers for inbound and outbound campaigns with separate consent and delivery controls.
5. Add durable session metrics, operational alerts, quotas, API access and billing.
