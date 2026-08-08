import Link from "next/link";
import Image from "next/image";
import { Sparkles, Truck, Store, ShieldCheck } from "lucide-react";
import Marquee from "@/components/Marquee";
import BuntingDivider from "@/components/BuntingDivider";
import ProductCard from "@/components/ProductCard";
import PromoPopup from "@/components/PromoPopup";
import { getFeaturedProducts, getPromoProducts } from "@/lib/products";
import { getHomeHero, getHomeTrustCards } from "@/lib/site-content";
import { CATEGORY_LABELS } from "@/lib/mock-data";
import { ProductCategory } from "@/lib/types";

const TRUST_ICONS = [Store, Truck, ShieldCheck];

export default async function HomePage() {
  const [products, hero, trustCards, promoProducts] = await Promise.all([
    getFeaturedProducts(),
    getHomeHero(),
    getHomeTrustCards(),
    getPromoProducts(),
  ]);

  return (
    <div>
      <PromoPopup products={promoProducts} />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-pink-100 via-pink-50 to-white">
        <div className="container-plin grid items-center gap-8 py-14 sm:py-20 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-pink-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" /> {hero.badge}
            </span>
            <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">
              {hero.title}
            </h1>
            <p className="mt-4 text-base text-ink-soft sm:text-lg">
              {hero.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/produtos"
                className="rounded-full bg-pink-500 px-6 py-3 font-semibold text-white shadow-sm shadow-pink-200 transition-colors hover:bg-lilac-500"
              >
                {hero.button_label}
              </Link>
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl shadow-xl">
            <Image
              src={hero.image_url}
              alt={hero.image_alt}
              fill
              priority
              sizes="(max-width: 768px) 90vw, 480px"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* Marquee de produtos — logo abaixo do banner, como pedido */}
      <Marquee products={products} />
      <BuntingDivider />

      {/* Categorias */}
      <section className="container-plin py-14">
        <h2 className="font-display text-2xl text-ink sm:text-3xl">
          Compre por categoria
        </h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {(Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]).map(
            ([slug, label]) => (
              <Link
                key={slug}
                href={`/produtos?categoria=${slug}`}
                className="flex flex-col items-center gap-2 rounded-3xl border border-pink-100 bg-pink-50/50 p-5 text-center transition-colors hover:bg-pink-100"
              >
                <span className="font-medium text-ink">{label}</span>
              </Link>
            )
          )}
        </div>
      </section>

      {/* Mais vendidos */}
      <section className="container-plin py-6 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink sm:text-3xl">
            Mais vendidos
          </h2>
          <Link
            href="/produtos"
            className="text-sm font-semibold text-pink-600 hover:underline"
          >
            Ver tudo
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.slice(0, 8).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Confiança / logística resumida */}
      <section className="bg-babyblue-100/60 py-12">
        <div className="container-plin grid gap-6 sm:grid-cols-3">
          {trustCards.map((card, i) => {
            const Icon = TRUST_ICONS[i] ?? Store;
            return (
              <div key={i} className="flex items-start gap-3">
                <Icon className="h-6 w-6 flex-shrink-0 text-pink-500" />
                <div>
                  <p className="font-semibold text-ink">{card.title}</p>
                  <p className="text-sm text-ink-soft">{card.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
