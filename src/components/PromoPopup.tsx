"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Sparkles, X, ShoppingBag, Check } from "lucide-react";
import { Product } from "@/lib/types";
import { formatBRL } from "@/lib/shipping";
import { useCartStore } from "@/lib/cart-store";

/** Depois de quanto tempo na página o popup aparece pela primeira vez. */
const FIRST_APPEAR_DELAY_MS = 2500;
/** Quanto tempo o popup fica visível antes de recolher sozinho. */
const AUTO_DISMISS_MS = 9000;

export default function PromoPopup({ products }: { products: Product[] }) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.open);

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const product = products[index];

  // Aparece uma vez, depois de um tempinho — dá espaço pro cliente
  // olhar a página antes de empurrar a oferta.
  useEffect(() => {
    if (products.length === 0) return;
    const t = setTimeout(() => setVisible(true), FIRST_APPEAR_DELAY_MS);
    return () => clearTimeout(t);
  }, [products.length]);

  // Some sozinho depois de um tempo, e troca pra próxima promoção na
  // próxima vez que reaparecer — não fica dois minutos gritando na tela.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      setVisible(false);
      setIndex((i) => (i + 1) % products.length);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [visible, products.length]);

  if (!product || dismissed || !visible) return null;

  const percentOff = product.compare_at_price_cents
    ? Math.round(
        ((product.compare_at_price_cents - product.price_cents) /
          product.compare_at_price_cents) *
          100
      )
    : 0;

  function handleAdd() {
    addItem({
      product_id: product.id,
      slug: product.slug,
      name: product.name,
      price_cents: product.price_cents,
      image: product.images[0],
      stock: product.stock,
      min_order: product.min_order,
      min_order_value_cents: product.min_order_value_cents,
    });
    setJustAdded(true);
    setTimeout(() => {
      setVisible(false);
      openCart();
    }, 700);
  }

  return (
    <div
      role="dialog"
      aria-label={`Oferta: ${product.name}`}
      className="fixed bottom-4 right-4 z-50 w-[min(23rem,calc(100vw-2rem))] animate-promo-in sm:bottom-6 sm:right-6"
    >
      <div className="relative overflow-hidden rounded-3xl border border-pink-200/70 bg-white shadow-[0_18px_45px_-15px_rgba(219,59,112,0.45)]">
        {/* Fita de destaque no topo */}
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-pink-500 to-lilac-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white">
          <Sparkles className="h-3.5 w-3.5" />
          Promoção por tempo limitado
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Fechar oferta"
          className="absolute right-2.5 top-9 z-10 rounded-full bg-white/90 p-1.5 text-ink-soft shadow-sm transition-colors hover:bg-white hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={handleAdd}
          className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-pink-50/60"
        >
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-pink-50">
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              sizes="80px"
              className="object-cover"
            />
            {percentOff > 0 && (
              <span className="absolute left-0 top-0 rounded-br-xl bg-pink-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                -{percentOff}%
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <p className="line-clamp-1 text-sm font-semibold text-ink">
              {product.name}
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-base font-bold text-pink-600">
                {formatBRL(product.price_cents)}
              </span>
              {product.compare_at_price_cents && (
                <span className="text-xs text-ink-soft line-through">
                  {formatBRL(product.compare_at_price_cents)}
                </span>
              )}
            </div>
            <span
              className={`mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white transition-colors ${
                justAdded ? "bg-green-500" : "bg-ink"
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Adicionado!
                </>
              ) : (
                <>
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Aproveitar oferta
                </>
              )}
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
