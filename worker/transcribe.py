"""Create a reviewable draft on a staff computer, outside the parish web service."""
import argparse
import json
from pathlib import Path
import re


def draft(segments):
    transcript = ' '.join(segment.text.strip() for segment in segments if segment.text.strip())
    if not transcript:
        raise ValueError("No speech detected.")
    if len(transcript) > 500000:
        raise ValueError("Split the recording into shorter parts.")
    sentences = re.split(r'(?<=[.!?])\s+', transcript)
    return {'transcriptText': transcript, 'summaryText': ' '.join(sentences[:3])[:8000]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('recording', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--language', choices=['auto','tl','en'], default='auto')
    parser.add_argument('--model', choices=['base','small','medium'], default='base',
                        help='Larger models may improve recognition but require more RAM and time.')
    parser.add_argument('--beam-size', type=int, choices=range(1, 9), metavar='{1..8}', default=3)
    args = parser.parse_args()
    if not args.recording.is_file() or args.output.exists():
        parser.error("Select an existing recording and a new output filename.")
    from faster_whisper import WhisperModel
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(str(args.recording), language=None if args.language=='auto' else args.language,
                                   vad_filter=True, beam_size=args.beam_size)
    result = draft(segments)
    with args.output.open('x', encoding='utf-8') as target:
        json.dump(result,target,ensure_ascii=False)
    print("Draft ready. Review the transcript and the opening-sentence summary before saving.")


if __name__ == '__main__':
    main()
