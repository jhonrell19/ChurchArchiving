"""Exercise request creation and scoped, paginated search with a fictional archive."""
import os
import unittest
import unicodedata
from unittest.mock import patch
from types import SimpleNamespace
from church_backend.certificate_identity import validate_identity

from flask import Flask, g, request
from sqlalchemy import func, or_
from church_backend.models import CertificateIdentity, CertificateStatusHistory, CertificateRequest, CemeterySlot, AuditLog, db
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
        # Exercise request persistence and search here; the OTP service is isolated.
        imports = patch.dict("sys.modules", {
            "certificate_identity": SimpleNamespace(validate_identity=validate_identity),
            "request_codes": SimpleNamespace(consume=lambda uid,email,code: code == '235781'),
        })
        imports.start()
        self.addCleanup(imports.stop)
        scope = dict(CertificateIdentity=CertificateIdentity, CertificateStatusHistory=CertificateStatusHistory, request=request, g=g, db=db, func=func, or_=or_,
                     os=os, unicodedata=unicodedata, CertificateRequest=CertificateRequest,
                     AuditLog=AuditLog, CemeterySlot=CemeterySlot,
                     MAIN_ADMIN_TYPES=['baptismal'], BURIAL_ADMIN_TYPES=['burial', 'land_agreement', 'ownership'],
                     require_roles=lambda *roles: None if g.user_role in roles else ({}, 403),
                     current_user_id=lambda: g.user_id, relative_claims_enabled=lambda: False,
                     allowed_types_for_current_role=lambda: ['burial'] if g.user_role == 'BURIAL_ADMIN' else ['baptismal'],
                     get_certificate_fees=lambda: {'baptismal': 100, 'ownership': 0, 'land_agreement': 0, 'urgent': 0})
        load_function('request_metadata', scope)
        load_function('serialize_request', scope)
        app.add_url_rule('/requests', methods=['GET'], view_func=load_function('api_get_requests', scope))
        app.add_url_rule('/requests', methods=['POST'], view_func=load_function('api_create_request', scope))
        self.client = app.test_client()
        self.role = 'USER'
        self.uid = 1

        @app.before_request
        def identity():
            g.user_email = 'requester@example.invalid'
            g.user_role, g.user_id, g.user_name = self.role, self.uid, 'Ana Sample'

    @patch.dict(os.environ, PARISH_PORTAL_SETTINGS='disabled')
    def test_required_fields_matching_and_legacy(self):
        payload = dict(personName='Ana Sample', purpose='Personal copy', sacramentType='baptismal',
                       motherFullName='Ana María Dela Cruz', fatherFullName="Emil O’Reyes")
        payload.update(identity={'birthDate':'1990-04-12','relationship':'Self'}, verificationCode='235781')
        self.assertEqual(self.client.post('/requests', json={**payload,'verificationCode':'000000'}).status_code,400)
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

    @patch.dict(os.environ, PARISH_PORTAL_SETTINGS='disabled')
    def test_cemetery_document_requests_do_not_require_parent_names(self):
        ownership = dict(
            personName='Existing Holder', purpose='Request Copy of Ownership Certificate',
            sacramentType='ownership', recordDetails='Section A / Lot 20',
        )
        res = self.client.post('/requests', json=ownership)
        self.assertEqual(res.status_code, 201, res.json)
        self.assertIsNone(res.json['request']['motherFullName'])
        self.assertIsNone(res.json['request']['fatherFullName'])
        # Forged unrelated parent inputs must not become part of ownership records.
        res = self.client.post('/requests', json={
            **ownership, 'motherFullName': 'Unrelated Name', 'fatherFullName': 'Wrong Name',
        })
        self.assertEqual(res.status_code, 201, res.json)
        self.assertIsNone(res.json['request']['motherFullName'])
        self.assertIsNone(res.json['request']['fatherFullName'])

        existing_agreement = dict(
            personName='Agreement Holder', sacramentType='land_agreement',
            purpose='Request Copy of Existing Land Agreement',
            recordDetails='Agreement 2020-001, Block B',
        )
        res = self.client.post('/requests', json=existing_agreement)
        self.assertEqual(res.status_code, 201, res.json)
        self.assertEqual(res.json['request']['recordDetails'], existing_agreement['recordDetails'])
        self.assertIsNone(res.json['request']['motherFullName'])
        self.assertIsNone(res.json['request']['fatherFullName'])

        # New-lot inquiry requires an available lot, unlike existing copies.
        inquiry = dict(personName='Applicant', sacramentType='land_agreement',
                       purpose='Apply for Cemetery Lot Agreement')
        self.assertEqual(self.client.post('/requests', json=inquiry).status_code, 400)
        self.assertEqual(self.client.post('/requests',
                         json={**inquiry, 'cemeterySlotId': 999}).status_code, 409)
        slot = CemeterySlot(slot_code='FICTIONAL-A-1', lot_number='1', status='AVAILABLE', active=True)
        db.session.add(slot)
        db.session.commit()
        res = self.client.post('/requests', json={**inquiry, 'cemeterySlotId': slot.id})
        self.assertEqual(res.status_code, 201, res.json)
        self.assertIn('Lot inquiry:', res.json['request']['recordDetails'])
        self.assertEqual(slot.status, 'AVAILABLE', 'Inquiry must not reserve a lot')
