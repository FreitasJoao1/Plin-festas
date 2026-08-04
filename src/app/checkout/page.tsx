"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { MessageCircle, CreditCard, Tag, X, Loader2, ChevronDown } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatBRL } from "@/lib/shipping";
import { DeliveryCity, Order, ShippingMethod, ShippingQuote } from "@/lib/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import ShippingSelector from "@/components/ShippingSelector";
import BookingCalendar, { WeekOccupancyData, DayStatusOverrideData, findFirstAvailableWeek } from "@/components/BookingCalendar";
import { SPLIT_PAYMENT_MIN_CENTS, isSplitPaymentEligible } from "@/lib/split-payment";

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

function formatDDMMYY(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
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
  const [paymentPlan, setPaymentPlan] = useState<"full" | "split_50_50">("full");
  const [intendedMethod, setIntendedMethod] = useState<"pix" | "cartao">("pix");

  // Cupom de desconto ───────────────────────────────────────────────────
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    description: string;
    discountCents: number;
    /** "assinatura" do carrinho no momento em que o cupom foi aplicado — se o carrinho mudar, o cupom precisa ser reaplicado. */
    cartSignature: string;
  } | null>(null);

  const cartSignature = useMemo(
    () => items.map((i) => `${i.product_id}:${i.quantity}`).sort().join("|"),
    [items]
  );

  // Se o carrinho mudar depois do cupom aplicado (item removido, quantidade
  // alterada), o desconto guardado pode não valer mais — remove e pede pra
  // reaplicar, em vez de mostrar um valor desatualizado.
  useEffect(() => {
    if (appliedCoupon && appliedCoupon.cartSignature !== cartSignature) {
      setAppliedCoupon(null);
      setCouponError("O carrinho mudou — aplique o cupom novamente.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature]);

  const handleApplyCoupon = useCallback(async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/cupom/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          cartItems: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setCouponError(data.error ?? "Cupom inválido.");
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon({
        code: data.code,
        description: data.description,
        discountCents: data.discountCents,
        cartSignature,
      });
      setCouponInput("");
    } catch {
      setCouponError("Erro de conexão. Tente novamente.");
    } finally {
      setCouponLoading(false);
    }
  }, [couponInput, items, cartSignature]);

  const handleRemoveCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponError(null);
  }, []);

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
  const [dayStatusOverrides, setDayStatusOverrides] = useState<DayStatusOverrideData[]>([]);
  const [horizonDays, setHorizonDays] = useState(180);
  const [hasAutoSelectedWeek, setHasAutoSelectedWeek] = useState(false);

  // Busca a agenda do HORIZONTE INTEIRO de uma vez (não só a semana
  // visível) — precisamos disso pra saber, já na primeira renderização,
  // qual é a primeira semana com algum dia livre, sem esperar o cliente
  // navegar semana por semana até achar uma disponível.
  useEffect(() => {
    const start = mondayOf(today);
    const end = addDays(start, 180); // cobre o horizonte máximo (180 dias); ajusta sozinho se vier menor de settings
    fetch(`/api/agenda?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.weeks) setOccupancies(data.weeks);
        if (data.settings?.horizon_days) setHorizonDays(data.settings.horizon_days);
        // BUG CORRIGIDO: antes esse campo era ignorado — o admin marcava um
        // dia como esgotado/bloqueado em /admin/agenda, mas o checkout
        // nunca lia essa informação, então o dia continuava aparecendo
        // verde (calculado só pela ocupação numérica da semana).
        if (data.dayStatuses) setDayStatusOverrides(data.dayStatuses);
      })
      .catch(() => {
        // Se a agenda não carregar, o cliente ainda consegue finalizar
        // sem escolher data — não bloqueia o checkout por isso.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Assim que a agenda carrega, abre o calendário direto na primeira
  // semana com algum dia disponível — em vez de sempre começar na semana
  // atual, mesmo que ela esteja inteira esgotada/bloqueada. Só faz isso
  // uma vez (hasAutoSelectedWeek) para não brigar com a navegação manual
  // do cliente depois.
  useEffect(() => {
    if (hasAutoSelectedWeek || occupancies.length === 0) return;
    const maxDate = addDays(today, horizonDays);
    const weekStarts = occupancies.map((w) => w.week_start);
    const firstFree = findFirstAvailableWeek(weekStarts, today, maxDate, occupancies, dayStatusOverrides);
    if (firstFree) setVisibleWeekStart(firstFree);
    setHasAutoSelectedWeek(true);
  }, [occupancies, dayStatusOverrides, today, horizonDays, hasAutoSelectedWeek]);

  // "Próxima semana livre" a partir da semana atualmente visível — sutil,
  // mostrado abaixo do calendário. Só aparece quando a semana visível NÃO
  // é ela mesma a primeira livre (senão seria redundante mostrar a
  // mesma data dita duas vezes).
  const nextAvailableWeek = useMemo(() => {
    if (occupancies.length === 0) return null;
    const maxDate = addDays(today, horizonDays);
    const searchFrom = addDays(visibleWeekStart, 7); // estritamente depois da semana visível
    const weekStarts = occupancies.map((w) => w.week_start).filter((w) => w >= searchFrom);
    return findFirstAvailableWeek(weekStarts, today, maxDate, occupancies, dayStatusOverrides);
  }, [occupancies, dayStatusOverrides, today, horizonDays, visibleWeekStart]);

  const handleNavigateWeek = useCallback((direction: -1 | 1) => {
    setVisibleWeekStart((w) => addDays(w, direction * 7));
  }, []);

  // Termos de criação da arte — o cliente precisa confirmar que está
  // ciente do fluxo de aprovação antes de poder finalizar o pedido.
  const [agreedToArtTerms, setAgreedToArtTerms] = useState(false);
  const [showArtDetails, setShowArtDetails] = useState(false);

  const shippingCharged = shipping.manual ? 0 : shipping.price_cents;
  const discountCents = appliedCoupon?.discountCents ?? 0;
  const total = Math.max(0, subtotalCents() - discountCents) + shippingCharged;
  const splitValueEligible = isSplitPaymentEligible(total);
  // 50/50 só é visível/clicável quando o valor bate o mínimo E o método
  // escolhido é pix — cartão sempre paga o total de uma vez.
  const splitEligible = splitValueEligible && intendedMethod !== "cartao";

  // Se o total cair abaixo do mínimo (cupom aplicado, item removido etc.)
  // ou o método mudar para cartão enquanto "50/50" estava selecionado,
  // volta pro pagamento integral — não deixa o plano ficar selecionado
  // mas inacessível.
  useEffect(() => {
    if (!splitEligible && paymentPlan === "split_50_50") {
      setPaymentPlan("full");
    }
  }, [splitEligible, paymentPlan]);

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
          couponCode: appliedCoupon?.code || undefined,
          paymentPlan,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível processar o pedido.");
        return null;
      }

      // Monta objeto Order mínimo para gerar a URL do WhatsApp — usa o
      // desconto/cupom devolvidos pelo servidor (autoridade final), não o
      // estado local, que é só um preview.
      const order: Order = {
        id: data.orderId,
        order_code: data.orderCode,
        user_id: null,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim(),
        items: orderItems,
        subtotal_cents: data.subtotal_cents ?? subtotalCents(),
        coupon_code: data.coupon_code ?? null,
        discount_cents: data.discount_cents ?? 0,
        shipping_method: shipping.method as ShippingMethod,
        shipping_city: (shipping.city as DeliveryCity) ?? null,
        shipping_cents: shippingCharged,
        total_cents: data.total_cents ?? total,
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
        payment_plan: data.payment_plan ?? "full",
        deposit_amount_cents: data.deposit_amount_cents ?? 0,
        balance_amount_cents: data.balance_amount_cents ?? 0,
        balance_payment_status: "none",
        balance_payment_method: null,
        balance_infinitepay_transaction_nsu: null,
        balance_infinitepay_invoice_slug: null,
        balance_infinitepay_paid_amount_cents: null,
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
    if (loading || payingOnline || !agreedToArtTerms) return;
    submitOrder().then((order) => {
      if (order) {
        clear();
        window.location.href = buildWhatsAppUrl(order);
      }
    });
  }, [loading, payingOnline, agreedToArtTerms, name, email, phone, note, shipping, items]); // eslint-disable-line

  // Pagamento online opcional via InfinitePay — cria o pedido igual ao
  // fluxo do WhatsApp, mas em vez de ir pro wa.me, gera um link de
  // pagamento hospedado e redireciona pra lá. O carrinho só é limpo
  // depois que o pedido foi criado com sucesso (mesma lógica do WhatsApp).
  const handlePayOnline = useCallback(async () => {
    if (loading || payingOnline || !agreedToArtTerms) return;
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
  }, [loading, payingOnline, agreedToArtTerms, name, email, phone, note, shipping, items]); // eslint-disable-line

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
          <h2 className="font-display text-xl text-ink">Cupom de desconto</h2>
          {appliedCoupon ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-green-800">
                <Tag className="h-4 w-4 flex-shrink-0" />
                <span>
                  <strong>{appliedCoupon.code}</strong> aplicado — desconto de{" "}
                  {formatBRL(appliedCoupon.discountCents)}
                  {appliedCoupon.description ? ` (${appliedCoupon.description})` : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="flex-shrink-0 rounded-full p-1.5 text-green-700 transition-colors hover:bg-green-100"
                aria-label="Remover cupom"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyCoupon();
                  }
                }}
                placeholder="Código do cupom"
                className="flex-1 rounded-2xl border border-pink-200 px-4 py-3 uppercase outline-none transition-colors focus:border-pink-500"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={couponLoading || !couponInput.trim()}
                className="flex flex-shrink-0 items-center gap-2 rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink/80 disabled:opacity-50"
              >
                {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
              </button>
            </div>
          )}
          {couponError && (
            <p className="mt-2 text-sm text-pink-600">{couponError}</p>
          )}
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
              dayStatusOverrides={dayStatusOverrides}
            />
          </div>
          {nextAvailableWeek && (
            <button
              type="button"
              onClick={() => setVisibleWeekStart(nextAvailableWeek)}
              className="mt-2 text-xs text-ink-soft/70 transition-colors hover:text-pink-600"
            >
              Próxima semana livre: {formatDDMMYY(nextAvailableWeek)}
            </button>
          )}
          <p className="mt-3 rounded-2xl bg-babyblue-100 px-4 py-3 text-sm text-ink">
            ⚠️ Data sujeita à confirmação da loja. Fora da disponibilidade
            padrão, pode ser feito encaixe mediante taxa adicional de 10%
            sobre o valor do pedido — combinamos tudo pelo WhatsApp.
          </p>
        </section>

        <section>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-pink-200 bg-pink-50/50 px-4 py-3">
            <input
              type="checkbox"
              checked={agreedToArtTerms}
              onChange={(e) => setAgreedToArtTerms(e.target.checked)}
              className="mt-0.5 h-5 w-5 flex-shrink-0 accent-pink-500"
            />
            <span className="text-sm text-ink">
              Li e concordo que a arte será enviada para aprovação antes
              do início da produção.{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowArtDetails((v) => !v);
                }}
                className="inline-flex items-center gap-1 font-semibold text-pink-600 underline underline-offset-2 hover:text-pink-700"
              >
                Ver detalhes
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showArtDetails ? "rotate-180" : ""}`}
                />
              </button>
            </span>
          </label>
          {showArtDetails && (
            <div className="mt-2 flex flex-col gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-ink-soft ring-1 ring-pink-100">
              <div>
                <p className="font-semibold text-ink">🎨 Criação da arte</p>
                <p className="mt-1">
                  Após a confirmação do pedido, nossa equipe entrará em
                  contato para iniciar a criação da sua arte.
                  Solicitaremos uma imagem de inspiração como referência e
                  enviaremos o layout para aprovação até 5 dias antes da
                  data de entrega.
                </p>
              </div>
              <div>
                <p className="font-semibold text-ink">✅ Produção</p>
                <p className="mt-1">
                  A produção será iniciada somente após a aprovação da
                  arte pelo cliente.
                </p>
              </div>
            </div>
          )}
        </section>

        {error && (
          <p className="rounded-2xl bg-pink-100 px-4 py-3 text-sm text-pink-700">
            {error}
          </p>
        )}

        {/* MÉTODO DE PAGAMENTO PRETENDIDO — decide se o parcelamento 50/50
            fica disponível (só pix; cartão sempre é 100%). */}
        <section className="rounded-2xl border border-pink-100 bg-white p-4">
          <h3 className="text-sm font-semibold text-ink">Como você pretende pagar?</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                { value: "pix" as const, label: "Pix" },
                { value: "cartao" as const, label: "Cartão" },
              ]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIntendedMethod(opt.value)}
                className={`rounded-xl border px-3 py-2 text-center text-sm transition-colors ${
                  intendedMethod === opt.value
                    ? "border-pink-500 bg-pink-50 text-ink"
                    : "border-pink-100 text-ink-soft hover:border-pink-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {intendedMethod === "cartao"
              ? "No cartão, o pagamento é sempre integral."
              : "Pix libera a opção de pagar metade agora e metade na entrega."}
          </p>
        </section>

        {/* PLANO DE PAGAMENTO: à vista ou 50% agora + 50% na entrega —
            o bloco de 50/50 só aparece (visível e clicável) quando o
            método pretendido é pix e o total é >= R$100. */}
        <section className="rounded-2xl border border-pink-100 bg-white p-4">
          <h3 className="text-sm font-semibold text-ink">Forma de pagamento</h3>
          <div className={`mt-2 grid gap-2 ${splitEligible ? "sm:grid-cols-2" : ""}`}>
            <button
              type="button"
              onClick={() => setPaymentPlan("full")}
              className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                paymentPlan === "full"
                  ? "border-pink-500 bg-pink-50 text-ink"
                  : "border-pink-100 text-ink-soft hover:border-pink-200"
              }`}
            >
              <span className="font-semibold">100% agora</span>
              <span className="block text-xs">{formatBRL(total)}</span>
            </button>
            {splitEligible && (
              <button
                type="button"
                onClick={() => setPaymentPlan("split_50_50")}
                className={`rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                  paymentPlan === "split_50_50"
                    ? "border-pink-500 bg-pink-50 text-ink"
                    : "border-pink-100 text-ink-soft hover:border-pink-200"
                }`}
              >
                <span className="font-semibold">50% agora + 50% na entrega</span>
                <span className="block text-xs">
                  {`${formatBRL(Math.round(total / 2))} agora, restante na entrega`}
                </span>
              </button>
            )}
          </div>
          {!splitEligible && intendedMethod !== "cartao" && !splitValueEligible && (
            <p className="mt-2 text-xs text-ink-soft">
              Parcelamento 50/50 disponível a partir de {formatBRL(SPLIT_PAYMENT_MIN_CENTS)}.
            </p>
          )}
        </section>

        {/* BOTÕES DE CONFIRMAÇÃO */}
        <div className="flex flex-col items-center gap-3">
          {paymentAvailable && (
            <button
              onClick={handlePayOnline}
              disabled={loading || payingOnline || !agreedToArtTerms}
              className="flex w-full items-center justify-center gap-3 rounded-full bg-lilac-500 py-4 font-bold text-white shadow-lg transition-colors hover:bg-lilac-600 disabled:opacity-60"
            >
              <CreditCard className="h-5 w-5" />
              {payingOnline
                ? "Gerando pagamento…"
                : paymentPlan === "split_50_50"
                  ? `Pagar sinal agora (Pix ou cartão) — ${formatBRL(Math.round(total / 2))}`
                  : `Pagar agora (Pix ou cartão) — ${formatBRL(total)}`}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={loading || payingOnline || !agreedToArtTerms}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-green-500 py-4 font-bold text-white shadow-lg transition-colors hover:bg-green-600 disabled:opacity-60"
          >
            <MessageCircle className="h-5 w-5" />
            {loading ? "Processando…" : `Finalizar via WhatsApp — ${formatBRL(total)}`}
          </button>
          {!agreedToArtTerms && (
            <p className="text-center text-xs text-pink-600">
              Marque a caixa acima para liberar a finalização do pedido.
            </p>
          )}
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
          {discountCents > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Cupom ({appliedCoupon?.code})</span>
              <span>-{formatBRL(discountCents)}</span>
            </div>
          )}
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
