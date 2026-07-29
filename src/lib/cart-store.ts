"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  product_id: string;
  slug: string;
  name: string;
  price_cents: number;
  image: string;
  quantity: number;
  stock: number;
  /** Pedido mínimo do produto (copiado no momento de adicionar ao carrinho). */
  min_order: number | null;
  min_order_value_cents: number | null;
}

function minQtyFor(item: Pick<CartItem, "min_order" | "min_order_value_cents" | "price_cents">): number {
  if (item.min_order && item.min_order > 0) return item.min_order;
  if (item.min_order_value_cents && item.price_cents > 0) {
    return Math.ceil(item.min_order_value_cents / item.price_cents);
  }
  return 1;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  subtotalCents: () => number;
  totalItems: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item, quantity = 1) => {
        set((state) => {
          const minQty = minQtyFor(item);
          const requestedQty = Math.max(quantity, minQty);
          const existing = state.items.find(
            (i) => i.product_id === item.product_id
          );
          if (existing) {
            const nextQty = Math.min(
              existing.quantity + requestedQty,
              existing.stock
            );
            return {
              items: state.items.map((i) =>
                i.product_id === item.product_id
                  ? { ...i, quantity: nextQty }
                  : i
              ),
              isOpen: true,
            };
          }
          return {
            items: [
              ...state.items,
              { ...item, quantity: Math.min(requestedQty, item.stock) },
            ],
            isOpen: true,
          };
        });
      },

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.product_id !== productId),
        })),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.product_id === productId
                ? { ...i, quantity: Math.max(minQtyFor(i), Math.min(quantity, i.stock)) }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),

      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),

      subtotalCents: () =>
        get().items.reduce(
          (sum, i) => sum + i.price_cents * i.quantity,
          0
        ),

      totalItems: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: "plin-designs-cart" }
  )
);
