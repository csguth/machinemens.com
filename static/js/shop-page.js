// Alpine component for the /shop/ page (static/js/shop-page.js).
// Fetches the product catalog from data/products.json and merges in each
// product's Hugo-rendered i18n name (passed in from layouts/shop/list.html
// as `productNames`, keeping translations compile-time like the rest of the
// site). Cart state lives in the shared cart-store.js (localStorage).
//
// PayPal JS SDK Smart Buttons render client-side, but order creation/capture
// happen server-side in the checkout Worker (workers/checkout/) so the
// charged amount is always re-derived from the trusted catalog, never from
// this file -- and so a successful payment can automatically create a
// Printful (print-on-demand) draft order for fulfillment. See issue #124.
//
// Products with a `sizes` array (e.g. t-shirts) require a size to be picked
// before adding to cart. cart-store.js itself stays size-agnostic: it just
// stores arbitrary string keys -> quantity, so each product+size combination
// is stored under a composite key (`${productId}::${size}`), keeping the
// same product available in multiple sizes as separate cart lines.
//
// SHIPPING_FEE is a flat rate added to every order -- it only covers shipping
// within the Netherlands (see shippingCountry below). International/Brazil
// shipping is currently priced/handled manually (no automated way to
// calculate a per-country rate table or collect/validate a real address), so
// those orders are routed to a manual contact instead of the PayPal checkout.
// Adjust this constant (and the shipping_label i18n string if the wording
// needs to change) as the band's actual NL shipping cost becomes clearer --
// and keep it in sync with SHIPPING_FEE_NL in workers/checkout/wrangler.toml,
// which independently re-derives the same fee server-side.
const SHIPPING_FEE = 4.95;

// Set this to a WhatsApp number (digits only, with country code, e.g.
// "31612345678") to show a WhatsApp link for international/Brazil orders
// alongside the contact email below. Left empty until a number is provided --
// the template only renders the WhatsApp link when this is non-empty, so it
// never shows a broken/placeholder link.
const WHATSAPP_NUMBER = '';
const CONTACT_EMAIL = 'contact@machinemens.com';

function shopPage({ productNames, checkoutApiUrl }) {
  return {
    products: [],
    cart: {},
    checkoutComplete: false,
    checkoutError: null,
    selectedSize: {},
    shippingFee: SHIPPING_FEE,
    // Base URL of the checkout Worker (workers/checkout/), injected at build
    // time via the __CHECKOUT_API_URL__ placeholder in layouts/shop/list.html
    // (same substitution mechanism as __SITE_URL__/__PAYPAL_CLIENT_ID__).
    checkoutApiUrl,
    // Checkout via PayPal is only offered for shipments within the
    // Netherlands (matches SHIPPING_FEE, which is an NL-only flat rate).
    // Buyers elsewhere are shown a manual-contact message instead, since
    // pricing/collecting a real international/Brazil shipping rate would
    // need either a backend or PayPal's onShippingChange flow.
    shippingCountry: 'nl',
    contactEmail: CONTACT_EMAIL,
    whatsappLink: WHATSAPP_NUMBER ? 'https://wa.me/' + WHATSAPP_NUMBER : null,
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
        // After a completed order the cart is cleared and the success
        // message takes over the cart section. If the buyer then adds new
        // items (starting a new order), bring the cart/checkout UI back
        // instead of leaving the order-complete message stuck on screen
        // forever until a full page reload.
        if (this.checkoutComplete && Object.keys(this.cart).length > 0) {
          this.checkoutComplete = false;
        }
        this.maybeRenderPaypalButtons();
      });
      // Switching the shipping-country selector doesn't fire cart:updated,
      // so it needs its own watcher to show/hide the PayPal buttons.
      this.$watch('shippingCountry', () => this.maybeRenderPaypalButtons());
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
    // Whether PayPal checkout should be offered at all: needs items in the
    // cart AND the buyer confirming NL shipping (see shippingCountry above).
    get canCheckout() {
      return this.cartItems.length > 0 && this.shippingCountry === 'nl';
    },
    formatPrice(value) {
      return '€' + value.toFixed(2).replace(/\.00$/, '');
    },
    // Two async gaps must both close before we can render: (1) the PayPal SDK
    // script (loaded with `defer`) may not have executed yet, and (2) the
    // #paypal-buttons element only exists once Alpine's x-if has patched the
    // DOM for `canCheckout` -- and Alpine flushes that DOM patch on
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
      if (!this.canCheckout) {
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
      if (!this.canCheckout) return;
      this.paypalRendered = true;

      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'paypal' },
        // Order creation AND capture both happen server-side in the checkout
        // Worker (workers/checkout/): the amount charged is always re-derived
        // there from the trusted product catalog, never from this file, and
        // a successful capture automatically creates the Printful (POD)
        // draft order. Only the id/size/qty selections are sent here --
        // prices/names are cosmetic-only display data for PayPal's own UI.
        createOrder: async () => {
          this.checkoutError = null;
          const items = this.cartItems;
          const res = await fetch(this.checkoutApiUrl + '/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: items.map((item) => ({ id: item.id, size: item.size, qty: item.qty })),
              shippingCountry: this.shippingCountry,
              itemNames: items.reduce((names, item) => {
                names[item.id] = item.name;
                return names;
              }, {})
            })
          });
          if (!res.ok) throw new Error('Failed to create order');
          const order = await res.json();
          return order.id;
        },
        onApprove: async (data) => {
          const res = await fetch(this.checkoutApiUrl + '/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderID: data.orderID })
          });
          const result = await res.json();
          if (!res.ok || !result.success) {
            this.checkoutError = true;
            return;
          }
          window.MachinemensCart.clear();
          this.checkoutComplete = true;
        },
        onError: () => {
          this.checkoutError = true;
        }
      }).render('#paypal-buttons');
    }
  };
}