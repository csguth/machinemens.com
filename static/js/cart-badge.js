// Alpine component for the header cart badge (mounted in
// layouts/partials/header.html on every page, not just /shop/), so the cart
// count stays visible while browsing. Reads from the shared cart-store.js
// and re-renders on the 'cart:updated' event plus cross-tab 'storage' events.
function cartBadge() {
  return {
    count: 0,
    init() {
      this.count = window.MachinemensCart.count();
      window.addEventListener('cart:updated', () => {
        this.count = window.MachinemensCart.count();
      });
      window.addEventListener('storage', (event) => {
        if (event.key === 'machinemens_cart') {
          this.count = window.MachinemensCart.count();
        }
      });
    }
  };
}