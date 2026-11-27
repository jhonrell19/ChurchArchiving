"""No external network/database: Staff-only archive and Admin oversight regression."""
import ast
import hmac
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

SERVER = Path(__file__).resolve().parents[1] / 'church_backend/server.py'
TREE = ast.parse(SERVER.read_text(encoding='utf-8'))


def isolated(name, scope):
    node = next(node for node in TREE.body
                if isinstance(node, ast.FunctionDef) and node.name == name)
    node.decorator_list = []
    exec(compile(ast.Module(body=[node], type_ignores=[]), str(SERVER), 'exec'), scope)
    return scope[name]


class ArchiveBoundaryTests(unittest.TestCase):
    def _guard(self, role, path, method='GET'):
        scope = {
            '_is_protected_backend_path': lambda: True,
            'INTERNAL_API_KEY': 'TEST-ONLY-secret',
            'request': SimpleNamespace(
                path=path, method=method,
                headers={
                    'X-Internal-Key': 'TEST-ONLY-secret',
                    'X-User-Role': role,
                    'X-User-Id': '7',
                }),
            'g': SimpleNamespace(),
            'hmac': hmac,
        }
        return isolated('protect_backend_boundary', scope)()

    def test_admin_cannot_read_or_mutate_raw_archives(self):
        for path, method in [
            ('/api/archive/documents', 'GET'),
            ('/api/archive/documents/baptismal', 'GET'),
            ('/api/archive/documents/5/original-scan', 'GET'),
            ('/api/archive/documents/5/filled-template', 'GET'),
            ('/api/archive/upload', 'POST'),
            ('/api/archive/documents/5/delete', 'PATCH'),
            ('/api/archive/documents/5/restore', 'PATCH'),
            ('/api/archive/ocr-preview', 'POST'),
            ('/api/archive/deleted-documents', 'GET'),
            ('/api/requests/42/download', 'GET'),
        ]:
            with self.subTest(path=path):
                self.assertEqual(self._guard('ADMIN',path,method)[1],403)

    def test_admin_can_read_summary_audit_without_raw_files(self):
        for path in (
            '/api/archive/stats', '/api/archive/audit-logs',
            '/api/archive/storage-status', '/api/archive/ocr-health',
        ):
            with self.subTest(path=path):
                self.assertIsNone(self._guard('ADMIN',path))

    def test_staff_preserves_document_access(self):
        for path,method in [
            ('/api/archive/documents','GET'),
            ('/api/archive/documents/baptismal','GET'),
            ('/api/archive/upload','POST'),
            ('/api/requests/42/download','GET'),
        ]:
            with self.subTest(path=path):
                self.assertIsNone(self._guard('STAFF',path,method))

    def test_admin_mass_media_not_document_files(self):
        scope={
            'g':SimpleNamespace(user_role='ADMIN'),
            'normalize_path':lambda value:value,
            'func':SimpleNamespace(replace=lambda value, *args:value),
            'Document':SimpleNamespace(filepath='uploads/archive.pdf'),
            'CertificateRequest':SimpleNamespace(generated_file='uploads/releases/a.pdf',
                                                 draft_file='uploads/releases/draft.pdf'),
        }
        view=isolated('can_access_filepath',scope)
        self.assertTrue(view('uploads/masses/fictional.mp4'))
        self.assertTrue(view('uploads/transcriptions/fictional.txt'))
        self.assertFalse(view('uploads/baptismal/fictional.pdf'))
        self.assertFalse(view('uploads/releases/fictional.pdf'))


if __name__=='__main__':
    unittest.main()
