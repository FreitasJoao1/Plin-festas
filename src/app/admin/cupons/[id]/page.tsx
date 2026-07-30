import { notFound } from "next/navigation";
import CouponForm from "@/components/admin/CouponForm";
import { getCouponById } from "@/lib/coupons";
import { getAllProductsAdmin } from "@/lib/products";

export const metadata = { title: "Editar cupom — Admin Plin Designs" };

export default async function EditarCupomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [coupon, products] = await Promise.all([
    getCouponById(id),
    getAllProductsAdmin(),
  ]);
  if (!coupon) notFound();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Editar cupom</h1>
      <div className="mt-6 max-w-2xl rounded-3xl border border-pink-100 bg-white p-6">
        <CouponForm coupon={coupon} products={products} />
      </div>
    </div>
  );
}
