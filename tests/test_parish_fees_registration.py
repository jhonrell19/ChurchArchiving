"""Offline checks: approved fees and removal of public test-verification links."""
import ast
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'church_backend'))
from parish_fees import PARISH_FEES, CERTIFICATE_COPY_FEES, cemetery_fixed_charge


class FeeTests(unittest.TestCase):
    def test_official_prices(self):
        self.assertEqual(PARISH_FEES['sacramentalServices'], {
            'baptism': 2000, 'burial': 2000, 'matrimony': 5000,
        })
        self.assertEqual(PARISH_FEES['cemetery'], {'openingPermit': 1000, 'perpetualDuesPerYear': 300})
        self.assertEqual(CERTIFICATE_COPY_FEES['baptismal'], 200)
        self.assertEqual(CERTIFICATE_COPY_FEES['confirmation'], 200)
        self.assertEqual(CERTIFICATE_COPY_FEES['marriage'], 0)
        self.assertEqual(CERTIFICATE_COPY_FEES['ownership'], 0)
        self.assertEqual(CERTIFICATE_COPY_FEES['land_agreement'], 0)

    def test_cemetery_fixed_fees(self):
        self.assertEqual(cemetery_fixed_charge('OPENING_PERMIT'), (1000, None))
        self.assertEqual(cemetery_fixed_charge('PERPETUAL_DUES', 1), (300, 1))
        self.assertEqual(cemetery_fixed_charge('PERPETUAL_DUES', 3), (900, 3))
        self.assertIsNone(cemetery_fixed_charge('INSTALLMENT'))

    def test_invalid_dues_years_rejected(self):
        for years in (0, -1, 51, 1.5, True, None, '5', 2026):
            with self.subTest(years=years):
                with self.assertRaises(ValueError):
                    cemetery_fixed_charge('PERPETUAL_DUES', years)

    def test_no_unauthorized_online_fee_for_unpriced_certificate_copies(self):
        for category in ('marriage', 'ownership', 'land_agreement'):
            self.assertEqual(CERTIFICATE_COPY_FEES[category], 0)


class RegistrationSafetyTests(unittest.TestCase):
    def test_no_public_verification_or_reset_bypass(self):
        for rel in (
            'src/app/api/auth/register/route.ts',
            'src/app/api/auth/resend-verification/route.ts',
            'src/app/api/auth/forgot-password/route.ts',
            'src/app/login/page.tsx',
            'src/app/register/page.tsx',
            'src/app/forgot-password/page.tsx',
        ):
            self.assertNotIn('developmentVerificationUrl', (ROOT / rel).read_text(), rel)
            self.assertNotIn('developmentResetUrl', (ROOT / rel).read_text(), rel)

    def test_registration_requires_mail_delivery_configuration(self):
        route=(ROOT/'src/app/api/auth/register/route.ts').read_text()
        self.assertIn('isTransactionalEmailConfigured()', route)
        self.assertLess(route.index('if (!isTransactionalEmailConfigured())'), route.index('await prisma.user.create'))
        self.assertIn('verificationRequired: true', route)
        self.assertIn('emailVerified: false', route)

    def test_flask_routes_parse_and_cemetery_prices_server_enforced(self):
        route=(ROOT/'church_backend/server.py').read_text()
        ast.parse(route)
        self.assertIn('fixed_charge = cemetery_fixed_charge(payment_type, years)', route)
        self.assertIn('amount != fixed_charge[0]', route)
        self.assertIn('certificate_pricing()',route)
        self.assertIn("PARISH_FEES['sacramentalServices']", route)
        self.assertIn("PARISH_FEES['cemetery']", route)


if __name__ == '__main__':
    unittest.main()
