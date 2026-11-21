"""Run against a disposable PostgreSQL database using PARISH_TEST_POSTGRES_URL."""
from io import BytesIO
import os
import unittest


@unittest.skipUnless(os.getenv("PARISH_TEST_POSTGRES_URL"), "Disposable PostgreSQL URL required")
class PaymentDateReportTests(unittest.TestCase):
    def test_month_office_and_payment_filters_and_exports(self):
        from flask import Flask, g
        from openpyxl import load_workbook
        from sqlalchemy import text
        from church_backend.office_reports import reports
        from models import db

        app = Flask(__name__)
        app.config.update(SQLALCHEMY_DATABASE_URI=os.environ["PARISH_TEST_POSTGRES_URL"],
                          PARISH_REPORT_SCOPE={"ADMIN": ["baptismal"]})
        db.init_app(app)
        app.register_blueprint(reports)

        @app.before_request
        def staff_session():
            g.user_role = "ADMIN"

        with app.app_context():
            db.session.execute(text("""CREATE TEMP TABLE certificate_request (
              id integer, sacrament_type text, status text, created_at timestamp,
              paid_at timestamp, payment_method text, payment_status text, total_fee integer)"""))
            for i, (category, method, amount) in enumerate([
                ("baptismal", "CASH", 50), ("baptismal", "PAYMONGO_TEST", 99),
                ("burial", "CASH", 100), ("baptismal", "PAYMONGO_LIVE", 75)
            ]):
                db.session.execute(text("""INSERT INTO pg_temp.certificate_request VALUES
                    (:id,:cat,'Released','2026-10-01','2026-10-31 16:10',:method,'Paid',:amount)"""),
                    {"id": i+1, "cat": category, "method": method, "amount": amount})
            client = app.test_client()
            url = "/api/reports/certificates?from=2026-11-01&to=2026-11-01"
            self.assertEqual(client.get(url).json["rows"], [])
            paid = url + "&basis=paid"
            rows = client.get(paid).json["rows"]
            self.assertEqual([(r["month"], r["requests"], r["collected"]) for r in rows],
                             [("2026-11", 2, 125)])
            self.assertEqual(client.get(paid+"&method=CASH").json["rows"][0]["collected"], 50)
            pdf = client.get(paid+"&format=pdf")
            self.assertTrue(pdf.data.startswith(b"%PDF"))
            workbook = load_workbook(BytesIO(client.get(paid+"&format=xlsx").data))
            self.assertEqual(workbook.active["A1"].value, "Payments received")
            self.assertEqual(client.get(url+"&basis=invalid").status_code, 400)
