# AAROHAN local narration prototype

Status: source scaffold only. Neural model inference has not been executed or benchmarked. This is a third-party pretrained model, not a proprietary AAROHAN model. No hosted service, public API, background job, or new subscription is enabled.

Model: [AI4Bharat Indic Parler-TTS](https://huggingface.co/ai4bharat/indic-parler-tts), Apache-2.0 as stated on the model card. Review and accept the model access conditions yourself before downloading; do not publish access tokens. The 0.9B parameter model needs adequate memory and storage; a GPU is helpful. CPU inference may be slow. Dependencies and compatible versions must be verified in a local virtual environment before production use. Follow the official installation instructions on the model card.

## Proposed local workflow

1. Export a TXT narration script from Business Ambassador.
2. Once the model and dependencies are installed locally following their official documentation, run:
   `python generate.py --language gu --script narration.txt --output narration.wav`
3. Listen to the WAV and confirm pronunciation and duration. Use only public service descriptions, not customer or confidential data.
4. Select that WAV in the Ambassador Video Studio and export. The current browser exporter accepts 3–30 seconds. A longer recording must be shortened or regenerated.
5. Repeat with `hi` or `en` if needed. The predefined speaker names are model presets, not recordings of the company owner.

The script does not expose a network listener or upload text. Initial model/dependency downloads need network access. Model access and compute may incur costs depending on the environment; no paid provider has been set up. Real audio quality, speed, commercial deployment requirements and browser export remain unverified.
