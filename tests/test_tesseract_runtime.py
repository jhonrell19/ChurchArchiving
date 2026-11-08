"""Small offline tests for Tesseract discovery (no OCR installation required)."""
from __future__ import annotations
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'church_backend'))
from tesseract_runtime import find_tesseract_executable


class TesseractRuntimeTests(unittest.TestCase):
    def test_explicit_executable_is_found(self):
        with tempfile.TemporaryDirectory() as d:
            exe = Path(d) / ('tesseract.exe' if os.name == 'nt' else 'tesseract')
            exe.write_text('dummy', encoding='utf-8')
            with patch.dict(os.environ, {'TESSERACT_CMD': str(exe), 'TESSERACT_PATH': ''}):
                self.assertEqual(find_tesseract_executable(), str(exe.resolve()))

    def test_explicit_directory_is_found(self):
        with tempfile.TemporaryDirectory() as d:
            exe = Path(d) / ('tesseract.exe' if os.name == 'nt' else 'tesseract')
            exe.write_text('dummy', encoding='utf-8')
            with patch.dict(os.environ, {'TESSERACT_PATH': d, 'TESSERACT_CMD': ''}):
                self.assertEqual(find_tesseract_executable(), str(exe.resolve()))

    def test_invalid_override_does_not_hide_valid_path(self):
        found = find_tesseract_executable()
        if not found:
            self.skipTest('No Tesseract on PATH or standard location on this machine')
        with patch.dict(os.environ, {'TESSERACT_CMD': '/clearly/nonexistent/tesseract'}):
            self.assertEqual(find_tesseract_executable(), found)


if __name__ == '__main__':
    unittest.main()
