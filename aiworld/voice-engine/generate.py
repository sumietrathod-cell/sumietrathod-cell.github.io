"""Local narration prototype using AI4Bharat Indic Parler-TTS.
No web server, no credentials in source, no voice cloning.
Model access conditions must be accepted separately.
"""
import argparse
from pathlib import Path

MODEL = "ai4bharat/indic-parler-tts"
SPEAKERS = {"gu": "Yash", "hi": "Rohit", "en": "Thoma"}

def validate(text, language):
    text = text.strip()
    if language not in SPEAKERS or not text or len(text) > 500:
        raise ValueError("Choose gu, hi or en and provide 1–500 characters.")
    return text

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--language", choices=SPEAKERS, required=True)
    p.add_argument("--script", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    if args.output.suffix.lower() != ".wav" or args.output.exists():
        p.error("Choose a new WAV output file; existing files are never overwritten.")
    text = validate(args.script.read_text(encoding="utf-8-sig"), args.language)
    import torch
    import soundfile as sf
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL).to(device).eval()
    tokenizer = AutoTokenizer.from_pretrained(MODEL)
    style_tokenizer = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
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
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("xb") as target:
        sf.write(target, audio, model.config.sampling_rate, format="WAV")
    print(f"Saved {args.output}; duration {audio.size/model.config.sampling_rate:.1f}s")
    print("Review the audio before using it in a promotional video.")

if __name__ == "__main__":
    main()
