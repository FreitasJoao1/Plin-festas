import Image from "next/image";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/products";
import { formatBRL } from "@/lib/shipping";
import { CATEGORY_LABELS } from "@/lib/mock-data";
import ProductDetailActions from "@/components/ProductDetailActions";

export default async function ProdutoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  return (
    <div className="container-plin grid gap-10 py-10 md:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-pink-50">
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          priority
        />
      </div>

      <div>
        <span className="text-sm font-medium text-pink-600">
          {CATEGORY_LABELS[product.category]}
        </span>
        <h1 className="mt-1 font-display text-3xl text-ink">
          {product.name}
        </h1>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-2xl font-semibold text-pink-600">
            {formatBRL(product.price_cents)}
          </span>
          {product.compare_at_price_cents && (
            <span className="text-ink-soft line-through">
              {formatBRL(product.compare_at_price_cents)}
            </span>
          )}
        </div>

        <p className="mt-4 leading-relaxed text-ink-soft">
          {product.description}
        </p>

        <p className="mt-2 text-sm text-ink-soft">
          {product.stock > 0
            ? `${product.stock} em estoque`
            : "Sem estoque no momento"}
        </p>

        <ProductDetailActions product={product} />
      </div>
    </div>
  );
}
