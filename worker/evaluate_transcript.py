"""Offline, privacy-preserving transcript accuracy scoring against staff-reviewed reference text."""
import argparse
import re
import unicodedata
from pathlib import Path


def tokenize(text):
    text = unicodedata.normalize("NFKC", text).casefold()
    return re.findall(r"[^\W_]+(?:['’][^\W_]+)*", text, flags=re.UNICODE)


def word_error_rate(reference, hypothesis):
    ref, hyp = tokenize(reference), tokenize(hypothesis)
    if not ref:
        raise ValueError("Reference transcript has no words.")
    previous = list(range(len(hyp) + 1))
    for index, word in enumerate(ref, start=1):
        current = [index]
        for col, candidate in enumerate(hyp, start=1):
            current.append(min(previous[col] + 1, current[col - 1] + 1,
                               previous[col - 1] + (word != candidate)))
        previous = current
    return previous[-1] / len(ref), len(ref), previous[-1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reviewed_reference", type=Path)
    parser.add_argument("generated_transcript", type=Path)
    args = parser.parse_args()
    for path in (args.reviewed_reference, args.generated_transcript):
        if not path.is_file():
            parser.error(f"Missing file: {path}")
    ref = args.reviewed_reference.read_text(encoding="utf-8-sig")
    hyp = args.generated_transcript.read_text(encoding="utf-8-sig")
    score, count, errors = word_error_rate(ref, hyp)
    print(f"Word error rate: {score:.1%} ({errors} edits / {count} reference words)")
    print("Accuracy must be reviewed for names, scripture citations and Tagalog-English code-switching.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
