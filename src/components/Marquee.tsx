"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { Product } from "@/lib/types";

/**
 * Carrossel infinito de ESQUERDA → DIREITA.
 * Usa requestAnimationFrame para garantir a animação mesmo quando o CSS
 * de terceiros interfere, e pausa no hover.
 */
export default function Marquee({ products }: { products: Product[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const posRef = useRef(0);
  const rafRef = useRef<number>(0);

  const SPEED = 0.5; // px por frame (~30px/s em 60fps)

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const halfWidth = track.scrollWidth / 2;

    function tick() {
      if (!pausedRef.current) {
        posRef.current += SPEED;
        // reset quando rolou metade (o segundo bloco idêntico)
        if (posRef.current >= halfWidth) posRef.current = 0;
        if (track) track.style.transform = `translateX(${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  if (products.length === 0) return null;
  // Duplica pra loop sem costura
  const track = [...products, ...products];

  return (
    <div
      className="relative w-full overflow-hidden py-6"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent" />

      <div ref={trackRef} className="flex w-max">
        {track.map((product, i) => (
          <div
            key={`${product.id}-${i}`}
            className="mx-3 w-40 flex-shrink-0 sm:w-52"
          >
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-pink-50 shadow-sm transition-transform duration-200 hover:scale-105">
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 160px, 208px"
                className="object-cover"
              />
            </div>
            <p className="mt-2 truncate text-center text-sm font-medium text-ink">
              {product.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
