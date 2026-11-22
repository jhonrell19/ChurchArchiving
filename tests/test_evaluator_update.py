import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest

from worker.transcribe import draft


class TranscriptDraftTests(unittest.TestCase):
    def test_text_and_review_summary_are_separate(self):
        value = draft([SimpleNamespace(text='Unang pangungusap. Second sentence.'),
                       SimpleNamespace(text='Third sentence! Fourth sentence.')])
        self.assertTrue(value['transcriptText'].endswith('Fourth sentence.'))
        self.assertIn('Fourth sentence.', value['summaryText'])
        self.assertEqual(json.loads(json.dumps(value)), value)

    def test_long_tagalog_english_summary_covers_more_than_opening(self):
        from public.mass_transcription_assistant import ranked_summary
        sample = (
            "Magandang umaga at maligayang pagdating sa misa. "
            "Today we gather as a community for reflection. "
            "Maraming salamat sa inyong pagdalo sa ating simbahan. "
            "We will now hear the scripture readings. "
            "Ang pananampalataya ay lumalakas kapag tumutulong tayo sa kapwa. "
            "Faith and service are important in our parish community. "
            "Sa panahon ng pagsubok, manalig at magmahal sa pamilya. "
            "Remember to care for neighbors who need help. "
            "Ang mensahe ng Ebanghelyo ay pagmamahal at pag-asa. "
            "Go in peace and share kindness with others."
        )
        result = ranked_summary(sample, max_sentences=3)
        self.assertLess(len(result), len(sample))
        self.assertTrue(any(t in result for t in ["pananampalataya", "Faith and service", "pag-asa", "kindness"]))
        self.assertEqual(result, ranked_summary(sample, max_sentences=3))

    def test_unpunctuated_long_audio_is_not_copied_as_summary(self):
        from public.mass_transcription_assistant import ranked_summary
        text = " ".join(["parish prayer community hope and pagmamahal for everyone"] * 36)
        summary = ranked_summary(text, max_sentences=3)
        self.assertLess(len(summary), len(text))

    def test_silent_recording_does_not_create_empty_draft(self):
        with self.assertRaises(ValueError):
            draft([SimpleNamespace(text='   ')])


class StorageCopyTests(unittest.TestCase):
    def test_snapshot_mismatch(self):
        from scripts.verify_upload_backup import verify
        with tempfile.TemporaryDirectory() as temp:
            first, second = Path(temp)/'source', Path(temp)/'restored'
            first.mkdir()
            second.mkdir()
            for root in (first, second):
                (root/'sample.pdf').write_bytes(b'fixture data')
            self.assertEqual(verify(first, second)['matched'], 1)
            (second/'sample.pdf').write_bytes(b'changed data')
            self.assertEqual(verify(first, second)['different'], 1)
