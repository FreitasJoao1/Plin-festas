import CouponForm from "@/components/admin/CouponForm";
import { getAllProductsAdmin } from "@/lib/products";

export const metadata = { title: "Novo cupom — Admin Plin Designs" };

export default async function NovoCupomPage() {
  const products = await getAllProductsAdmin();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Novo cupom de desconto</h1>
      <div className="mt-6 max-w-2xl rounded-3xl border border-pink-100 bg-white p-6">
        <CouponForm products={products} />
      </div>
    </div>
  );
}
