"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatBRL } from "@/lib/shipping";
import { DeliveryCity, Order, ShippingMethod, ShippingQuote } from "@/lib/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import ShippingSelector from "@/components/ShippingSelector";

const HOLD_DURATION = 2000; // ms

export default function CheckoutPage() {
  const { items, subtotalCents, clear } = useCartStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [shipping, setShipping] = useState<ShippingQuote & { city?: DeliveryCity; cep?: string }>({
    method: "retirada",
    label: "Retirada pessoal",
    price_cents: 0,
    manual: false,
    note: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hold-to-confirm state
  const [holdProgress, setHoldProgress] = useState(0); // 0-100
  const [isHolding, setIsHolding] = useState(false);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStart = useRef<number>(0);

  const shippingCharged = shipping.manual ? 0 : shipping.price_cents;
  const total = subtotalCents() + shippingCharged;

  const orderItems = useMemo(
    () => items.map((i) => ({
      product_id: i.product_id,
      name: i.name,
      unit_price_cents: i.price_cents,
      quantity: i.quantity,
    })),
    [items]
  );

  async function submitOrder(): Promise<Order | null> {
    setError(null);
    if (!name.trim() || !phone.trim()) {
      setError("Preencha nome e WhatsApp para continuar.");
      return null;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: name.trim(), email: email.trim(), phone: phone.trim() },
          cartItems: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          shipping: { method: shipping.method, city: shipping.city, cep: shipping.cep },
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível processar o pedido.");
        return null;
      }

      // Monta objeto Order mínimo para gerar a URL do WhatsApp
      const order: Order = {
        id: data.orderId,
        order_code: data.orderCode,
        user_id: null,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim(),
        items: orderItems,
        subtotal_cents: subtotalCents(),
        shipping_method: shipping.method as ShippingMethod,
        shipping_city: (shipping.city as DeliveryCity) ?? null,
        shipping_cents: shippingCharged,
        total_cents: total,
        status: "novo",
        note: note.trim() || null,
        created_at: new Date().toISOString(),
      };
      return order;
    } catch {
      setError("Erro de conexão. Tente novamente.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  // Botão de segurar 2s ───────────────────────────────────────────────────
  const startHold = useCallback(() => {
    if (loading) return;
    holdStart.current = Date.now();
    setIsHolding(true);
    setHoldProgress(0);

    holdInterval.current = setInterval(() => {
      const elapsed = Date.now() - holdStart.current;
      const pct = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setHoldProgress(pct);

      if (elapsed >= HOLD_DURATION) {
        clearInterval(holdInterval.current!);
        setIsHolding(false);
        setHoldProgress(0);
        // dispara o submit
        submitOrder().then((order) => {
          if (order) {
            clear();
            window.location.href = buildWhatsAppUrl(order);
          }
        });
      }
    }, 30);
  }, [loading, name, email, phone, note, shipping, items]); // eslint-disable-line

  const cancelHold = useCallback(() => {
    if (holdInterval.current) clearInterval(holdInterval.current);
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  if (items.length === 0) {
    return (
      <div className="container-plin py-20 text-center">
        <h1 className="font-display text-2xl text-ink">Seu carrinho está vazio</h1>
        <Link
          href="/produtos"
          className="mt-6 inline-block rounded-full bg-pink-500 px-8 py-3 font-semibold text-white transition-colors hover:bg-lilac-500"
        >
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="container-plin grid gap-10 py-10 lg:grid-cols-[1.3fr_1fr]">
      {/* FORMULÁRIO */}
      <div className="flex flex-col gap-8">
        <section>
          <h2 className="font-display text-xl text-ink">Seus dados</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo *"
              className="rounded-2xl border border-pink-200 px-4 py-3 outline-none transition-colors focus:border-pink-500 sm:col-span-2"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="WhatsApp (com DDD) *"
              className="rounded-2xl border border-pink-200 px-4 py-3 outline-none transition-colors focus:border-pink-500"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="E-mail (opcional)"
              className="rounded-2xl border border-pink-200 px-4 py-3 outline-none transition-colors focus:border-pink-500"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observações (tema desejado, cores, nome da criança…)"
              rows={3}
              className="rounded-2xl border border-pink-200 px-4 py-3 outline-none transition-colors focus:border-pink-500 sm:col-span-2"
            />
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink">Entrega</h2>
          <div className="mt-4">
            <ShippingSelector items={orderItems} onChange={setShipping} />
          </div>
        </section>

        {error && (
          <p className="rounded-2xl bg-pink-100 px-4 py-3 text-sm text-pink-700">
            {error}
          </p>
        )}

        {/* BOTÃO HOLD-TO-CONFIRM */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-full select-none overflow-hidden rounded-full bg-green-500 shadow-lg">
            {/* Barra de progresso */}
            <div
              className="absolute inset-0 rounded-full bg-green-700 transition-none"
              style={{ width: `${holdProgress}%` }}
            />
            <button
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              disabled={loading}
              className="relative z-10 flex w-full items-center justify-center gap-3 py-4 font-bold text-white disabled:opacity-60"
            >
              <MessageCircle className="h-5 w-5" />
              {loading
                ? "Processando…"
                : isHolding
                  ? "Segure para confirmar…"
                  : `Finalizar via WhatsApp — ${formatBRL(total)}`}
            </button>
          </div>
          <p className="text-center text-xs text-ink-soft">
            {isHolding
              ? "Continue segurando…"
              : "Pressione e segure por 2 segundos para confirmar o pedido"}
          </p>
        </div>
      </div>

      {/* RESUMO */}
      <aside className="h-fit rounded-3xl border border-pink-100 bg-pink-50/50 p-6">
        <h2 className="font-display text-lg text-ink">Resumo do pedido</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.product_id} className="flex justify-between text-sm text-ink-soft">
              <span>{i.quantity}× {i.name}</span>
              <span>{formatBRL(i.price_cents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-1 border-t border-pink-200 pt-4 text-sm">
          <div className="flex justify-between text-ink-soft">
            <span>Subtotal</span>
            <span>{formatBRL(subtotalCents())}</span>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>Frete ({shipping.label})</span>
            <span>{shipping.manual ? "a combinar" : formatBRL(shippingCharged)}</span>
          </div>
          <div className="mt-2 flex justify-between text-base font-semibold text-ink">
            <span>Total</span>
            <span>{formatBRL(total)}</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-ink-soft">
          Ao finalizar você será redirecionado ao WhatsApp com o resumo
          do pedido para combinamos os detalhes. 🎉
        </p>
      </aside>
    </div>
  );
}
