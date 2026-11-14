import { writable, derived } from 'svelte/store';

const CART_KEY = 'maska-cart-items';

function createCartStore() {
  const isBrowser = typeof window !== 'undefined';
  let initial = [];
  if (isBrowser) {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (saved) initial = JSON.parse(saved);
    } catch (e) {}
  }

  const { subscribe, set, update } = writable(initial);

  function persist(items) {
    if (isBrowser) {
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(items));
      } catch (e) {}
    }
  }

  return {
    subscribe,
    addItem(product) {
      update(items => {
        const id = product.id || ('p-' + Date.now());
        const existingIndex = items.findIndex(i => i.id === id);

        let newItems;
        if (existingIndex > -1 && !product.isCustom) {
          newItems = [...items];
          newItems[existingIndex].quantity += (product.quantity || 1);
        } else {
          newItems = [
            ...items,
            {
              id,
              title: product.title || product.name || 'باقة مسكة',
              price: Number(product.price) || 0,
              quantity: product.quantity || 1,
              image: product.image || '/assets/bouquet-sage-whisper.svg',
              isCustom: !!product.isCustom,
              wrapType: product.wrapType || '',
              ribbonColor: product.ribbonColor || '',
              waxSealText: product.waxSealText || '',
              flowers: product.flowers || []
            }
          ];
        }
        persist(newItems);
        return newItems;
      });
    },

    removeItem(id) {
      update(items => {
        const newItems = items.filter(i => i.id !== id);
        persist(newItems);
        return newItems;
      });
    },

    updateQuantity(id, newQty) {
      update(items => {
        let newItems;
        if (newQty <= 0) {
          newItems = items.filter(i => i.id !== id);
        } else {
          newItems = items.map(i => i.id === id ? { ...i, quantity: newQty } : i);
        }
        persist(newItems);
        return newItems;
      });
    },

    clearCart() {
      persist([]);
      set([]);
    }
  };
}

export const cart = createCartStore();

export const cartCount = derived(cart, $cart => {
  return $cart.reduce((sum, item) => sum + item.quantity, 0);
});

export const cartSubtotal = derived(cart, $cart => {
  return $cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
});

