// Fallback notification via Resend (https://resend.com/docs/api-reference/emails/send-email),
// sent only when a payment was captured successfully but creating the
// Printful draft order failed -- the band needs to know to create that order
// manually, since the customer has already paid and must not see an error.
export async function sendFallbackEmail(env, { paypalOrderId, recipient, lines, printfulError }) {
  const itemsList = lines
    .map((line) => `- ${line.id}${line.size ? ` (${line.size})` : ''} x${line.qty}`)
    .join('\n');
  const text = [
    'A Printful draft order could not be created automatically after a PayPal payment was captured.',
    'Please create this order manually in the Printful dashboard.',
    '',
    `PayPal order id: ${paypalOrderId}`,
    `Printful error: ${printfulError}`,
    '',
    'Recipient:',
    `${recipient.name}`,
    `${recipient.address1}${recipient.address2 ? ', ' + recipient.address2 : ''}`,
    `${recipient.city}${recipient.state_code ? ', ' + recipient.state_code : ''} ${recipient.zip}`,
    `${recipient.country_code}`,
    recipient.email ? `Email: ${recipient.email}` : '',
    '',
    'Items:',
    itemsList
  ]
    .filter((line) => line !== '')
    .join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: env.CONTACT_EMAIL,
      subject: `[shop] Manual Printful order needed - PayPal order ${paypalOrderId}`,
      text
    })
  });
  if (!res.ok) {
    // Nothing else to fall back to -- log so it at least shows up in
    // `wrangler tail`/Cloudflare logs for manual follow-up.
    console.error('Resend fallback email failed', res.status, await res.text());
  }
}
