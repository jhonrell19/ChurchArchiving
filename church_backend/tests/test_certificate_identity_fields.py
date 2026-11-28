import base64
import unittest
from certificate_identity import validate_identity


class CertificateIdentityTest(unittest.TestCase):
    def form(self):
        return {"identity":{"bride":"Elena Rivera", "marriageDate":"2000-03-04",
                "groomMother":"Ana Santos","brideMother":"Maria Reyes","relationship":"Child"}}

    def test_redacted_copy(self):
        fields, proof = validate_identity("marriage", self.form(), "Juan Rivera")
        self.assertEqual(fields["brideMother"], "Maria Reyes")
        self.assertIsNone(proof)

    def test_impossible_date(self):
        data = self.form()
        data["identity"]["marriageDate"] = "2000-02-31"
        with self.assertRaises(ValueError):
            validate_identity("marriage", data, "Juan Rivera")

    def test_unredacted_requires_proof(self):
        data = self.form()
        data["identity"]["unredacted"] = True
        with self.assertRaises(ValueError):
            validate_identity("marriage", data, "Juan Rivera")
        data["proofBase64"] = base64.b64encode(b"%PDF-fictional").decode()
        fields, proof = validate_identity("marriage", data, "Juan Rivera")
        self.assertEqual(fields["proofType"], "application/pdf")
        self.assertTrue(proof.startswith(b"%PDF-"))

    def test_confirmation_year_and_relationship(self):
        data = {"identity":{"birthDate":"2000-01-01","confirmation":"2015","relationship":"Self"}}
        self.assertEqual(validate_identity("confirmation",data,"Ana Rivera")[0]["confirmation"], "2015")
        data["identity"]["relationship"] = "Unknown"
        with self.assertRaises(ValueError):
            validate_identity("confirmation",data,"Ana Rivera")
