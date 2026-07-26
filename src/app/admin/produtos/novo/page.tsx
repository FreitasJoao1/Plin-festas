import ProductForm from "@/components/admin/ProductForm";

export const metadata = { title: "Novo produto — Admin Plin Designs" };

export default function NovoProdutoPage() {
  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Novo produto</h1>
      <div className="mt-6 max-w-2xl rounded-3xl border border-pink-100 bg-white p-6">
        <ProductForm />
      </div>
    </div>
  );
}
