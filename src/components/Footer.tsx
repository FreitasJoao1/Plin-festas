import Link from "next/link";
import { PICKUP_INFO } from "@/lib/shipping";
import PlinLogo from "@/components/PlinLogo";

export default function Footer() {
  return (
    <footer className="mt-16 bg-pink-50">
      <div className="container-plin grid gap-8 py-12 sm:grid-cols-3">
        <div>
          <PlinLogo className="h-12 w-auto" />
          <p className="mt-3 text-sm text-ink-soft">
            Bolsas, necessaires, copos e lembrancinhas personalizadas em
            Salvador e região. Tudo feito sob medida para sua festa.
          </p>
        </div>

        <div>
          <p className="mb-2 font-semibold text-ink">Retirada</p>
          <p className="text-sm text-ink-soft">{PICKUP_INFO.addressLine}</p>
          <p className="text-sm text-ink-soft">{PICKUP_INFO.hours}</p>
        </div>

        <div>
          <p className="mb-2 font-semibold text-ink">Loja</p>
          <ul className="flex flex-col gap-1 text-sm text-ink-soft">
            <li>
              <Link href="/produtos" className="hover:text-pink-600">
                Todos os produtos
              </Link>
            </li>
            <li>
              <Link href="/conta" className="hover:text-pink-600">
                Meus pedidos
              </Link>
            </li>
            <li>
              <Link href="/checkout" className="hover:text-pink-600">
                Carrinho / Checkout
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-pink-100 py-4 text-center text-xs text-ink-soft">
        © {new Date().getFullYear()} Plin Designs. Todos os direitos
        reservados.
      </div>
    </footer>
  );
}
