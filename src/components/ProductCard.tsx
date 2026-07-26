"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import { Product } from "@/lib/types";
import { formatBRL } from "@/lib/shipping";
import { useCartStore } from "@/lib/cart-store";

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const outOfStock = product.stock <= 0;
  const [justAdded, setJustAdded] = useState(false);

  function handleAdd() {
    addItem({
      product_id: product.id,
      slug: product.slug,
      name: product.name,
      price_cents: product.price_cents,
      image: product.images[0],
      stock: product.stock,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-3xl border border-pink-100 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-pink-200 hover:shadow-lg">
      <Link
        href={`/produtos/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-pink-50"
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
        {product.min_order && (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink-soft shadow-sm">
            mín. {product.min_order}
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-semibold text-ink">
            Esgotado
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={`/produtos/${product.slug}`}>
          <h3 className="line-clamp-2 font-medium text-ink transition-colors hover:text-pink-600">
            {product.name}
          </h3>
        </Link>

        <div className="mt-auto flex items-center gap-2">
          <span className="text-lg font-semibold text-pink-600">
            {formatBRL(product.price_cents)}
          </span>
          {product.compare_at_price_cents && (
            <span className="text-sm text-ink-soft line-through">
              {formatBRL(product.compare_at_price_cents)}
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={outOfStock}
          onClick={handleAdd}
          className={`mt-1 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:bg-ink/20 ${
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
  );
}
