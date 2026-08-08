// Printful API v1 (https://developers.printful.com/docs/) order creation.
// Orders are created with confirm: false (draft) per the closed technical
// plan on issue #124 -- someone from the band reviews and confirms each
// order in the Printful dashboard before it's produced/charged, as a safety
// net during the initial rollout.
export async function createPrintfulDraftOrder(env, { recipient, lines }) {
  const res = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipient,
      items: lines.map((line) => ({
        sync_variant_id: line.printfulVariantId,
        quantity: line.qty
      })),
      confirm: false
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Printful order creation failed: ${res.status} ${JSON.stringify(data)}`);
  }
  return data.result;
}
