"""Offline Phase 8 checks: no external calls or production data."""
import unittest
from worker.evaluate_transcript import tokenize, word_error_rate


class AccuracyMetrics(unittest.TestCase):
    def test_perfect_bilingual_match(self):
        rate, words, edits = word_error_rate("Magandang umaga. Good morning!", "magandang umaga good morning")
        self.assertEqual((rate, words, edits), (0.0, 4, 0))

    def test_missing_words(self):
        rate, words, edits = word_error_rate("Ama namin sumasalangit ka", "Ama namin ka")
        self.assertEqual((rate, words, edits), (0.25, 4, 1))

    def test_empty_reference_rejected(self):
        with self.assertRaises(ValueError):
            word_error_rate("  ...  ", "hello")

    def test_unicode_words_preserved(self):
        self.assertEqual(tokenize("Panginoón, tayo’y manalangin!"), ["panginoón", "tayo’y", "manalangin"])


if __name__ == "__main__":
    unittest.main()
