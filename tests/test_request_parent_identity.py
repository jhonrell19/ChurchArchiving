"""Exercise request creation and scoped, paginated search with a fictional archive."""
import os
import unittest
import unicodedata
from unittest.mock import patch

from flask import Flask, g, request
from sqlalchemy import func, or_
from church_backend.models import CertificateRequest, AuditLog, db
from test_phase8_certificate_access import load_function


class RequestIdentityTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite://'
        db.init_app(app)
        ctx = app.app_context()
        ctx.push()
        self.addCleanup(ctx.pop)
        db.create_all()
        scope = dict(request=request, g=g, db=db, func=func, or_=or_,
                     os=os, unicodedata=unicodedata, CertificateRequest=CertificateRequest,
                     AuditLog=AuditLog, MAIN_ADMIN_TYPES=['baptismal'], BURIAL_ADMIN_TYPES=['burial'],
                     require_roles=lambda *roles: None if g.user_role in roles else ({}, 403),
                     current_user_id=lambda: g.user_id, relative_claims_enabled=lambda: False,
                     allowed_types_for_current_role=lambda: ['burial'] if g.user_role == 'BURIAL_ADMIN' else ['baptismal'],
                     get_certificate_fees=lambda: {'baptismal': 100, 'urgent': 0})
        load_function('serialize_request', scope)
        app.add_url_rule('/requests', methods=['GET'], view_func=load_function('api_get_requests', scope))
        app.add_url_rule('/requests', methods=['POST'], view_func=load_function('api_create_request', scope))
        self.client = app.test_client()
        self.role = 'USER'
        self.uid = 1

        @app.before_request
        def identity():
            g.user_role, g.user_id, g.user_name = self.role, self.uid, 'Ana Sample'

    @patch.dict(os.environ, PARISH_PORTAL_SETTINGS='disabled')
    def test_required_fields_matching_and_legacy(self):
        payload = dict(personName='Ana Sample', purpose='Personal copy', sacramentType='baptismal',
                       motherFullName='Ana María Dela Cruz', fatherFullName="Emil O’Reyes")
        for key in ['motherFullName', 'fatherFullName']:
            for invalid in [None, '  ', '123', 'X' * 151]:
                self.assertEqual(self.client.post('/requests', json={**payload, key: invalid}).status_code, 400)
        saved = self.client.post('/requests', json=payload)
        self.assertEqual(saved.status_code, 201, saved.json)
        self.assertEqual(saved.json['request']['motherFullName'], payload['motherFullName'])
        self.assertNotIn('requesterAddress', saved.json['request'])
        self.uid = 2
        self.assertEqual(self.client.get('/requests?page=1').json['requests'], [])
        self.assertEqual(self.client.post('/requests', json={**payload, 'motherFullName': 'Rosa Sample'}).status_code, 201)
        for self.role in ['ADMIN', 'STAFF']:
            data = self.client.get('/requests?q=dela%20cruz&page=1').json
            self.assertEqual(data['counts'], {'Pending': 1})
            self.assertEqual(data['requests'][0]['requesterUserId'], 1)
        self.role = 'BURIAL_ADMIN'
        self.assertEqual(self.client.get('/requests?q=Reyes&page=1').json['requests'], [])
        record = db.session.get(CertificateRequest, 1)
        record.mother_full_name = record.father_full_name = None
        db.session.commit()
        self.role, self.uid = 'USER', 1
        self.assertIsNone(self.client.get('/requests?page=1').json['requests'][0]['fatherFullName'])
