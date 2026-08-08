// Cloudflare Worker backing /shop/'s checkout. Two endpoints, both POST/JSON:
//   /paypal/create-order  - server creates the PayPal order from a trusted
//                            re-pricing of the cart (see src/catalog.js)
//   /paypal/capture-order - server captures the approved order, then creates
//                            a Printful draft order (dropship fulfillment),
//                            falling back to an email alert if that fails
//
// See workers/checkout/README.md for local dev/deploy instructions, and the
// closed technical plan on issue #124 for the rationale behind each
// decision (draft orders, KV idempotency, Resend fallback).
import { corsHeaders, jsonResponse } from './cors.js';
import { resolveOrderLines, getShippingFee } from './catalog.js';
import { createPaypalOrder, capturePaypalOrder, recipientFromCapture } from './paypal.js';
import { createPrintfulDraftOrder } from './printful.js';
import { sendFallbackEmail } from './email.js';

async function handleCreateOrder(request, env) {
  const body = await request.json();
  if (body.shippingCountry !== 'nl') {
    return jsonResponse({ error: 'Only NL shipping is supported for checkout' }, 400, request, env);
  }
  const { lines, subtotal } = await resolveOrderLines(env, body.items);
  const shippingFee = getShippingFee(env);
  const order = await createPaypalOrder(env, {
    lines,
    subtotal,
    shippingFee,
    itemNames: body.itemNames
  });

  // Store the trusted line items now, keyed by the PayPal order id, so
  // capture-order never has to re-trust anything from the client -- it just
  // looks this record back up. Also doubles as the idempotency record.
  await env.ORDERS_KV.put(
    `order:${order.id}`,
    JSON.stringify({
      status: 'created',
      lines,
      shippingCountry: body.shippingCountry,
      subtotal,
      shippingFee,
      createdAt: new Date().toISOString()
    }),
    { expirationTtl: 60 * 60 * 24 * 30 } // 30 days is plenty to investigate any issue
  );

  return jsonResponse({ id: order.id }, 200, request, env);
}

async function handleCaptureOrder(request, env) {
  const { orderID } = await request.json();
  if (!orderID) {
    return jsonResponse({ error: 'Missing orderID' }, 400, request, env);
  }

  const recordRaw = await env.ORDERS_KV.get(`order:${orderID}`);
  if (!recordRaw) {
    return jsonResponse({ error: 'Unknown order' }, 404, request, env);
  }
  const record = JSON.parse(recordRaw);

  // Idempotent short-circuit: onApprove can legitimately fire more than once
  // (double click, retry after a flaky network response) -- never capture or
  // create a Printful order twice for the same PayPal order id.
  if (record.status === 'fulfilled' || record.status === 'email_fallback') {
    return jsonResponse({ success: true }, 200, request, env);
  }

  const capturedOrder = await capturePaypalOrder(env, orderID);
  const captureStatus =
    capturedOrder.status ||
    capturedOrder.purchase_units?.[0]?.payments?.captures?.[0]?.status;
  if (captureStatus !== 'COMPLETED') {
    throw new Error(`Unexpected PayPal capture status: ${captureStatus}`);
  }

  const recipient = recipientFromCapture(capturedOrder);

  try {
    const printfulOrder = await createPrintfulDraftOrder(env, { recipient, lines: record.lines });
    record.status = 'fulfilled';
    record.printfulOrderId = printfulOrder.id;
  } catch (printfulError) {
    // Payment already succeeded -- never surface this as a failure to the
    // customer. Alert the band by email so the order can be entered manually.
    console.error('Printful order creation failed', printfulError);
    await sendFallbackEmail(env, {
      paypalOrderId: orderID,
      recipient,
      lines: record.lines,
      printfulError: printfulError.message
    });
    record.status = 'email_fallback';
  }

  await env.ORDERS_KV.put(`order:${orderID}`, JSON.stringify(record), {
    expirationTtl: 60 * 60 * 24 * 30
  });

  return jsonResponse({ success: true }, 200, request, env);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request, env) });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, request, env);
    }

    const { pathname } = new URL(request.url);
    try {
      if (pathname === '/paypal/create-order') {
        return await handleCreateOrder(request, env);
      }
      if (pathname === '/paypal/capture-order') {
        return await handleCaptureOrder(request, env);
      }
      return jsonResponse({ error: 'Not found' }, 404, request, env);
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: error.message }, 400, request, env);
    }
  }
};
