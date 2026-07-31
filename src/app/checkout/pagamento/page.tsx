"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

function PaymentStatusContent() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const [status, setStatus] = useState<"checking" | "paid" | "pending">("checking");
  const [orderCode, setOrderCode] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const qs = new URLSearchParams({ order: orderId });
    const slug = params.get("slug");
    const transactionNsu = params.get("transaction_nsu");
    const leg = params.get("leg");
    if (slug) qs.set("slug", slug);
    if (transactionNsu) qs.set("transaction_nsu", transactionNsu);
    if (leg) qs.set("leg", leg);

    let cancelled = false;
    // Alguns segundos de tentativa — o webhook pode levar um instante
    // para chegar mesmo quando o payment_check ativo já confirmaria.
    async function poll(attempt: number) {
      const res = await fetch(`/api/pagamento/status?${qs.toString()}`);
      const data = await res.json();
      if (cancelled) return;
      if (data.order_code) setOrderCode(data.order_code);
      if (data.payment_status === "paid") {
        setStatus("paid");
        return;
      }
      if (attempt < 5) {
        setTimeout(() => poll(attempt + 1), 2000);
      } else {
        setStatus("pending");
      }
    }
    poll(0);
    return () => { cancelled = true; };
  }, [orderId, params]);

  if (!orderId) {
    return (
      <div className="container-plin py-20 text-center">
        <h1 className="font-display text-2xl text-ink">Pedido não encontrado</h1>
        <Link href="/" className="mt-6 inline-block text-pink-600 underline">Voltar à loja</Link>
      </div>
    );
  }

  return (
    <div className="container-plin flex flex-col items-center py-20 text-center">
      {status === "checking" && (
        <>
          <Loader2 className="h-12 w-12 animate-spin text-pink-500" />
          <h1 className="mt-4 font-display text-2xl text-ink">Confirmando seu pagamento…</h1>
          <p className="mt-2 text-ink-soft">Isso leva só alguns segundos.</p>
        </>
      )}
      {status === "paid" && (
        <>
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 font-display text-2xl text-ink">Pagamento confirmado! 🎉</h1>
          <p className="mt-2 text-ink-soft">
            {orderCode && <>Pedido <strong>{orderCode}</strong> — </>}
            já registramos seu pagamento. Em breve entramos em contato pelo WhatsApp.
          </p>
        </>
      )}
      {status === "pending" && (
        <>
          <XCircle className="h-12 w-12 text-amber-500" />
          <h1 className="mt-4 font-display text-2xl text-ink">Ainda confirmando…</h1>
          <p className="mt-2 max-w-md text-ink-soft">
            Seu pagamento pode levar mais alguns minutos para ser confirmado.
            {orderCode && <> Guarde o código <strong>{orderCode}</strong> — </>}
            se preferir, fale com a gente pelo WhatsApp para confirmar na hora.
          </p>
        </>
      )}
      <Link
        href="/produtos"
        className="mt-8 inline-block rounded-full bg-pink-500 px-8 py-3 font-semibold text-white transition-colors hover:bg-lilac-500"
      >
        Voltar à loja
      </Link>
    </div>
  );
}

export default function PaymentStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="container-plin flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
        </div>
      }
    >
      <PaymentStatusContent />
    </Suspense>
  );
}
