import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { getProducts } from "@/lib/products";
import { CATEGORY_LABELS } from "@/lib/mock-data";
import { ProductCategory } from "@/lib/types";

export const metadata = { title: "Produtos — Plin Designs" };

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { categoria } = await searchParams;
  // Suporta uma ou várias categorias separadas por vírgula na URL
  // (ex: ?categoria=lembrancinhas,chaveiros para o item de menu combinado).
  const categoryList = categoria
    ? (categoria.split(",").filter(Boolean) as ProductCategory[])
    : undefined;
  const products = await getProducts({ category: categoryList });

  const heading = !categoryList
    ? "Todos os produtos"
    : categoryList.length === 1
      ? CATEGORY_LABELS[categoryList[0]]
      : categoryList.map((c) => CATEGORY_LABELS[c]).join(" & ");

  return (
    <div className="container-plin py-10">
      <h1 className="font-display text-3xl text-ink">{heading}</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/produtos"
          className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
            !categoryList
              ? "border-pink-500 bg-pink-500 text-white"
              : "border-pink-200 text-ink-soft hover:bg-pink-50"
          }`}
        >
          Todas
        </Link>
        {(Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]).map(
          ([slug, label]) => (
            <Link
              key={slug}
              href={`/produtos?categoria=${slug}`}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
                categoryList?.length === 1 && categoryList[0] === slug
                  ? "border-pink-500 bg-pink-500 text-white"
                  : "border-pink-200 text-ink-soft hover:bg-pink-50"
              }`}
            >
              {label}
            </Link>
          )
        )}
      </div>

      {products.length === 0 ? (
        <p className="mt-10 text-ink-soft">
          Nenhum produto encontrado nessa categoria ainda.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
