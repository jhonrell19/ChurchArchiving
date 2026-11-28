/**
 * A PayMongo sandbox result is useful for workflow testing, but does not
 * represent money received by the parish. Keep the raw DB paymentStatus
 * untouched for audit/ledger integrity; derive the UI label and release gate.
 * Flask independently rejects test-mode release in production.
 */
export const isTestCertificatePayment = (paymentMethod?: string | null): boolean => {
  const method = (paymentMethod || '').toUpperCase()
  return method === 'DEMO' || method.startsWith('PAYMONGO_TEST')
}

export const isConfirmedCertificatePayment = (
  paymentStatus?: string | null,
  paymentMethod?: string | null,
): boolean => paymentStatus === 'Paid' && !isTestCertificatePayment(paymentMethod)

export const certificatePaymentLabel = (
  paymentStatus?: string | null,
  paymentMethod?: string | null,
): string => {
  if (paymentStatus === 'Paid' && isTestCertificatePayment(paymentMethod)) {
    return 'Test payment — no real funds'
  }
  return paymentStatus || 'Unpaid'
}
