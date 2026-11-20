from datetime import datetime, timezone
import os
from flask import Blueprint, g, request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from models import db, AuditLog

appointments=Blueprint('appointments',__name__)


@appointments.route('/api/appointments',methods=['GET','POST'])
def appointment_slots():
    if os.getenv('PARISH_APPOINTMENTS')!='enabled':
        return {'error':'Appointment booking is awaiting configuration.'},503
    role=g.user_role
    uid=int(g.user_id)
    office='main' if role=='ADMIN' else 'burial'
    if request.method=='GET':
        try:
            page=int(request.args.get('page',1))
            if not 1<=page<=100000: raise ValueError()
        except ValueError:return {'error':'Invalid page.'},400
        rows=db.session.execute(text('''SELECT s.id,s.starts_at,s.capacity,s.office,count(b.user_id) AS reserved,
            coalesce(bool_or(b.user_id=:uid),false) AS mine FROM appointment_slot s
            LEFT JOIN appointment_booking b ON b.slot_id=s.id WHERE s.starts_at>now()
            AND (:all_offices OR s.office=:office) GROUP BY s.id ORDER BY s.starts_at,s.id OFFSET :skip LIMIT 21'''),
            dict(uid=uid,office=office,all_offices=role=='USER',skip=(page-1)*20)).mappings().all()
        return {'slots':[{**row,'starts_at':row['starts_at'].isoformat()} for row in rows[:20]],'hasNext':len(rows)>20}
    body=request.get_json(silent=True) or {}
    action=body.get('action')
    if action=='create':
        if role not in ('ADMIN','BURIAL_ADMIN'):return {'error':'Forbidden'},403
        try:
            start=datetime.fromisoformat(body['startsAt'])
            cap=body['capacity']
            if start.tzinfo is None or start<=datetime.now(timezone.utc) or type(cap)!=int or not 1<=cap<=200:raise ValueError()
        except (KeyError,TypeError,ValueError):return {'error':'Choose a future time and capacity of 1–200.'},400
        params=dict(office=office,start=start,capacity=cap,uid=uid)
        sql='INSERT INTO appointment_slot(office,starts_at,capacity,created_by) VALUES(:office,:start,:capacity,:uid) RETURNING id'
    else:
        slot=body.get('slotId')
        if role!='USER' or action not in ('book','cancel') or type(slot)!=int or slot<1:
            return {'error':'Invalid booking action.'},400
        params=dict(slot=slot,uid=uid)
        if action=='book':
            sql='INSERT INTO appointment_booking(slot_id,user_id) VALUES(:slot,:uid) RETURNING slot_id'
        else:
            sql='''DELETE FROM appointment_booking b USING appointment_slot s WHERE b.slot_id=:slot AND s.id=b.slot_id
                AND b.user_id=:uid AND s.starts_at>now() RETURNING b.slot_id'''
    try:
        affected=db.session.scalar(text(sql),params)
        if affected is None:return {'error':'Booking unavailable.'},409
        db.session.add(AuditLog(user=g.user_email,action=f'Appointment {action} for slot #{affected}'))
        db.session.commit()
        return {'id':affected}
    except IntegrityError:
        db.session.rollback()
        return {'error':'The slot is unavailable, full or already booked.'},409
