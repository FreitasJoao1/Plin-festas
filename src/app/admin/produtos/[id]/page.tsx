import { notFound } from "next/navigation";
import { getProductById } from "@/lib/products";
import ProductForm from "@/components/admin/ProductForm";

export const metadata = { title: "Editar produto — Admin Plin Designs" };

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Editar produto</h1>
      <div className="mt-6 max-w-2xl rounded-3xl border border-pink-100 bg-white p-6">
        <ProductForm product={product} />
      </div>
    </div>
  );
}
