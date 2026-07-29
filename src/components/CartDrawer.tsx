"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatBRL } from "@/lib/shipping";

export default function CartDrawer() {
  const { items, isOpen, close, removeItem, setQuantity, subtotalCents } =
    useCartStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        aria-label="Fechar carrinho"
        onClick={close}
        className="absolute inset-0 bg-ink/40"
      />

      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-pink-100 p-4">
          <h2 className="font-display text-lg text-ink">Seu carrinho</h2>
          <button
            onClick={close}
            aria-label="Fechar"
            className="rounded-full p-2 hover:bg-pink-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-ink-soft">
            <ShoppingBag className="h-10 w-10 text-pink-300" />
            <p>Seu carrinho está vazio por enquanto.</p>
            <Link
              href="/produtos"
              onClick={close}
              className="mt-2 rounded-full bg-pink-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-lilac-500"
            >
              Ver produtos
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <ul className="flex flex-col gap-4">
                {items.map((item) => (
                  <li key={item.product_id} className="flex gap-3">
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-pink-50">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <p className="text-sm font-medium text-ink">
                        {item.name}
                      </p>
                      <p className="text-sm text-pink-600">
                        {formatBRL(item.price_cents)}
                      </p>
                      <div className="mt-auto flex items-center gap-2">
                        <button
                          onClick={() =>
                            setQuantity(item.product_id, item.quantity - 1)
                          }
                          aria-label="Diminuir quantidade"
                          className="rounded-full border border-pink-200 p-1 hover:bg-pink-50"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            setQuantity(item.product_id, item.quantity + 1)
                          }
                          aria-label="Aumentar quantidade"
                          disabled={item.quantity >= item.stock}
                          className="rounded-full border border-pink-200 p-1 hover:bg-pink-50 disabled:opacity-30"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeItem(item.product_id)}
                          className="ml-2 text-xs text-ink-soft underline hover:text-pink-600"
                        >
                          remover
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-pink-100 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-ink-soft">Subtotal</span>
                <span className="text-lg font-semibold text-ink">
                  {formatBRL(subtotalCents())}
                </span>
              </div>
              <p className="mb-3 text-xs text-ink-soft">
                Frete calculado na próxima etapa.
              </p>
              <Link
                href="/checkout"
                onClick={close}
                className="block w-full rounded-full bg-pink-500 py-3 text-center font-semibold text-white transition-colors hover:bg-lilac-500"
              >
                Fechar pedido
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
