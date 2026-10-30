from pathlib import Path
import shutil, datetime, sys
root=Path(__file__).resolve().parent
server=root/'church_backend/server.py'
ui=root/'src/app/dashboard/components/RequestsPage.tsx'
proxy=root/'src/app/api/backend/[...path]/route.ts'
for f in (server,ui,proxy):
 if not f.exists(): sys.exit(f'Missing: {f}')
a=server.read_text(encoding='utf-8'); b=ui.read_text(encoding='utf-8'); c=proxy.read_text(encoding='utf-8')
if '# PAYMONGO_CERTIFICATE_V1' in a:
 sys.exit('PayMongo patch already applied. No files changed.')
assert 'def api_demo_pay_request(request_id):' in a, 'Server baseline differs; aborting'
assert 'const demoPay = async (requestId: number) =>' in b, 'RequestsPage differs; aborting'
assert 'demo-pay' in c, 'Proxy differs; aborting'
# freeze legacy demo-pay so it cannot mark paid
needle='def api_demo_pay_request(request_id):\n'
a=a.replace(needle,needle+'    return {"error": "Demo payments disabled. Use PayMongo Checkout."}, 410\n',1)
# fee settings are actual parish data supplied (uncorroborated categories disabled by default)
start=a.index('DEMO_BASE_FEES = {'); end=a.index('\n\n\ndef current_user_id()',start)
a=a[:start]+'''# PAYMONGO_CERTIFICATE_V1
# All prices are in whole PHP pesos. Unconfirmed document prices default to 0 (disabled).
CERTIFICATE_BASE_FEES = {
    "baptismal": int(os.getenv("CERT_FEE_BAPTISMAL", "200")),
    "confirmation": int(os.getenv("CERT_FEE_CONFIRMATION", "200")),
    "marriage": int(os.getenv("CERT_FEE_MARRIAGE", "0")),
    "ownership": int(os.getenv("CERT_FEE_OWNERSHIP", "0")),
    "land_agreement": int(os.getenv("CERT_FEE_LAND_AGREEMENT", "0")),
}
DEMO_BASE_FEES = CERTIFICATE_BASE_FEES
DEMO_URGENT_FEE = int(os.getenv("CERT_FEE_URGENT", "100"))
''' +a[end:]
# Append API functions before app run guard (or at bottom; route must be registered before app.run)
marker='if __name__ == "__main__":'
if marker not in a: sys.exit('Missing main guard; no changes')
api='''
# PAYMONGO_CERTIFICATE_V1 — server-authoritative checkout and reconciliation
import base64
import urllib.request
import urllib.error


def _paymongo_api(method, path, payload=None):
    key = os.getenv("PAYMONGO_SECRET_KEY", "")
    if not key.startswith("sk_test_"):
        raise ValueError("A PayMongo TEST secret key (sk_test_) is required.")
    headers = {"Authorization": "Basic " + base64.b64encode((key + ":").encode()).decode(),
               "Content-Type": "application/json", "Accept": "application/json"}
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request("https://api.paymongo.com" + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=18) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as ex:
        app.logger.warning("PayMongo API error %s: %s", ex.code, ex.read().decode()[:500])
        raise RuntimeError("PayMongo rejected this operation. Check test keys and enabled payment channels.") from ex


@app.route("/api/requests/<int:request_id>/paymongo-checkout", methods=["POST"])
def certificate_checkout(request_id):
    denied = require_roles("USER")
    if denied: return denied
    cert = db.session.get(CertificateRequest, request_id)
    if not cert: return {"error": "Request not found"}, 404
    if cert.requester_user_id != current_user_id(): return {"error": "Forbidden"}, 403
    if cert.status not in {"Approved", "Ready"}: return {"error": "Approval required"}, 400
    if cert.payment_status == "Paid": return {"error": "Already paid"}, 409
    if (cert.payment_reference or "").startswith("cs_"):
        return {"error": "A checkout is already pending for this request. Contact staff before starting another payment."}, 409
    price = CERTIFICATE_BASE_FEES.get(cert.sacrament_type, 0)
    if price <= 0: return {"error": "Fee for this certificate has not been confirmed by the parish."}, 409
    total = price + (DEMO_URGENT_FEE if cert.is_urgent else 0)
    if cert.total_fee != total or cert.base_fee != price or cert.urgent_fee != total-price:
        # Do not silently overwrite previously quoted amount; staff must reconcile it first.
        return {"error": "Stored request fee does not match the configured parish fee. Please reconcile before checkout."}, 409
    public_url = os.getenv("APP_BASE_URL", "").rstrip("/")
    if not public_url.startswith("https://"):
        return {"error": "APP_BASE_URL must be a public HTTPS address for PayMongo checkout."}, 503
    methods = [s.strip() for s in os.getenv("PAYMONGO_METHODS", "card").split(",") if s.strip()]
    if not methods: return {"error": "No PayMongo methods configured"}, 500
    body = {"data": {"attributes": {
        "billing": {"email": cert.requester_email, "name": cert.requester_name},
        "cancel_url": public_url + "/dashboard",
        "success_url": public_url + "/dashboard",
        "description": "Smart Parish certificate request #" + str(cert.id),
        "reference_number": "PARISH-CERT-" + str(cert.id),
        "line_items": [{"name": "Certificate request #"+str(cert.id), "quantity": 1, "currency": "PHP", "amount": total*100}],
        "payment_method_types": methods,
        "send_email_receipt": False,
        "show_description": True,
        "show_line_items": True
    }}}
    try:
        result = _paymongo_api("POST", "/v1/checkout_sessions", body)
        session = result["data"]
        sid = session["id"]
        url = session["attributes"]["checkout_url"]
        if not isinstance(url, str) or not url.startswith("https://checkout.paymongo.com/"):
            raise ValueError("Unexpected checkout URL")
        cert.payment_reference = sid
        cert.payment_method = "PAYMONGO_TEST_PENDING"
        db.session.commit()
        return {"checkoutUrl": url}
    except Exception:
        db.session.rollback()
        app.logger.exception("PayMongo checkout creation failed")
        return {"error": "Unable to start PayMongo test checkout; verify configuration."}, 502


@app.route("/api/paymongo/confirm-internal", methods=["POST"])
def paymongo_confirm_internal():
    # The public Next.js webhook verifies PayMongo's HMAC signature first.
    # The private Flask API additionally requires its internal key and reserved role.
    if request.headers.get("X-User-Role") != "PAYMONGO_WEBHOOK":
        return {"error": "Forbidden"}, 403
    data = request.get_json(silent=True) or {}
    session_id = str(data.get("checkoutSessionId") or "")
    if not session_id.startswith("cs_"): return {"error": "Invalid checkout reference"}, 400
    cert = CertificateRequest.query.filter_by(payment_reference=session_id).first()
    if not cert: return {"error": "Unknown checkout session"}, 404
    if cert.payment_status == "Paid": return {"ok": True, "alreadyProcessed": True}, 200
    if cert.status not in {"Approved", "Ready"}: return {"error": "Request not approved"}, 409
    try:
        # Independently query PayMongo; do not trust webhook client fields for amount.
        actual = _paymongo_api("GET", "/v1/checkout_sessions/" + session_id)["data"]["attributes"]
        if actual.get("livemode") is True: return {"error": "Live mode not allowed"}, 409
        if actual.get("reference_number") != "PARISH-CERT-" + str(cert.id):
            return {"error": "Reference mismatch"}, 409
        price = CERTIFICATE_BASE_FEES.get(cert.sacrament_type, 0)
        total = price + (DEMO_URGENT_FEE if cert.is_urgent else 0)
        if price <= 0 or cert.total_fee != total: return {"error": "Amount mismatch"}, 409
        payments = actual.get("payments") or []
        success = any(p.get("attributes", p).get("status") == "paid" and
                      p.get("attributes", p).get("amount") == total * 100 for p in payments if isinstance(p, dict))
        if not success: return {"error": "Verified paid transaction not found"}, 409
        cert.payment_status = "Paid"
        cert.payment_method = "PAYMONGO_TEST"
        cert.paid_at = datetime.utcnow()
        db.session.add(AuditLog(user="PAYMONGO_WEBHOOK", action=f"Verified PayMongo test payment for certificate #{cert.id}", document_id=cert.matched_document_id))
        db.session.commit()
        return {"ok": True}, 200
    except Exception:
        db.session.rollback()
        app.logger.exception("PayMongo webhook verification failed")
        return {"error": "Unable to verify checkout against PayMongo"}, 502

'''
a=a.replace(marker,api+marker,1)
# permit reserved server-to-server webhook role on this one endpoint, after internal-key check
old='''    if g.user_role not in {"USER", "ADMIN", "BURIAL_ADMIN"}:'''
new='''    if request.path == "/api/paymongo/confirm-internal" and g.user_role == "PAYMONGO_WEBHOOK":
        return None

    if g.user_role not in {"USER", "ADMIN", "BURIAL_ADMIN"}:'''
assert old in a
a=a.replace(old,new,1)
# next role allowlist
c=c.replace('''  /^api\\/requests\\/\\d+\\/demo-pay$/.test(path)''','''  /^api\\/requests\\/\\d+\\/paymongo-checkout$/.test(path)''')
# UI changes
b=b.replace('''  const demoPay = async (requestId: number) => {''','''  const payMongoCheckout = async (requestId: number) => {''')
x=b.index('  const payMongoCheckout = async (requestId: number) => {'); y=b.index('\n  const previewBaseFee',x)
b=b[:x]+'''  const payMongoCheckout = async (requestId: number) => {
    try {
      const res = await fetch(`/api/backend/api/requests/${requestId}/paymongo-checkout`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { alert(data.error || 'Checkout unavailable.'); return }
      if (!data.checkoutUrl?.startsWith('https://checkout.paymongo.com/')) {
        alert('Invalid payment destination.'); return
      }
      window.location.assign(data.checkoutUrl)
    } catch (error) {
      console.warn('PayMongo checkout error:', error)
      alert('Unable to reach payment checkout.')
    }
  }
''' + b[y:]
b=b.replace('void demoPay(req.id)', 'void payMongoCheckout(req.id)').replace('Demo Pay {formatPeso(req.totalFee)}','Pay Online {formatPeso(req.totalFee)}').replace('Your request is approved. Demo payment is now available.','Your request is approved. PayMongo test checkout is available.')
b=b.replace("const DEMO_BASE_FEES: Record<RequestType, number> = {\n  Baptismal: 100,\n  Confirmation: 100,\n  Marriage: 100,\n  'Certificate of Ownership': 100,\n  'Land Agreement': 100,\n}","const DEMO_BASE_FEES: Record<RequestType, number> = {\n  Baptismal: 200,\n  Confirmation: 200,\n  Marriage: 0,\n  'Certificate of Ownership': 0,\n  'Land Agreement': 0,\n}")
b=b.replace('const DEMO_URGENT_FEE = 50','const DEMO_URGENT_FEE = 100')
# show only if payable category, and nonzero due
b=b.replace("req.paymentStatus !== 'Paid' &&\n                  (req.status", "req.paymentStatus !== 'Paid' &&\n                  req.totalFee > 0 &&\n                  (req.status",1)
# write backups after full validations
for f in (server,ui,proxy):
 shutil.copy2(f,f.with_name(f.name+'.pre-paymongo-'+datetime.datetime.now().strftime('%Y%m%d%H%M%S')+'.bak'))
server.write_text(a,encoding='utf-8');ui.write_text(b,encoding='utf-8');proxy.write_text(c,encoding='utf-8')
webhook=root/'src/app/api/paymongo/webhook/route.ts'
webhook.parent.mkdir(parents=True,exist_ok=True)
webhook.write_text('''import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET
  const key = process.env.FLASK_INTERNAL_KEY
  const api = process.env.FLASK_API_URL
  if (!secret || !key || !api) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const raw = await req.text()
  const parts = Object.fromEntries((req.headers.get('paymongo-signature') || '').split(',').map(s => s.trim().split('=',2)))
  const ts = Number(parts.t)
  if (!Number.isFinite(ts) || Math.abs(Date.now()/1000 - ts) > 300) return NextResponse.json({ error: 'Expired signature' }, { status: 401 })
  // TEST mode only. Reject all live-mode signatures.
  const expected = createHmac('sha256', secret).update(`${parts.t}.${raw}`).digest('hex')
  const actual = parts.te || ''
  const good = actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  if (!good) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  let obj: any
  try { obj = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  // Support the new Payment Channels event envelope and the legacy event envelope.
  const event = obj?.data?.type === 'checkout_session.payment.paid' ? obj.data : obj?.data?.attributes
  if (event?.livemode !== false) return NextResponse.json({ error: 'Only test mode supported' }, { status: 400 })
  if (event?.type !== 'checkout_session.payment.paid') return NextResponse.json({ received: true })
  const sessionId = event?.data?.id
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) return NextResponse.json({ error: 'Session missing' }, { status: 400 })
  try {
    const upstream = await fetch(new URL('/api/paymongo/confirm-internal', api), {
      method:'POST', headers: {'Content-Type':'application/json','X-Internal-Key':key,'X-User-Role':'PAYMONGO_WEBHOOK'},
      body:JSON.stringify({checkoutSessionId: sessionId}), cache:'no-store',
    })
    if (!upstream.ok) return NextResponse.json({ error: 'Confirmation pending' }, { status: 503 })
    return NextResponse.json({ received: true })
  } catch { return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 }) }
}
''',encoding='utf-8')
print('Applied. Restart Flask and Next.js. New route: src/app/api/paymongo/webhook/route.ts')
