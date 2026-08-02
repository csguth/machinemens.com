// Alpine component for the /shop/ page (static/js/shop-page.js).
// Fetches the product catalog from data/products.json and merges in each
// product's Hugo-rendered i18n name (passed in from layouts/shop/list.html
// as `productNames`, keeping translations compile-time like the rest of the
// site). Cart state lives in the shared cart-store.js (localStorage), and
// checkout renders PayPal JS SDK Smart Buttons entirely client-side from the
// cart's contents -- no backend/order-management service (per issue #3).
//
// Products with a `sizes` array (e.g. t-shirts) require a size to be picked
// before adding to cart. cart-store.js itself stays size-agnostic: it just
// stores arbitrary string keys -> quantity, so each product+size combination
// is stored under a composite key (`${productId}::${size}`), keeping the
// same product available in multiple sizes as separate cart lines.
//
// SHIPPING_FEE is a flat rate added to every order (regardless of destination
// or item count) -- kept intentionally simple/static rather than a per-country
// rate table, since a dynamic rate would need PayPal's onShippingChange +
// actions.order.patch() flow (recalculating the order after the buyer picks
// their address inside the PayPal popup), which is harder to verify without
// live/manual testing of the checkout popup. Adjust this constant (and the
// shipping_label i18n string if the wording needs to change) as the band's
// actual shipping costs become clearer; swap to a country-based table later
// if needed.
const SHIPPING_FEE = 4.95;

function shopPage(productNames) {
  return {
    products: [],
    cart: {},
    checkoutComplete: false,
    selectedSize: {},
    shippingFee: SHIPPING_FEE,
    async init() {
      const res = await fetch('/data/products.json');
      const data = await res.json();
      this.products = data.map((product) => ({
        ...product,
        name: productNames[product.id] || product.id
      }));
      this.products.forEach((product) => {
        if (product.sizes && product.sizes.length) {
          this.selectedSize[product.id] = product.sizes[0];
        }
      });
      this.cart = window.MachinemensCart.get();
      this.paypalRendered = false;
      window.addEventListener('cart:updated', (event) => {
        this.cart = event.detail;
        this.maybeRenderPaypalButtons();
      });
      this.maybeRenderPaypalButtons();
    },
    // Builds the cart-store key for a product+size combination. Products
    // without sizes just use their own id as the key.
    cartKey(productId, size) {
      return size ? productId + '::' + size : productId;
    },
    addToCart(productId) {
      const size = this.selectedSize[productId];
      window.MachinemensCart.add(this.cartKey(productId, size), 1);
    },
    setQty(cartKey, qty) {
      window.MachinemensCart.setQty(cartKey, Number(qty));
    },
    removeFromCart(cartKey) {
      window.MachinemensCart.remove(cartKey);
    },
    get cartItems() {
      return Object.entries(this.cart)
        .map(([cartKey, qty]) => {
          const [productId, size] = cartKey.split('::');
          const product = this.products.find((p) => p.id === productId);
          return product ? { ...product, qty, size: size || null, cartKey } : null;
        })
        .filter(Boolean);
    },
    get cartTotal() {
      return this.cartItems.reduce((sum, item) => sum + item.qty * item.price, 0);
    },
    get orderTotal() {
      return this.cartTotal + this.shippingFee;
    },
    formatPrice(value) {
      return '€' + value.toFixed(2).replace(/\.00$/, '');
    },
    // Two async gaps must both close before we can render: (1) the PayPal SDK
    // script (loaded with `defer`) may not have executed yet, and (2) the
    // #paypal-buttons element only exists once Alpine's x-if has patched the
    // DOM for `cartItems.length > 0` -- and Alpine flushes that DOM patch on
    // a microtask, *after* this event listener finishes running, so looking
    // it up with document.getElementById() immediately after `this.cart = ...`
    // returns null on the very first item added. That is why the button used
    // to only show up once a *second* cart change happened to "win" the race
    // (by then the first item's DOM patch had already settled). Poll for both
    // conditions instead of assuming either is ready synchronously.
    waitForPaypalAndContainer(callback, attempt) {
      attempt = attempt || 0;
      const container = document.getElementById('paypal-buttons');
      if (container && typeof window.paypal !== 'undefined') {
        callback(container);
      } else if (attempt < 60) {
        setTimeout(() => this.waitForPaypalAndContainer(callback, attempt + 1), 100);
      }
    },
    // Buttons only need to be rendered ONCE per checkout session -- createOrder
    // below reads this.cartItems/this.cartTotal live at click time, so it always
    // reflects the latest cart contents without re-rendering. Calling
    // paypal.Buttons(...).render() again on the same mount point while a prior
    // render is still settling causes a race (the SDK errors when a container is
    // rendered twice), so re-renders are guarded by paypalRendered too.
    maybeRenderPaypalButtons() {
      if (this.cartItems.length === 0) {
        this.paypalRendered = false;
        const container = document.getElementById('paypal-buttons');
        if (container) container.innerHTML = '';
        return;
      }
      if (this.paypalRendered) return;
      this.waitForPaypalAndContainer(() => this.renderPaypalButtons());
    },
    renderPaypalButtons() {
      const container = document.getElementById('paypal-buttons');
      if (!container || typeof window.paypal === 'undefined' || this.paypalRendered) return;
      if (this.cartItems.length === 0) return;
      this.paypalRendered = true;

      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'paypal' },
        createOrder: (data, actions) => {
          const items = this.cartItems;
          const subtotal = this.cartTotal;
          const shipping = this.shippingFee;
          const total = subtotal + shipping;
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: total.toFixed(2),
                currency_code: 'EUR',
                breakdown: {
                  item_total: { value: subtotal.toFixed(2), currency_code: 'EUR' },
                  shipping: { value: shipping.toFixed(2), currency_code: 'EUR' }
                }
              },
              items: items.map((item) => ({
                name: item.size ? item.name + ' (' + item.size + ')' : item.name,
                unit_amount: { value: item.price.toFixed(2), currency_code: 'EUR' },
                quantity: String(item.qty)
              }))
            }]
          });
        },
        onApprove: (data, actions) => {
          return actions.order.capture().then(() => {
            window.MachinemensCart.clear();
            this.checkoutComplete = true;
          });
        }
      }).render('#paypal-buttons');
    }
  };
}