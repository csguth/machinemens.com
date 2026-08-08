// PayPal REST v2 Checkout Orders integration ("advanced"/server-side flow:
// https://developer.paypal.com/docs/checkout/advanced/). The Worker creates
// and captures the order itself so the charged amount is always derived from
// the server-trusted catalog (src/catalog.js), never from client-supplied
// prices -- the frontend only ever sees the PayPal order id.
async function getAccessToken(env) {
  const credentials = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${env.PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${res.status}`);
  }
  const data = await res.json();
  return data.access_token;
}

// Creates a PayPal order for the given trusted lines/shipping fee. itemNames
// is an optional id -> display name map (untrusted, cosmetic only -- shown in
// the PayPal review UI, never used to compute amounts).
export async function createPaypalOrder(env, { lines, subtotal, shippingFee, itemNames }) {
  const accessToken = await getAccessToken(env);
  const total = subtotal + shippingFee;
  const res = await fetch(`${env.PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            value: total.toFixed(2),
            currency_code: 'EUR',
            breakdown: {
              item_total: { value: subtotal.toFixed(2), currency_code: 'EUR' },
              shipping: { value: shippingFee.toFixed(2), currency_code: 'EUR' }
            }
          },
          items: lines.map((line) => ({
            name: (itemNames && itemNames[line.id]) || line.id,
            unit_amount: { value: line.price.toFixed(2), currency_code: 'EUR' },
            quantity: String(line.qty)
          }))
        }
      ]
    })
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayPal order creation failed: ${res.status} ${body}`);
  }
  return res.json();
}

// Captures an approved order. Returns the authoritative captured order,
// including the payer's shipping address, which is used to build the
// Printful recipient (never trust an address supplied by the client).
export async function capturePaypalOrder(env, orderId) {
  const accessToken = await getAccessToken(env);
  const res = await fetch(`${env.PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`PayPal capture failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

// Extracts a Printful-shaped recipient from a captured PayPal order response.
export function recipientFromCapture(capturedOrder) {
  const unit = capturedOrder.purchase_units && capturedOrder.purchase_units[0];
  const shipping = unit && unit.shipping;
  const address = shipping && shipping.address;
  const payer = capturedOrder.payer || {};
  if (!address) {
    throw new Error('Captured PayPal order has no shipping address');
  }
  const name =
    (shipping.name && shipping.name.full_name) ||
    [payer.name && payer.name.given_name, payer.name && payer.name.surname].filter(Boolean).join(' ') ||
    'Machinemens customer';
  return {
    name,
    address1: address.address_line_1,
    address2: address.address_line_2 || undefined,
    city: address.admin_area_2,
    state_code: address.admin_area_1 || undefined,
    country_code: address.country_code,
    zip: address.postal_code,
    email: payer.email_address
  };
}
