"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import { Product } from "@/lib/types";
import { formatBRL } from "@/lib/shipping";
import { useCartStore } from "@/lib/cart-store";
import { getMinOrderLabel, getMinQuantity } from "@/lib/min-order";

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const outOfStock = product.stock <= 0;
  const [justAdded, setJustAdded] = useState(false);
  const minOrderLabel = getMinOrderLabel(product);

  function handleAdd() {
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
      getMinQuantity(product)
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-3xl border border-pink-100 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg">
      <Link
        href={`/produtos/${product.slug}`}
        className="relative block aspect-square w-full overflow-hidden bg-pink-50"
      >
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {product.compare_at_price_cents && (
          <span className="absolute left-3 top-3 rounded-full bg-pink-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            Oferta
          </span>
        )}
        {minOrderLabel && (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink-soft shadow-sm">
            {minOrderLabel}
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-ink">
            Esgotado
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col justify-between p-3 sm:p-4">
        {/* Reservador de espaço para o título manter todos os cards no mesmo nível */}
        <Link href={`/produtos/${product.slug}`} className="block">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-tight text-ink transition-colors hover:text-pink-600 sm:text-base">
            {product.name}
          </h3>
        </Link>

        {/* Bloco do Preço e Botão fixo no rodapé */}
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-pink-600 sm:text-lg">
              {formatBRL(product.price_cents)}
            </span>
            {product.compare_at_price_cents && (
              <span className="text-xs text-ink-soft line-through sm:text-sm">
                {formatBRL(product.compare_at_price_cents)}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={outOfStock}
            onClick={handleAdd}
            className={`flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold text-white transition-all duration-200 sm:text-sm disabled:cursor-not-allowed disabled:bg-ink/20 ${
              justAdded ? "bg-green-500" : "bg-pink-500 hover:bg-lilac-500"
            }`}
          >
            {justAdded ? (
              <>
                <Check className="h-4 w-4" />
                Adicionado!
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4" />
                {outOfStock ? "Esgotado" : "Adicionar ao carrinho"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
