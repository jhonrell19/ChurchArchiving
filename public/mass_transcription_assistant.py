"""Transcribe a parish recording locally. Requires Python 3.11+ and faster-whisper."""
import argparse
import json
import re
from pathlib import Path


def draft(segments):
    parts = []
    length = 0
    for segment in segments:
        speech = segment.text.strip()
        if speech:
            length += len(speech) + bool(parts)
            if length > 500000:
                raise ValueError("Split the recording into shorter parts.")
            parts.append(speech)
    if not parts:
        raise ValueError("No speech detected.")
    transcript = ' '.join(parts)
    sentences = re.split(r'(?<=[.!?])\s+', transcript)
    return {'transcriptText': transcript, 'summaryText': ' '.join(sentences[:3])[:8000]}


def transcribe(recording, output, language, progress=print):
    if not recording.is_file() or output.exists():
        raise ValueError("Select an existing recording and a new output filename.")
    try:
        import av
        from faster_whisper import WhisperModel
    except ImportError as error:
        raise RuntimeError("Install the speech engine once: py -3.11 -m pip install faster-whisper==1.2.1 av==14.2.0") from error
    if av.__version__ != '14.2.0':
        raise RuntimeError("Install the tested audio decoder: py -3.11 -m pip install av==14.2.0")
    progress("Loading the base speech model…")
    try:
        model = WhisperModel('base', device='cpu', compute_type='int8', local_files_only=True)
    except (FileNotFoundError, OSError, ValueError):
        progress("Downloading the speech model for first use. Internet is required for this step.")
        model = WhisperModel('base', device='cpu', compute_type='int8')
    progress("Transcribing the recording on this computer…")
    segments, _ = model.transcribe(str(recording), language=None if language == 'auto' else language,
                                   vad_filter=True, beam_size=3)
    result = draft(segments)
    with output.open('x', encoding='utf-8') as target:
        json.dump(result, target, ensure_ascii=False)


def desktop():
    import tkinter as tk
    from tkinter import filedialog, messagebox
    from threading import Thread
    from queue import Queue, Empty
    root = tk.Tk()
    root.title("Parish transcription assistant")
    status = tk.StringVar(value="Choose a Mass recording to create a draft on this computer.")
    tk.Label(root, textvariable=status, wraplength=420, padx=18, pady=16).pack()
    events = Queue()

    def start():
        source = filedialog.askopenfilename(title="Choose a Mass audio or video recording")
        if not source:
            return
        output = filedialog.asksaveasfilename(title="Save a new transcript draft", defaultextension=".json",
                                               initialfile=Path(source).stem + "-draft.json")
        if not output:
            return
        button.config(state="disabled")
        def work():
            try:
                transcribe(Path(source), Path(output), 'auto', lambda msg: events.put(('progress', msg)))
                events.put(('done', 'Draft saved. Import it in Mass Recordings and review both fields.'))
            except Exception as error:
                events.put(('error', str(error)))
        Thread(target=work, daemon=True).start()
        root.after(150, poll)

    def poll():
        try:
            kind, message = events.get_nowait()
        except Empty:
            root.after(150, poll)
            return
        status.set(message)
        if kind == 'progress':
            root.after(150, poll)
        else:
            button.config(state="normal")
            if kind == 'error':
                messagebox.showerror("Transcription needs attention", message)
    button = tk.Button(root, text="Choose recording", command=start, padx=18, pady=6)
    button.pack(pady=(0, 18))
    root.mainloop()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recording', nargs='?', type=Path)
    parser.add_argument('output', nargs='?', type=Path)
    parser.add_argument('--language', choices=['auto', 'tl', 'en'], default='auto')
    args = parser.parse_args()
    if not args.recording and not args.output:
        desktop()
    elif args.recording and args.output:
        transcribe(args.recording, args.output, args.language)
    else:
        parser.error("Provide both recording and output paths.")


if __name__ == '__main__':
    main()
