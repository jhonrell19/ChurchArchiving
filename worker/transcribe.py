"""Command-line entry point for the downloadable parish transcription assistant."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "public"))
from mass_transcription_assistant import draft, main

if __name__ == '__main__':
    main()
