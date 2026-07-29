"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { Product } from "@/lib/types";
import { useCartStore } from "@/lib/cart-store";
import { formatBRL } from "@/lib/shipping";
import { getMinQuantity, meetsMinOrder } from "@/lib/min-order";

export default function ProductDetailActions({
  product,
}: {
  product: Product;
}) {
  const minQty = getMinQuantity(product);
  const [qty, setQty] = useState(minQty);
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.open);
  const outOfStock = product.stock <= 0;
  const ok = meetsMinOrder(product, qty);

  return (
    <div className="mt-6 flex flex-col gap-2">
      {product.min_order_value_cents && (
        <p className="text-xs text-ink-soft">
          Pedido mínimo para este produto:{" "}
          <span className="font-semibold text-pink-600">
            {formatBRL(product.min_order_value_cents)}
          </span>{" "}
          ({minQty} un. ou mais, no preço atual)
        </p>
      )}
      {product.min_order && (
        <p className="text-xs text-ink-soft">
          Pedido mínimo para este produto:{" "}
          <span className="font-semibold text-pink-600">{product.min_order} unidades</span>
        </p>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-full border border-pink-200">
          <button
            onClick={() => setQty((q) => Math.max(minQty, q - 1))}
            className="p-3 hover:bg-pink-50"
            aria-label="Diminuir quantidade"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
            className="p-3 hover:bg-pink-50"
            aria-label="Aumentar quantidade"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          disabled={outOfStock || !ok}
          onClick={() => {
            addItem(
              {
                product_id: product.id,
                slug: product.slug,
                name: product.name,
                price_cents: product.price_cents,
                image: product.images[0],
                stock: product.stock,
                min_order: product.min_order,
                min_order_value_cents: product.min_order_value_cents,
              },
              qty
            );
            openCart();
          }}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-pink-500 py-3.5 font-semibold text-white transition-colors hover:bg-lilac-500 disabled:cursor-not-allowed disabled:bg-ink/20"
        >
          <ShoppingBag className="h-5 w-5" />
          {outOfStock ? "Produto esgotado" : "Adicionar ao carrinho"}
        </button>
      </div>
    </div>
  );
}
