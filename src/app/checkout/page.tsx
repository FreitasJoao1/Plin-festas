"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { MessageCircle, CreditCard } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatBRL } from "@/lib/shipping";
import { DeliveryCity, Order, ShippingMethod, ShippingQuote } from "@/lib/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import ShippingSelector from "@/components/ShippingSelector";
import BookingCalendar, { WeekOccupancyData, DayScheduleData } from "@/components/BookingCalendar";

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

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
  const [payingOnline, setPayingOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentAvailable, setPaymentAvailable] = useState(false);

  useEffect(() => {
    fetch("/api/pagamento/config")
      .then((r) => r.json())
      .then((data) => setPaymentAvailable(Boolean(data.available)))
      .catch(() => setPaymentAvailable(false));
  }, []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [bookingDate, setBookingDate] = useState<string | null>(null);
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => mondayOf(today));
  const [occupancies, setOccupancies] = useState<WeekOccupancyData[]>([]);
  const [closedDays, setClosedDays] = useState<DayScheduleData[]>([]);
  const [horizonDays, setHorizonDays] = useState(60);

  useEffect(() => {
    const start = visibleWeekStart;
    const end = addDays(visibleWeekStart, 6);
    fetch(`/api/agenda?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.weeks) setOccupancies(data.weeks);
        if (data.settings?.horizon_days) setHorizonDays(data.settings.horizon_days);
        if (data.closedDays) setClosedDays(data.closedDays);
      })
      .catch(() => {
        // Se a agenda não carregar, o cliente ainda consegue finalizar
        // sem escolher data — não bloqueia o checkout por isso.
      });
  }, [visibleWeekStart]);

  const handleNavigateWeek = useCallback((direction: -1 | 1) => {
    setVisibleWeekStart((w) => addDays(w, direction * 7));
  }, []);

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
          bookingDate: bookingDate ?? undefined,
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
        booking_date: bookingDate,
        booking_status: "pending_approval",
        booking_rejection_reason: null,
        booking_alternative_date: null,
        refund_status: "none",
        payment_status: "none",
        payment_method: null,
        infinitepay_order_nsu: null,
        infinitepay_transaction_nsu: null,
        infinitepay_invoice_slug: null,
        infinitepay_paid_amount_cents: null,
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

  // Confirmação instantânea via WhatsApp ──────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (loading || payingOnline) return;
    submitOrder().then((order) => {
      if (order) {
        clear();
        window.location.href = buildWhatsAppUrl(order);
      }
    });
  }, [loading, payingOnline, name, email, phone, note, shipping, items]); // eslint-disable-line

  // Pagamento online opcional via InfinitePay — cria o pedido igual ao
  // fluxo do WhatsApp, mas em vez de ir pro wa.me, gera um link de
  // pagamento hospedado e redireciona pra lá. O carrinho só é limpo
  // depois que o pedido foi criado com sucesso (mesma lógica do WhatsApp).
  const handlePayOnline = useCallback(async () => {
    if (loading || payingOnline) return;
    setPayingOnline(true);
    try {
      const order = await submitOrder();
      if (!order) return;

      const res = await fetch(`/api/pagamento/${order.id}/link`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error ?? "Não foi possível iniciar o pagamento. Tente pelo WhatsApp.");
        return;
      }

      clear();
      window.location.href = data.url;
    } finally {
      setPayingOnline(false);
    }
  }, [loading, payingOnline, name, email, phone, note, shipping, items]); // eslint-disable-line

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

        <section>
          <h2 className="font-display text-xl text-ink">Data desejada (opcional)</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Escolha a data do seu evento ou entrega. Semanas muito cheias
            ficam bloqueadas — se não escolher, combinamos o prazo por
            WhatsApp normalmente.
          </p>
          <div className="mt-4">
            <BookingCalendar
              occupancies={occupancies}
              horizonDays={horizonDays}
              visibleWeekStart={visibleWeekStart}
              onNavigateWeek={handleNavigateWeek}
              onSelectDate={(date) => setBookingDate((d) => (d === date ? null : date))}
              selectedDate={bookingDate}
              daySchedules={closedDays}
            />
          </div>
          <p className="mt-3 rounded-2xl bg-babyblue-100 px-4 py-3 text-sm text-ink">
            ⚠️ <strong>Importante:</strong> pedidos com data marcada estão
            sujeitos à confirmação de agenda pela loja. Caso não possamos
            atender na data solicitada
            {bookingDate
              ? ` (${new Date(bookingDate + "T12:00:00").toLocaleDateString("pt-BR")})`
              : ""}
            , entraremos em contato via WhatsApp para propor uma nova data
            ou realizar o estorno integral.
          </p>
        </section>

        {error && (
          <p className="rounded-2xl bg-pink-100 px-4 py-3 text-sm text-pink-700">
            {error}
          </p>
        )}

        {/* BOTÕES DE CONFIRMAÇÃO */}
        <div className="flex flex-col items-center gap-3">
          {paymentAvailable && (
            <button
              onClick={handlePayOnline}
              disabled={loading || payingOnline}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-lilac-500 py-4 font-bold text-white shadow-lg transition-colors hover:bg-lilac-600 disabled:opacity-60"
            >
              <CreditCard className="h-5 w-5" />
              {payingOnline ? "Gerando pagamento…" : `Pagar agora (Pix ou cartão) — ${formatBRL(total)}`}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={loading || payingOnline}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-green-500 py-4 font-bold text-white shadow-lg transition-colors hover:bg-green-600 disabled:opacity-60"
          >
            <MessageCircle className="h-5 w-5" />
            {loading ? "Processando…" : `Finalizar via WhatsApp — ${formatBRL(total)}`}
          </button>
          {paymentAvailable && (
            <p className="text-center text-xs text-ink-soft">
              O pagamento fica registrado no seu pedido — a loja ainda
              confirma os detalhes finais com você pelo WhatsApp.
            </p>
          )}
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
