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
function shopPage(productNames) {
  return {
    products: [],
    cart: {},
    checkoutComplete: false,
    selectedSize: {},
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
    formatPrice(value) {
      return '€' + value.toFixed(2).replace(/\.00$/, '');
    },
    // The PayPal SDK script (loaded with `defer`) may not be ready yet when
    // Alpine mounts, so poll briefly rather than assuming it's available.
    waitForPaypal(callback, attempt) {
      attempt = attempt || 0;
      if (typeof window.paypal !== 'undefined') {
        callback();
      } else if (attempt < 40) {
        setTimeout(() => this.waitForPaypal(callback, attempt + 1), 250);
      }
    },
    // Buttons only need to be rendered ONCE per checkout session -- createOrder
    // below reads this.cartItems/this.cartTotal live at click time, so it always
    // reflects the latest cart contents without re-rendering. Calling
    // paypal.Buttons(...).render() again on the same mount point while a prior
    // render is still settling causes a race (the SDK errors when a container is
    // rendered twice), which was hiding the button until a second cart change
    // happened to "win" the race. Guard with paypalRendered instead.
    maybeRenderPaypalButtons() {
      const container = document.getElementById('paypal-buttons');
      if (this.cartItems.length === 0) {
        this.paypalRendered = false;
        if (container) container.innerHTML = '';
        return;
      }
      if (this.paypalRendered) return;
      this.waitForPaypal(() => this.renderPaypalButtons());
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
          const total = this.cartTotal;
          return actions.order.create({
            purchase_units: [{
              amount: {
                value: total.toFixed(2),
                currency_code: 'EUR',
                breakdown: {
                  item_total: { value: total.toFixed(2), currency_code: 'EUR' }
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