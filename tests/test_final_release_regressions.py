"""Focused offline checks for the final integration. No real records or network access."""
from pathlib import Path
from types import SimpleNamespace
from io import BytesIO
import ast
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'church_backend'))

class StaticRegressionTests(unittest.TestCase):
    def test_server_is_parseable(self):
        ast.parse((ROOT/'church_backend/server.py').read_text(encoding='utf8'))

    def test_no_automatic_archive_status_rewrite_on_startup(self):
        src=(ROOT/'church_backend/server.py').read_text(encoding='utf8')
        tree=ast.parse(src)
        migration=next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name=='ensure_runtime_schema')
        body=ast.get_source_segment(src,migration)
        self.assertNotIn('UPDATE certificate_request',body)
        self.assertNotIn('UPDATE document',body)

    def test_primary_template_review_and_user_history_permissions_present(self):
        code=(ROOT/'church_backend/server.py').read_text(encoding='utf8')
        self.assertIn('review_confirmed',code)
        self.assertIn('def api_cancel_own_request',code)
        self.assertIn('def api_hide_own_request',code)
        self.assertIn('history_hidden=False',code)
        self.assertIn('Document.filepath',code)
        proxy=(ROOT/'src/app/api/backend/[...path]/route.ts').read_text(encoding='utf8')
        self.assertIn('(cancel|hide)',proxy)
        self.assertIn("role === 'USER'",proxy)

    def test_template_generation_all_categories(self):
        try:
            from document_templates import generate_official_draft
            import fitz
        except ImportError as exc:
            self.skipTest(f'PDF libraries unavailable: {exc}')
        cases=[
            ('baptismal',{'child_name':'Fictional Scan Test','date_of_baptism':'2015-08-23','father_name':'Test Parent','sponsors':['Sample Sponsor']},1),
            ('confirmation',{'child_name':'Fictional Scan Test','date_of_confirmation':'2020-11-03'},1),
            ('marriage',{'husband':{'first_name':'Test','last_name':'Partner'},'wife':{'first_name':'Sample','last_name':'Partner'},'date_of_marriage':'2022-08-15'},2),
        ]
        for cat,record,page_count in cases:
            with self.subTest(category=cat):
                d=SimpleNamespace(sacrament_type=cat,person_name='Fictional Scan Test',date_of_record='2022-08-15',record_data=record)
                stream=BytesIO()
                generate_official_draft(None,d,stream)
                with fitz.open(stream=stream.getvalue(),filetype='pdf') as pdf:
                    self.assertEqual(len(pdf),page_count)
                    all_text=' '.join(page.get_text() for page in pdf)
                    self.assertTrue(len(stream.getvalue())>1000)
                    self.assertTrue(any(marker in all_text for marker in ['Test','Sample','2015','2020','2022']))

    def test_ocr_parser_rejects_ambiguous_dates(self):
        from ocr_fields import parse_date
        self.assertEqual(parse_date('03/04/2025'),'')
        self.assertEqual(parse_date('June 12, 2005'),'2005-06-12')

if __name__=='__main__':unittest.main()
