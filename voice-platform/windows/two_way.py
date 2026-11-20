"""AAROHAN two-way Zoom interpreter prototype (Windows desktop).

Install: py -m pip install azure-cognitiveservices-speech sounddevice
List ports: py -m sounddevice
Set SPEECH_KEY and SPEECH_REGION locally for your Azure Speech resource.
Install/configure two independent virtual audio cables. In Zoom set the
speaker to cable A's playback port and the microphone to cable B's recording
port. Give this script A's recording port as --from-zoom and B's playback
port as --to-zoom. Specify your physical --mic and --headphones as well.
Example device numbers only:
py two_way.py --mic 1 --from-zoom 5 --to-zoom 8 --headphones 2
Use headphones; disable cable monitoring. Test in a private meeting first.
Both audio streams are sent to Azure while the interpreter is running.
The program does not save audio or transcripts. Azure usage charges may apply.
"""
import argparse
from contextlib import ExitStack
import os
import queue
import threading


def routes(args):
    return [
        ('Customer to headphones', args.from_zoom, args.headphones,
         'en-US', 'gu', 'gu-IN-DhwaniNeural'),
        ('Microphone to Zoom', args.mic, args.to_zoom,
         'gu-IN', 'en', 'en-US-JennyNeural'),
    ]


def start_route(stack, route, credentials, sdk, sd, stop, fail):
    name, source, destination, language, target, voice = route
    config = sdk.translation.SpeechTranslationConfig(**credentials)
    config.speech_recognition_language = language
    config.add_target_language(target)
    fmt = sdk.audio.AudioStreamFormat(samples_per_second=16000, bits_per_sample=16, channels=1)
    feed = sdk.audio.PushAudioInputStream(stream_format=fmt)
    stack.callback(feed.close)
    recognizer = sdk.translation.TranslationRecognizer(
        translation_config=config, audio_config=sdk.audio.AudioConfig(stream=feed))
    speech = sdk.SpeechConfig(**credentials)
    speech.speech_synthesis_voice_name = voice
    speech.set_speech_synthesis_output_format(
        sdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm)
    synthesizer = sdk.SpeechSynthesizer(speech_config=speech, audio_config=None)
    phrases = queue.Queue(maxsize=8)
    output = stack.enter_context(sd.RawOutputStream(
        device=destination, channels=1, samplerate=16000, dtype='int16'))

    def recognized(event):
        if stop.is_set() or event.result.reason != sdk.ResultReason.TranslatedSpeech:
            return
        text = event.result.translations.get(target)
        if text:
            try:
                phrases.put_nowait(text)
            except queue.Full:
                fail(name + ': playback cannot keep up. Pause and restart.')

    def playback():
        try:
            while not stop.is_set():
                try:
                    text = phrases.get(timeout=0.2)
                except queue.Empty:
                    continue
                result = synthesizer.speak_text_async(text).get()
                if result.reason != sdk.ResultReason.SynthesizingAudioCompleted:
                    raise RuntimeError('English or Gujarati speech synthesis failed')
                if not stop.is_set():
                    output.write(result.audio_data)
        except Exception as error:
            fail(name + ': ' + str(error))

    def capture(data, frames, timing, status):
        if stop.is_set():
            return
        try:
            if status.input_overflow:
                fail(name + ': input overflow. Check the selected audio device.')
            else:
                feed.write(bytes(data))
        except Exception as error:
            fail(name + ': ' + str(error))

    def cleanup_worker():
        stop.set()
        synthesizer.stop_speaking_async().get()
        worker.join()

    recognizer.recognized.connect(recognized)
    recognizer.canceled.connect(lambda event: fail(name + ': recognition stopped (' + str(event.reason) + ')'))
    worker = threading.Thread(target=playback, daemon=True)
    worker.start()
    stack.callback(cleanup_worker)
    recognizer.start_continuous_recognition_async().get()
    stack.callback(lambda: recognizer.stop_continuous_recognition_async().get())
    stack.enter_context(sd.RawInputStream(device=source, channels=1, samplerate=16000,
                                          dtype='int16', blocksize=1600, callback=capture))


def main():
    import azure.cognitiveservices.speech as sdk
    import sounddevice as sd
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for flag in ('mic', 'from-zoom', 'to-zoom', 'headphones'):
        parser.add_argument('--' + flag, required=True, type=int)
    args = parser.parse_args()
    ports = list(vars(args).values())
    if min(ports) < 0 or len(set(ports)) != 4:
        parser.error('Select four distinct input and output ports.')
    credentials = dict(subscription=os.getenv('SPEECH_KEY'), region=os.getenv('SPEECH_REGION'))
    if not all(credentials.values()):
        parser.error('Set SPEECH_KEY and SPEECH_REGION on this computer.')
    for _, source, destination, *_ in routes(args):
        sd.check_input_settings(device=source, channels=1, samplerate=16000, dtype='int16')
        sd.check_output_settings(device=destination, channels=1, samplerate=16000, dtype='int16')
    if input('Both speakers agree to send meeting speech to Azure for translation. Type START: ') != 'START':
        return
    stop = threading.Event()

    def fail(message):
        if not stop.is_set():
            print(message, flush=True)
            stop.set()

    with ExitStack() as stack:
        try:
            for route in routes(args):
                start_route(stack, route, credentials, sdk, sd, stop, fail)
            print('Interpreter running. Pause between sentences. Press Ctrl+C to end.')
            while not stop.wait(0.3):
                pass
        except KeyboardInterrupt:
            pass
        finally:
            stop.set()


if __name__ == '__main__':
    main()
