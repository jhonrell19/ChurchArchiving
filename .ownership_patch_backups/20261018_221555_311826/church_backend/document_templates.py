import json
import os
from datetime import datetime

from reportlab.lib.pagesizes import A4, legal
from reportlab.pdfgen import canvas


class TemplateNotConfiguredError(RuntimeError):
    pass


class TemplateDataError(RuntimeError):
    pass


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates', 'certificates')


def _record_data(source_document):
    raw = getattr(source_document, 'record_data', None)
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        value = json.loads(raw)
        return value if isinstance(value, dict) else {}
    except (TypeError, ValueError, json.JSONDecodeError):
        return {}


def _pretty_date(value):
    if not value:
        return ''
    text = str(value).strip()
    for fmt in ('%Y-%m-%d', '%m/%d/%Y', '%m-%d-%Y'):
        try:
            return datetime.strptime(text, fmt).strftime('%B %d, %Y')
        except ValueError:
            pass
    return text


def _fit_font(c, text, font='Helvetica', preferred=11, min_size=6, max_width=None):
    size = preferred
    if not max_width:
        return size
    while size > min_size and c.stringWidth(text, font, size) > max_width:
        size -= 0.5
    return size


def _background(c, image_path, page_size, image_size):
    page_w, page_h = page_size
    img_w, img_h = image_size
    scale = min(page_w / img_w, page_h / img_h)
    draw_w = img_w * scale
    draw_h = img_h * scale
    offset_x = (page_w - draw_w) / 2
    offset_y = (page_h - draw_h) / 2
    c.drawImage(image_path, offset_x, offset_y, width=draw_w, height=draw_h, preserveAspectRatio=True, mask='auto')
    return scale, offset_x, offset_y, draw_h


def _draw_px(c, text, x_px, y_px, *, scale, offset_x, offset_y, draw_h,
             font='Helvetica', size=11, max_width_px=None, align='left'):
    text = '' if text is None else str(text).strip()
    if not text:
        return
    x = offset_x + x_px * scale
    y = offset_y + draw_h - y_px * scale
    max_width = max_width_px * scale if max_width_px else None
    font_size = _fit_font(c, text, font, size, 6, max_width)
    c.setFont(font, font_size)
    if align == 'center':
        c.drawCentredString(x, y, text)
    elif align == 'right':
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)


def _name(parts):
    return ' '.join(str(x).strip() for x in parts if x and str(x).strip())


def _generate_baptism(source_document, output_path):
    data = _record_data(source_document)
    bg = os.path.join(TEMPLATE_DIR, 'baptism_form.png')
    if not os.path.isfile(bg):
        raise TemplateNotConfiguredError('Baptism template image is missing.')

    c = canvas.Canvas(output_path, pagesize=A4)
    scale, ox, oy, dh = _background(c, bg, A4, (1414, 2000))

    values = {
        'date_of_baptism': data.get('date_of_baptism') or source_document.date_of_record,
        'child_name': data.get('child_name') or source_document.person_name,
        'date_of_birth': data.get('date_of_birth'),
        'place_of_birth': data.get('place_of_birth'),
        'father_name': data.get('father_name'),
        'mother_name': data.get('mother_name'),
        'address': data.get('address'),
        'contact_number': data.get('contact_number'),
    }

    fields = {
        'date_of_baptism': (620, 653, 500),
        'child_name': (535, 731, 520),
        'date_of_birth': (535, 808, 520),
        'place_of_birth': (535, 884, 520),
        'father_name': (620, 960, 500),
        'mother_name': (620, 1037, 500),
        'address': (620, 1113, 500),
        'contact_number': (620, 1189, 500),
    }

    for key, (x, y, width) in fields.items():
        value = values[key]
        if key.startswith('date_'):
            value = _pretty_date(value)
        _draw_px(c, value, x, y, scale=scale, offset_x=ox, offset_y=oy, draw_h=dh,
                 size=11, max_width_px=width)

    sponsors = data.get('sponsors') or []
    if isinstance(sponsors, str):
        sponsors = [x.strip() for x in sponsors.split('\n') if x.strip()]
    sponsor_positions = [
        (88, 1409), (88, 1460), (88, 1511), (88, 1561), (88, 1611),
        (680, 1409), (680, 1460), (680, 1511), (680, 1561), (680, 1611),
    ]
    for index, (x, y) in enumerate(sponsor_positions):
        if index < len(sponsors):
            _draw_px(c, sponsors[index], x, y, scale=scale, offset_x=ox, offset_y=oy, draw_h=dh,
                     size=9.5, max_width_px=380)

    c.showPage()
    c.save()


def _generate_confirmation(source_document, output_path):
    data = _record_data(source_document)
    bg = os.path.join(TEMPLATE_DIR, 'confirmation_form.png')
    if not os.path.isfile(bg):
        raise TemplateNotConfiguredError('Confirmation template image is missing.')

    c = canvas.Canvas(output_path, pagesize=A4)
    scale, ox, oy, dh = _background(c, bg, A4, (1414, 2000))

    values = {
        'date_of_confirmation': data.get('date_of_confirmation') or source_document.date_of_record,
        'date_of_baptism': data.get('date_of_baptism'),
        'child_name': data.get('child_name') or source_document.person_name,
        'date_of_birth': data.get('date_of_birth'),
        'place_of_birth': data.get('place_of_birth'),
        'father_name': data.get('father_name'),
        'mother_name': data.get('mother_name'),
        'address': data.get('address'),
        'contact_number': data.get('contact_number'),
    }

    fields = {
        'date_of_confirmation': (535, 654, 510),
        'date_of_baptism': (620, 732, 500),
        'child_name': (535, 807, 520),
        'date_of_birth': (535, 884, 520),
        'place_of_birth': (535, 960, 520),
        'father_name': (620, 1036, 500),
        'mother_name': (620, 1114, 500),
        'address': (620, 1190, 500),
        'contact_number': (620, 1267, 500),
    }

    for key, (x, y, width) in fields.items():
        value = values[key]
        if key.startswith('date_'):
            value = _pretty_date(value)
        _draw_px(c, value, x, y, scale=scale, offset_x=ox, offset_y=oy, draw_h=dh,
                 size=11, max_width_px=width)

    sponsors = data.get('sponsors') or []
    if isinstance(sponsors, str):
        sponsors = [x.strip() for x in sponsors.split('\n') if x.strip()]
    sponsor_positions = [
        (135, 1411), (135, 1462), (135, 1513), (135, 1563), (135, 1613),
        (705, 1411), (705, 1462), (705, 1513), (705, 1563), (705, 1613),
    ]
    for index, (x, y) in enumerate(sponsor_positions):
        if index < len(sponsors):
            _draw_px(c, sponsors[index], x, y, scale=scale, offset_x=ox, offset_y=oy, draw_h=dh,
                     size=9.5, max_width_px=380)

    c.showPage()
    c.save()


def _generate_marriage(source_document, output_path):
    data = _record_data(source_document)
    front = os.path.join(TEMPLATE_DIR, 'marriage_front.png')
    back = os.path.join(TEMPLATE_DIR, 'marriage_back.png')
    if not os.path.isfile(front) or not os.path.isfile(back):
        raise TemplateNotConfiguredError('Marriage front/back template images are missing.')

    page_size = legal
    c = canvas.Canvas(output_path, pagesize=page_size)
    scale, ox, oy, dh = _background(c, front, page_size, (1261, 2048))

    # This generator intentionally fills factual civil data only. It does not
    # place signatures, legal check marks, sworn statements, registry actions,
    # or delayed-registration affidavit responses.
    h = data.get('husband') if isinstance(data.get('husband'), dict) else {}
    w = data.get('wife') if isinstance(data.get('wife'), dict) else {}

    def put(text, x, y, width=420, size=8.5, align='left'):
        _draw_px(c, text, x, y, scale=scale, offset_x=ox, offset_y=oy, draw_h=dh,
                 size=size, max_width_px=width, align=align)

    # Names (the form prints First / Middle / Last markers inside each row).
    put(h.get('first_name'), 260, 266, 145, size=8)
    put(h.get('middle_name'), 415, 266, 145, size=8)
    put(h.get('last_name'), 565, 266, 145, size=8)
    put(w.get('first_name'), 745, 266, 145, size=8)
    put(w.get('middle_name'), 900, 266, 145, size=8)
    put(w.get('last_name'), 1050, 266, 145, size=8)

    # Birth and personal data
    put(_pretty_date(h.get('date_of_birth')), 270, 354, 260)
    put(h.get('age'), 606, 354, 70, align='center')
    put(_pretty_date(w.get('date_of_birth')), 750, 354, 260)
    put(w.get('age'), 1100, 354, 70, align='center')

    put(h.get('place_of_birth'), 270, 412, 365)
    put(w.get('place_of_birth'), 750, 412, 365)

    put(h.get('sex'), 270, 468, 110)
    put(h.get('citizenship'), 430, 468, 200)
    put(w.get('sex'), 750, 468, 110)
    put(w.get('citizenship'), 915, 468, 200)

    put(h.get('residence'), 270, 527, 365, size=7.5)
    put(w.get('residence'), 750, 527, 365, size=7.5)
    put(h.get('religion'), 270, 584, 360)
    put(w.get('religion'), 750, 584, 360)
    put(h.get('civil_status'), 270, 628, 360)
    put(w.get('civil_status'), 750, 628, 360)

    put(_name([h.get('father_first_name'), h.get('father_middle_name'), h.get('father_last_name')]), 270, 678, 365)
    put(_name([w.get('father_first_name'), w.get('father_middle_name'), w.get('father_last_name')]), 750, 678, 365)
    put(h.get('father_citizenship'), 270, 725, 360)
    put(w.get('father_citizenship'), 750, 725, 360)

    put(_name([h.get('mother_first_name'), h.get('mother_middle_name'), h.get('mother_last_name')]), 270, 772, 365)
    put(_name([w.get('mother_first_name'), w.get('mother_middle_name'), w.get('mother_last_name')]), 750, 772, 365)
    put(h.get('mother_citizenship'), 270, 820, 360)
    put(w.get('mother_citizenship'), 750, 820, 360)

    put(_name([h.get('consent_first_name'), h.get('consent_middle_name'), h.get('consent_last_name')]), 270, 868, 365)
    put(_name([w.get('consent_first_name'), w.get('consent_middle_name'), w.get('consent_last_name')]), 750, 868, 365)
    put(h.get('consent_relationship'), 270, 916, 360)
    put(w.get('consent_relationship'), 750, 916, 360)
    put(h.get('consent_residence'), 270, 964, 365, size=7.5)
    put(w.get('consent_residence'), 750, 964, 365, size=7.5)

    # Shared marriage facts (items 15-17).
    put(data.get('place_of_marriage'), 300, 1010, 430, size=8)
    put(data.get('marriage_city'), 760, 1010, 190, size=8)
    put(data.get('marriage_province'), 1000, 1010, 165, size=8)
    put(_pretty_date(data.get('date_of_marriage') or source_document.date_of_record), 300, 1065, 320)
    put(data.get('time_of_marriage'), 915, 1065, 220)

    # Printed witness names only. Signature lines remain untouched.
    witnesses = data.get('witnesses') or []
    if isinstance(witnesses, str):
        witnesses = [x.strip() for x in witnesses.split('\n') if x.strip()]
    witness_positions = [
        (185, 1558), (480, 1558), (775, 1558),
        (1070, 1558), (185, 1588), (480, 1588),
    ]
    for index, (x, y) in enumerate(witness_positions):
        if index < len(witnesses):
            put(witnesses[index], x, y, 235, size=7.5)

    c.showPage()

    # Back page intentionally remains blank. This page contains sworn/legal
    # affidavit statements and delayed-registration declarations that must be
    # completed by authorized persons only when applicable.
    _background(c, back, page_size, (1264, 2048))
    c.showPage()
    c.save()


def generate_official_draft(cert_request, source_document, output_path):
    sacrament_type = (source_document.sacrament_type or '').strip().lower()
    if sacrament_type == 'baptismal':
        _generate_baptism(source_document, output_path)
    elif sacrament_type == 'confirmation':
        _generate_confirmation(source_document, output_path)
    elif sacrament_type == 'marriage':
        _generate_marriage(source_document, output_path)
    elif sacrament_type in {'burial', 'land_agreement'}:
        raise TemplateNotConfiguredError(
            'No official Burial/Land Agreement template has been configured yet.'
        )
    else:
        raise TemplateNotConfiguredError(
            f'No official template is configured for {sacrament_type or "this record"}.'
        )
