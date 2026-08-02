// Alpine component for the /shop/ page (static/js/shop-page.js).
// Fetches the product catalog from data/products.json and merges in each
// product's Hugo-rendered i18n name (passed in from layouts/shop/list.html
// as `productNames`, keeping translations compile-time like the rest of the
// site). Cart state lives in the shared cart-store.js (localStorage), and
// checkout renders PayPal JS SDK Smart Buttons entirely client-side from the
// cart's contents -- no backend/order-management service (per issue #3).
function shopPage(productNames) {
  return {
    products: [],
    cart: {},
    checkoutComplete: false,
    async init() {
      const res = await fetch('/data/products.json');
      const data = await res.json();
      this.products = data.map((product) => ({
        ...product,
        name: productNames[product.id] || product.id
      }));
      this.cart = window.MachinemensCart.get();
      window.addEventListener('cart:updated', (event) => {
        this.cart = event.detail;
        this.waitForPaypal(() => this.renderPaypalButtons());
      });
      this.waitForPaypal(() => this.renderPaypalButtons());
    },
    addToCart(productId) {
      window.MachinemensCart.add(productId, 1);
    },
    setQty(productId, qty) {
      window.MachinemensCart.setQty(productId, Number(qty));
    },
    removeFromCart(productId) {
      window.MachinemensCart.remove(productId);
    },
    get cartItems() {
      return Object.entries(this.cart)
        .map(([id, qty]) => {
          const product = this.products.find((p) => p.id === id);
          return product ? { ...product, qty } : null;
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
    renderPaypalButtons() {
      const container = document.getElementById('paypal-buttons');
      if (!container || typeof window.paypal === 'undefined') return;
      container.innerHTML = '';
      if (this.cartItems.length === 0) return;

      const items = this.cartItems;
      const total = this.cartTotal;

      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'paypal' },
        createOrder: (data, actions) => {
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
                name: item.name,
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