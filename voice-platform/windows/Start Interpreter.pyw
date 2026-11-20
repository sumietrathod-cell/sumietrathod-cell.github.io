"""Double-click on Windows after installing the dependencies listed in two_way.py."""
from array import array
import math
import os
from pathlib import Path
import subprocess
import sys
import tkinter as tk
from tkinter import messagebox, ttk


def main():
    root = tk.Tk()
    root.title("AAROHAN • Zoom interpreter")
    frame = ttk.Frame(root, padding=16)
    frame.pack(fill="both", expand=True)
    try:
        import sounddevice as sd
        devices = sd.query_devices()
        hosts = sd.query_hostapis()
    except Exception as error:
        messagebox.showerror("Setup required", f"Install the dependencies listed in two_way.py and connect your audio devices.\n\n{error}")
        root.destroy()
        return

    ttk.Label(frame, text="Choose where each speaker is heard", font=("Segoe UI", 14)).pack(anchor="w")
    fields = {}
    for flag, label, direction in (
        ("mic", "Your physical microphone • Gujarati input", "input"),
        ("from-zoom", "Cable A recording port • customer English from Zoom", "input"),
        ("to-zoom", "Cable B playback port • translated English to Zoom", "output"),
        ("headphones", "Your headphones • translated Gujarati", "output"),
    ):
        ttk.Label(frame, text=label).pack(anchor="w", pady=(10, 2))
        choices = {f"{i} • {device['name']} ({hosts[device['hostapi']]['name']})": i
                   for i, device in enumerate(devices) if device[f"max_{direction}_channels"] > 0}
        box = ttk.Combobox(frame, state="readonly", width=70, values=list(choices))
        box.pack(fill="x")
        fields[flag] = (box, choices)

    ttk.Label(frame, text="In Zoom, select Cable A for Speaker and Cable B for Microphone.").pack(anchor="w", pady=10)

    def test_output(flag, pulses):
        box, choices = fields[flag]
        device = choices.get(box.get())
        if device is None:
            messagebox.showinfo("Audio test", "Select the output device first.")
            return
        rate = 16000
        beep = array("h", (int(3500 * math.sin(2 * math.pi * 660 * i / rate)
                               * min(1, i / 100, (3999 - i) / 100)) for i in range(4000)))
        silence = bytes(3200)
        try:
            with sd.RawOutputStream(device=device, samplerate=rate, channels=1, dtype="int16") as stream:
                stream.write(silence.join([beep.tobytes()] * pulses))
        except Exception as error:
            messagebox.showerror("Audio test failed", str(error))

    checks = ttk.Frame(frame)
    checks.pack(anchor="w")
    ttk.Button(checks, text="Test my headphones (1 beep)",
               command=lambda: test_output("headphones", 1)).pack(side="left")
    ttk.Button(checks, text="Test Zoom microphone (2 beeps)",
               command=lambda: test_output("to-zoom", 2)).pack(side="left")

    def start():
        try:
            import azure.cognitiveservices.speech
        except ImportError:
            messagebox.showerror("Setup required", "Install azure-cognitiveservices-speech to run translation.")
            return
        args = []
        selected = set()
        for flag, (box, choices) in fields.items():
            index = choices.get(box.get())
            if index is None or index in selected:
                messagebox.showerror("Audio setup", "Choose four distinct audio ports.")
                return
            selected.add(index)
            args.extend(["--" + flag, str(index)])
        if not all(os.getenv(key) for key in ("SPEECH_KEY", "SPEECH_REGION")):
            messagebox.showerror("Azure setup required", "Set SPEECH_KEY and SPEECH_REGION on this PC, then reopen the launcher.")
            return
        interpreter = Path(__file__).with_name("two_way.py")
        python = Path(sys.executable).with_name("python.exe")
        try:
            if not interpreter.is_file():
                raise FileNotFoundError("Keep this launcher and two_way.py in the same folder.")
            subprocess.Popen([str(python), "-i", str(interpreter), *args],
                             creationflags=subprocess.CREATE_NEW_CONSOLE)
        except OSError as error:
            messagebox.showerror("Could not start", str(error))
            return
        root.destroy()

    ttk.Button(frame, text="Open interpreter", command=start).pack(anchor="e")
    root.mainloop()


if __name__ == "__main__":
    main()
