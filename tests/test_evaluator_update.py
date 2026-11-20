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
        self.assertTrue(value['summaryText'].endswith('Third sentence!'))
        self.assertEqual(json.loads(json.dumps(value)), value)

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
