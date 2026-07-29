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
  min_order?: number | null;
  min_order_value_cents?: number | null;
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
          const minQty = item.min_order ?? 1;
          const existing = state.items.find(
            (i) => i.product_id === item.product_id
          );
          if (existing) {
            const nextQty = Math.min(
              Math.max(existing.quantity + quantity, minQty),
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
              { ...item, quantity: Math.min(Math.max(quantity, minQty), item.stock) },
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
            .map((i) => {
              if (i.product_id !== productId) return i;
              const minQty = i.min_order ?? 1;
              // Abaixo do mínimo, some da lista (equivale a "remover") em vez de
              // ficar preso num valor inválido — evita o usuário travado tentando
              // decrementar um botão que nunca desce do mínimo.
              if (quantity < minQty) return { ...i, quantity: 0 };
              return { ...i, quantity: Math.min(quantity, i.stock) };
            })
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
