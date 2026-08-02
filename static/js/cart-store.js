// Shared shopping-cart storage, used by both the header cart badge (every
// page) and the /shop/ page's Alpine component. Plain localStorage-backed
// cart keyed by product id -> quantity (no framework), broadcasting a
// 'cart:updated' window CustomEvent so every mounted component stays in
// sync within the same tab; the native 'storage' event keeps other tabs in
// sync too (see cart-badge.js / shop-page.js listeners).
(function () {
  const STORAGE_KEY = 'machinemens_cart';

  function readCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
  }

  window.MachinemensCart = {
    get() {
      return readCart();
    },
    count() {
      return Object.values(readCart()).reduce((sum, qty) => sum + qty, 0);
    },
    add(productId, qty) {
      const cart = readCart();
      cart[productId] = (cart[productId] || 0) + (qty || 1);
      writeCart(cart);
    },
    setQty(productId, qty) {
      const cart = readCart();
      if (qty <= 0) {
        delete cart[productId];
      } else {
        cart[productId] = qty;
      }
      writeCart(cart);
    },
    remove(productId) {
      const cart = readCart();
      delete cart[productId];
      writeCart(cart);
    },
    clear() {
      writeCart({});
    }
  };
})();