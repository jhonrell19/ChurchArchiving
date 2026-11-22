"""Transcribe a parish recording locally. Requires Python 3.11+ and faster-whisper."""
import argparse
import json
import re
from pathlib import Path



from collections import Counter

# Common fillers in Tagalog and English, not a translation dictionary.
_STOP = set("""
ang ng mga sa na at ay ito itong siya sila siya kami tayo namin natin
ako ikaw ka ko mo po opo naman rin din kasi lang para kung pero kaya
isang isang mga may wala bilang doon dito kanilang kanyang inyong
the a an and or of to from in on with for is are was were be it this
that these those we you he she they our your their so because have has
had as not then there here can could would should will said
""".split())


def ranked_summary(transcript, max_sentences=4):
    """Offline extractive summary that considers the whole Tagalog/English homily.

    No hallucinated facts: each line is copied from the transcript. This
    is a staff-review draft, not an official summary of a sermon.
    """
    clean = re.sub(r"\\s+", " ", transcript or "").strip()
    if not clean:
        return ""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\\s+", clean) if s.strip()]
    # Whisper sometimes omits punctuation in a long recording. Use roughly
    # 55-word windows so the summary does not become the complete transcript.
    if len(sentences) < 2 and len(clean.split()) > 100:
        words = clean.split()
        sentences = [" ".join(words[i:i + 55]) for i in range(0, len(words), 55)]
    if len(sentences) <= max_sentences:
        return " ".join(sentences)[:8000]

    def terms(sentence):
        return [word.casefold() for word in re.findall(r"[^\\W\\d_]{3,}", sentence)
                if word.casefold() not in _STOP]

    frequency = Counter(word for sentence in sentences for word in terms(sentence))
    scored = []
    for i, sentence in enumerate(sentences):
        tokens = terms(sentence)
        # Unique term coverage resists repetitive prayers dominating every slot.
        score = sum(min(frequency[t], 6) for t in set(tokens)) / max(len(tokens), 1) ** 0.5
        scored.append((score, i))
    selected = []
    for _, i in sorted(scored, key=lambda row: (-row[0], row[1])):
        current = set(terms(sentences[i]))
        if any(len(current & set(terms(sentences[j]))) /
               max(len(current | set(terms(sentences[j]))), 1) > .72 for j in selected):
            continue
        selected.append(i)
        if len(selected) == max_sentences:
            break
    # Include a salient point from the second half, rather than always
    # reproducing only the opening passages of a long Mass.
    if len(sentences) >= 6 and selected and all(i < len(sentences)//2 for i in selected):
        late = max((row for row in scored if row[1] >= len(sentences)//2),
                   default=None)
        if late and late[0] > 0:
            selected[-1] = late[1]
    if not selected:
        selected = list(range(min(max_sentences, len(sentences))))
    return " ".join(sentences[i] for i in sorted(set(selected)))[:8000]


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
    transcript = " ".join(parts)
    return {'transcriptText': transcript, 'summaryText': ranked_summary(transcript)}

def transcribe(recording, output, language, progress=print, model_size='base', beam_size=5):
    if not recording.is_file() or output.exists():
        raise ValueError("Select an existing recording and a new output filename.")
    try:
        import av
        from faster_whisper import WhisperModel
    except ImportError as error:
        raise RuntimeError("Install the speech engine once: py -3.11 -m pip install faster-whisper==1.2.1 av==14.2.0") from error
    if av.__version__ != '14.2.0':
        raise RuntimeError("Install the tested audio decoder: py -3.11 -m pip install av==14.2.0")
    progress("Loading the " + model_size + " speech model…")
    try:
        model = WhisperModel(model_size, device='cpu', compute_type='int8', local_files_only=True)
    except (FileNotFoundError, OSError, ValueError):
        progress("Downloading the speech model for first use. Internet is required for this step.")
        model = WhisperModel(model_size, device='cpu', compute_type='int8')
    progress("Transcribing the recording on this computer…")
    segments, _ = model.transcribe(str(recording), language=None if language == 'auto' else language,
                                   vad_filter=True, beam_size=beam_size, condition_on_previous_text=False)
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
    model_choice = tk.StringVar(value="base")
    tk.Label(root, text="Speech model: base = faster; small = usually more accurate").pack()
    tk.OptionMenu(root, model_choice, "base", "small", "medium").pack()

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
                transcribe(Path(source), Path(output), 'auto', lambda msg: events.put(('progress', msg)), model_choice.get())
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
    parser.add_argument('--model', choices=['base','small','medium'], default='base')
    parser.add_argument('--beam-size', type=int, choices=range(1,9), default=5)
    args = parser.parse_args()
    if not args.recording and not args.output:
        desktop()
    elif args.recording and args.output:
        transcribe(args.recording, args.output, args.language, model_size=args.model, beam_size=args.beam_size)
    else:
        parser.error("Provide both recording and output paths.")


if __name__ == '__main__':
    main()
