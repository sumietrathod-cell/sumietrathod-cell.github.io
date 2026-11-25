"""Local narration prototype using AI4Bharat Indic Parler-TTS.
No web server, no credentials in source, no voice cloning.
Model access conditions must be accepted separately.
"""
import argparse
import importlib.util
from pathlib import Path

MODEL = "ai4bharat/indic-parler-tts"
SPEAKERS = {"gu": "Yash", "hi": "Rohit", "en": "Thoma"}

def validate(text, language):
    text = text.strip()
    if language not in SPEAKERS or not text or len(text) > 500:
        raise ValueError("Choose gu, hi or en and provide 1–500 characters.")
    return text

DEPENDENCIES = ("torch", "soundfile", "numpy", "parler_tts", "transformers")

def missing_dependencies():
    return [name for name in DEPENDENCIES if importlib.util.find_spec(name) is None]

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--language", choices=SPEAKERS)
    p.add_argument("--script", type=Path)
    p.add_argument("--output", type=Path)
    p.add_argument("--check", action="store_true", help="Check dependency presence without downloading or generating audio.")
    p.add_argument("--allow-download", action="store_true", help="Allow model downloads only after reviewing and accepting access conditions.")
    args = p.parse_args()
    missing = missing_dependencies()
    if args.check:
        print("Missing dependencies: " + (", ".join(missing) if missing else "none detected"))
        print("Model weights and tokenizer availability, compatibility and inference are not tested by this check.")
        return 1 if missing else 0
    if not all((args.language, args.script, args.output)):
        p.error("Provide --language, --script and --output, or use --check.")
    if missing:
        p.error("Missing dependencies: " + ", ".join(missing))
    offline = not args.allow_download
    if args.output.suffix.lower() != ".wav" or args.output.exists():
        p.error("Choose a new WAV output file; existing files are never overwritten.")
    text = validate(args.script.read_text(encoding="utf-8-sig"), args.language)
    import torch
    import numpy as np
    import soundfile as sf
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL, local_files_only=offline).to(device).eval()
    tokenizer = AutoTokenizer.from_pretrained(MODEL, local_files_only=offline)
    style_tokenizer = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path, local_files_only=offline)
    style = (f"{SPEAKERS[args.language]} speaks clearly in a professional, "
             "moderately paced and friendly narration. Very clear audio.")
    description = style_tokenizer(style, return_tensors="pt").to(device)
    prompt = tokenizer(text, return_tensors="pt").to(device)
    with torch.inference_mode():
        generated = model.generate(input_ids=description.input_ids,
            attention_mask=description.attention_mask,
            prompt_input_ids=prompt.input_ids,
            prompt_attention_mask=prompt.attention_mask)
    audio = generated.cpu().float().numpy().squeeze()
    rate = model.config.sampling_rate
    if audio.ndim != 1 or audio.size == 0 or not np.isfinite(audio).all() or rate <= 0:
        raise ValueError("Generated audio is invalid; no file was saved.")
    if not 3 <= audio.size / rate <= 30:
        raise ValueError("Narration duration must be 3–30 seconds for Video Studio. Adjust the script and retry.")
    if not np.any(audio):
        raise ValueError("Generated audio is silent; no file was saved.")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive create preserves existing files. Remove only this attempt's partial output on write failure.
    target = args.output.open("xb")
    try:
        with target:
            sf.write(target, audio, rate, format="WAV", subtype="PCM_16")
    except BaseException:
        args.output.unlink(missing_ok=True)
        raise
    print(f"Saved {args.output}; duration {audio.size/model.config.sampling_rate:.1f}s")
    print("Review the audio before using it in a promotional video.")

if __name__ == "__main__":
    raise SystemExit(main())
