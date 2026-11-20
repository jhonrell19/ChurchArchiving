"""Run periodically on an authorized host with the same private DB settings as Flask."""
from calendar import monthrange
from datetime import timedelta
from urllib.parse import urlencode
import os
from flask import g
from sqlalchemy import text
from server import app
from models import db
from office_reports import certificate_report


def run_one():
    with app.app_context():
        record=db.session.execute(text("""SELECT * FROM report_schedule WHERE enabled AND
          next_run<=(now() AT TIME ZONE 'Asia/Manila')::date ORDER BY next_run,id FOR UPDATE SKIP LOCKED LIMIT 1""")).mappings().first()
        if not record: return False
        due=record['next_run']
        if record['frequency']=='weekly':
            start=due-timedelta(days=7); following=due+timedelta(days=7)
        else:
            start=(due.replace(day=1)-timedelta(days=1)).replace(day=1)
            following=due.replace(day=1)+timedelta(days=monthrange(due.year,due.month)[1])
        end=due-timedelta(days=1) if record['frequency']=='weekly' else due.replace(day=1)-timedelta(days=1)
        params={'from':start,'to':end,'format':record['format']}
        for field,key in [('category','type'),('request_status','status'),('payment_method','method')]:
            if record[field]:params[key]=record[field]
        with app.test_request_context('/api/reports/certificates?'+urlencode(params)):
            g.user_role='ADMIN' if record['office']=='main' else 'BURIAL_ADMIN'
            response=certificate_report()
            response.direct_passthrough=False
            payload=response.get_data()
            response.close()
        db.session.execute(text('''INSERT INTO report_run(schedule_id,due,report) VALUES(:id,:due,:body)
            ON CONFLICT(schedule_id,due) DO NOTHING'''),{'id':record['id'],'due':due,'body':payload})
        db.session.execute(text('UPDATE report_schedule SET next_run=:next,last_run=now() WHERE id=:id'),
                           {'id':record['id'],'next':following})
        db.session.commit()
        return True


if __name__=='__main__':
    if os.getenv('PARISH_EXTENDED_REPORTS')!='enabled': raise SystemExit('Reports are disabled.')
    for _ in range(20):
        if not run_one(): break
