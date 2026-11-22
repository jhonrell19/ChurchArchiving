"""Offline fidelity tests: no recordings, real models, internet or database used."""
import ast
import json
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from public.mass_transcription_assistant import draft, transcribe

SERVER = Path(__file__).resolve().parents[1] / "church_backend" / "server.py"


class FaithfulSpeechTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.recording = Path(self.temp.name) / "fictional-mass.mp4"
        self.recording.write_bytes(b"fixture-only; audio decoder is mocked")
        self.output = Path(self.temp.name) / "fictional-draft.json"
        self.calls = []

        calls = self.calls

        class FakeWhisperModel:
            def __init__(self, model_size, **kwargs):
                calls.append(("load", model_size, kwargs))

            def transcribe(self, source, **kwargs):
                calls.append(("transcribe", source, kwargs))
                return (
                    iter([
                        SimpleNamespace(text="Magandang umaga po, mga kapatid."),
                        SimpleNamespace(text="Today let us remember ang pagmamahal sa kapwa."),
                        SimpleNamespace(text="Manalig tayo sa Panginoon. Amen."),
                    ]),
                    SimpleNamespace(language="tl"),
                )

        self.models = {
            "av": SimpleNamespace(__version__="14.2.0"),
            "faster_whisper": SimpleNamespace(WhisperModel=FakeWhisperModel),
        }

    def test_auto_mode_cannot_trigger_english_translation(self):
        with patch.dict(sys.modules, self.models):
            transcribe(self.recording, self.output)
        call = next(row for row in self.calls if row[0] == "transcribe")
        self.assertEqual(call[2]["task"], "transcribe")
        self.assertIsNone(call[2]["language"])
        self.assertTrue(call[2]["multilingual"])
        self.assertTrue(call[2]["vad_filter"])
        self.assertFalse(call[2]["condition_on_previous_text"])
        self.assertEqual(self.calls[0][1], "small")
        result = json.loads(self.output.read_text(encoding="utf-8"))
        self.assertIn("Magandang umaga po", result["transcriptText"])
        self.assertIn("ang pagmamahal sa kapwa", result["transcriptText"])
        self.assertIn("Today let us remember", result["transcriptText"])
        self.assertNotIn("Good morning, brothers and sisters", result["transcriptText"])
        self.assertEqual(result["languageMode"], "auto")
        self.assertEqual(result["detectedLanguage"], "tl")
        self.assertEqual(result["transcriptionTask"], "transcribe")
        self.assertTrue(result["reviewRequired"])
        self.assertIn("Magandang umaga po", result["summaryText"])

    def test_forced_tagalog_dominant_mode(self):
        with patch.dict(sys.modules, self.models):
            transcribe(self.recording, self.output, language="tl", model_size="base")
        call = next(row for row in self.calls if row[0] == "transcribe")
        self.assertEqual(call[2]["task"], "transcribe")
        self.assertEqual(call[2]["language"], "tl")
        self.assertFalse(call[2]["multilingual"])

    def test_bad_language_rejected_without_loading_model(self):
        with patch.dict(sys.modules, self.models):
            with self.assertRaisesRegex(ValueError, "Invalid language"):
                transcribe(self.recording, self.output, language="translate")
        self.assertFalse(self.output.exists())
        self.assertFalse(self.calls)

    def test_existing_review_file_is_never_overwritten(self):
        self.output.write_text("DO NOT OVERWRITE", encoding="utf-8")
        with patch.dict(sys.modules, self.models):
            with self.assertRaises(ValueError):
                transcribe(self.recording, self.output)
        self.assertEqual(self.output.read_text(encoding="utf-8"), "DO NOT OVERWRITE")

    def test_full_transcript_keeps_spoken_fillers(self):
        result = draft([
            SimpleNamespace(text="Ah, magandang umaga po."),
            SimpleNamespace(text="So, ngayon ay pag-uusapan natin ang faith.")
        ])
        self.assertEqual(result["transcriptText"],
                         "Ah, magandang umaga po. So, ngayon ay pag-uusapan natin ang faith.")
        self.assertIn("magandang", result["summaryText"])


class VerifiedMassStatusTests(unittest.TestCase):
    def test_cannot_mark_mass_transcribed_without_actual_saved_text(self):
        node = next(
            n for n in ast.parse(SERVER.read_text(encoding="utf-8")).body
            if isinstance(n, ast.FunctionDef) and n.name == "api_update_mass_status"
        )
        node.decorator_list = []
        mass = SimpleNamespace(id=12, active=True, status="In Progress", transcript_text=None)
        session = SimpleNamespace(commit=Mock())
        scope = {
            "require_roles": lambda *args: None,
            "MassRecord": SimpleNamespace(query=SimpleNamespace(get=lambda _: mass)),
            "request": SimpleNamespace(get_json=lambda: {"status": "Transcribed"}),
            "db": SimpleNamespace(session=session),
        }
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(SERVER), "exec"), scope)
        result, status = scope["api_update_mass_status"](12)
        self.assertEqual(status, 409)
        self.assertIn("transcript", result["error"].lower())
        session.commit.assert_not_called()
        mass.transcript_text = "Magandang umaga po. Today we gather."
        result, status = scope["api_update_mass_status"](12)
        self.assertEqual(status, 200)
        self.assertEqual(mass.status, "Transcribed")
        session.commit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
