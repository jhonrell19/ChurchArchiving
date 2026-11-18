"""Read-only staging DB checks (no secrets and no account details printed).
Requires ARCHIVE_POSTGRES_URL in local environment.
Usage: python 06_verify_staging.py
"""
from sqlalchemy import create_engine,text
import os

AUTH = ('User','Session','EmailVerificationToken','PasswordResetToken','StaffMfa','StaffMfaChallenge','PhoneVerification')
ARCHIVE = ('document','audit_log','certificate_request','mass_record','announcement','cemetery_slot','cemetery_reservation','cemetery_payment','burial_record','certificate_fee_settings','paymongo_verified_payment')

def run():
    url = os.getenv('ARCHIVE_POSTGRES_URL')
    if not url: raise SystemExit('Missing ARCHIVE_POSTGRES_URL')
    e=create_engine(url,connect_args={'sslmode':'require'},pool_pre_ping=True)
    try:
        with e.connect() as c:
            for schema,tables in (('parish_private',ARCHIVE),('parish_auth',AUTH)):
                present=set(c.execute(text('SELECT table_name FROM information_schema.tables WHERE table_schema=:s'),{'s':schema}).scalars())
                missing=set(tables)-present
                if missing: raise SystemExit(f'Missing tables in {schema}: {sorted(missing)}')
                print(f'{schema}: {len(tables)} expected tables present')
                for table in tables:
                    name=f'{schema}."{table}"'
                    n=c.scalar(text(f'SELECT count(*) FROM {name}'))
                    print(f'  {table:26}: {n}')
            missing=c.scalar(text('''SELECT count(*) FROM parish_private.certificate_request r
                WHERE r.requester_user_id IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM parish_auth."User" u WHERE u.id=r.requester_user_id)'''))
            if missing:
                raise SystemExit(f'FAIL: {missing} certificate requests have no matching account')
            print('Certificate request ownership: PASS')
            misplaced=c.scalar(text('''SELECT count(*) FROM parish_private.paymongo_verified_payment p
                WHERE NOT EXISTS (SELECT 1 FROM parish_private.certificate_request r WHERE r.id=p.request_id)'''))
            if misplaced: raise SystemExit(f'FAIL: {misplaced} payment ledger rows have no matching request')
            duplicates=c.scalar(text('''SELECT count(*) FROM (
                SELECT provider_payment_id FROM parish_private.paymongo_verified_payment
                GROUP BY provider_payment_id HAVING count(*)>1) d'''))
            if duplicates: raise SystemExit('FAIL: duplicate provider payment IDs')
            print('PayMongo ledger references and uniqueness: PASS')
            invalid=c.scalar(text('''SELECT count(*) FROM parish_private.certificate_request
                WHERE base_fee<0 OR urgent_fee<0 OR total_fee<0 OR base_fee+urgent_fee<>total_fee'''))
            if invalid: raise SystemExit(f'FAIL: {invalid} certificate requests have inconsistent fee snapshots')
            print('Stored request fee arithmetic: PASS')
            print('STAGING STRUCTURAL CHECKS: PASS (still not a live application test)')
    finally:
        e.dispose()
if __name__=='__main__':run()
