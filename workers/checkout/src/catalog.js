// Fetches the *authoritative* product catalog from the live site's own
// data/products.json (SITE_URL env var -- production or staging, matching
// this Worker's environment). This keeps prices and Printful sync_variant_ids
// in exactly one place (the same JSON the /shop/ page renders from) instead
// of duplicating them inside the Worker, so a price change never needs a
// Worker redeploy.
//
// Never trust price/variant data coming from the frontend request body --
// only the id/size/qty selections are taken from the client; everything
// money-related is re-derived here from the server-fetched catalog.
let cachedCatalog = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

async function fetchCatalog(env) {
  const now = Date.now();
  if (cachedCatalog && now - cachedAt < CACHE_TTL_MS) {
    return cachedCatalog;
  }
  const res = await fetch(`${env.SITE_URL}/data/products.json`, {
    cf: { cacheTtl: 60, cacheEverything: true }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch product catalog: ${res.status}`);
  }
  const catalog = await res.json();
  cachedCatalog = catalog;
  cachedAt = now;
  return catalog;
}

// Resolves+validates the requested cart lines against the trusted catalog.
// requestedItems: [{ id, size, qty }] (client-supplied, untrusted).
// Returns { lines, subtotal } where each line carries the server-trusted
// price and Printful sync_variant_id, or throws with a user-safe message.
export async function resolveOrderLines(env, requestedItems) {
  if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
    throw new Error('Cart is empty');
  }
  const catalog = await fetchCatalog(env);
  const lines = requestedItems.map(({ id, size, qty }) => {
    const product = catalog.find((p) => p.id === id);
    if (!product) throw new Error(`Unknown product: ${id}`);
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid quantity for product: ${id}`);
    }
    let variantId = null;
    if (product.sizes && product.sizes.length) {
      if (!size || !product.sizes.includes(size)) {
        throw new Error(`Invalid size for product: ${id}`);
      }
      variantId = product.printfulVariants && product.printfulVariants[size];
      if (!variantId) {
        throw new Error(`Product not yet available for order: ${id} (${size})`);
      }
    }
    return {
      id,
      size: size || null,
      qty: quantity,
      price: product.price,
      printfulVariantId: variantId
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  return { lines, subtotal };
}

export function getShippingFee(env) {
  return Number(env.SHIPPING_FEE_NL);
}
