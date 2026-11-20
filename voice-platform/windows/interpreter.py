"""AAROHAN one-way meeting interpreter for Windows.

Install Python 3.11+, then: py -m pip install faster-whisper sounddevice soundfile numpy
List devices: py interpreter.py --devices
Run: py interpreter.py --mic 1 --output 4
Use your physical mic for --mic. Use a virtual cable playback endpoint for
--output and its paired recording endpoint as the meeting app microphone.
Keep the meeting speaker on headphones. For a local rehearsal use headphones
as --output. Device numbers above are examples; list your own first.
Requires Windows PowerShell, an installed English Windows voice, and internet
for the first model download. Subsequent inference and speech run locally.
"""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile
import time

SPEAK = r"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $v = $s.GetInstalledVoices() | Where-Object {
        $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'en'
    } | Select-Object -First 1
    if (-not $v) { throw 'Install an English Windows voice first.' }
    $s.SelectVoice($v.VoiceInfo.Name)
    $s.SetOutputToWaveFile($env:AAROHAN_WAVE_PATH)
    $s.Speak([IO.File]::ReadAllText($env:AAROHAN_TEXT_PATH))
} finally { $s.Dispose() }
"""


def speak(text, output, sd, sf):
    with tempfile.TemporaryDirectory() as directory:
        script = Path(directory) / 'phrase.txt'
        wave = Path(directory) / 'speech.wav'
        script.write_text(text, encoding='utf-8')
        subprocess.run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', SPEAK],
                       env=dict(os.environ, AAROHAN_TEXT_PATH=str(script),
                                AAROHAN_WAVE_PATH=str(wave)), check=True, timeout=120)
        samples, rate = sf.read(wave, dtype='float32')
        sd.play(samples, rate, device=output, blocking=True)


def main():
    import numpy as np
    import sounddevice as sd
    import soundfile as sf
    from faster_whisper import WhisperModel

    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--devices', action='store_true')
    parser.add_argument('--mic', type=int)
    parser.add_argument('--output', type=int)
    args = parser.parse_args()
    if args.devices:
        print(sd.query_devices())
        return
    if os.name != 'nt':
        parser.error('This prototype uses Windows speech synthesis.')
    if args.mic is None or args.output is None:
        parser.error('Choose --mic and --output using --devices.')
    if min(args.mic, args.output) < 0:
        parser.error('Specify explicit non-negative device numbers.')
    sd.check_input_settings(device=args.mic, channels=1, dtype='float32', samplerate=16000)
    if sd.query_devices(args.output)['max_output_channels'] < 1:
        parser.error('Choose a playback device for --output.')
    print('Loading the multilingual large-v3 model. The first download can take time.')
    model = WhisperModel('large-v3', device='cpu', compute_type='int8')
    while input('Enter to record a phrase, or q to quit: ').strip().lower() != 'q':
        audio = sd.rec(30 * 16000, samplerate=16000, channels=1, dtype='float32', device=args.mic)
        start = time.monotonic()
        try:
            input('Speak Gujarati. Press Enter to finish (30 second limit). ')
        finally:
            sd.stop()
        length = min(len(audio), int((time.monotonic() - start) * 16000))
        phrase = np.ascontiguousarray(audio[:length, 0])
        if not phrase.size or np.max(np.abs(phrase)) < 0.001:
            print('No usable audio. Check the selected microphone.')
            continue
        segments, _ = model.transcribe(phrase, language='gu', task='translate',
                                       vad_filter=True, condition_on_previous_text=False)
        english = ' '.join(segment.text.strip() for segment in segments).strip()
        if not english:
            print('No speech recognized. Try again.')
            continue
        print('English:', english)
        choice = input('Enter to speak, e to edit, anything else to discard: ').strip().lower()
        if choice == 'e':
            english = input('English to speak: ').strip()
        if choice in ('', 'e') and english:
            speak(english, args.output, sd, sf)


if __name__ == '__main__':
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        pass
