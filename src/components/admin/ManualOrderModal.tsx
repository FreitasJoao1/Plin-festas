"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Plus, Minus, Trash2 } from "lucide-react";
import { Product, ShippingMethod, DeliveryCity } from "@/lib/types";
import { formatBRL } from "@/lib/shipping";

const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  retirada: "Retirada no local",
  entrega_propria: "Entrega própria",
  uber_flash: "Uber Flash",
  correios: "Correios",
};
const CITY_LABELS: Record<DeliveryCity, string> = {
  salvador: "Salvador",
  lauro_de_freitas: "Lauro de Freitas",
};

interface LineItem {
  product: Product;
  quantity: number;
}

export default function ManualOrderModal({
  date,
  onClose,
  onCreated,
}: {
  date: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("retirada");
  const [shippingCity, setShippingCity] = useState<DeliveryCity>("salvador");
  const [shippingValue, setShippingValue] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/produtos")
      .then((r) => r.json())
      .then((data) => setProducts(data.products ?? []))
      .finally(() => setLoadingProducts(false));
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = products.filter((p) => p.active);
    if (!q) return base.slice(0, 8);
    return base.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [products, search]);

  function addProduct(product: Product) {
    setLineItems((items) => {
      const existing = items.find((i) => i.product.id === product.id);
      if (existing) {
        return items.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + (product.min_order ?? 1) }
            : i
        );
      }
      return [...items, { product, quantity: product.min_order ?? 1 }];
    });
    setSearch("");
  }

  function updateQty(productId: string, delta: number) {
    setLineItems((items) =>
      items
        .map((i) => {
          if (i.product.id !== productId) return i;
          const minQty = i.product.min_order ?? 1;
          return { ...i, quantity: Math.max(minQty, i.quantity + delta) };
        })
        .filter((i) => i.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    setLineItems((items) => items.filter((i) => i.product.id !== productId));
  }

  const subtotalCents = lineItems.reduce((s, i) => s + i.product.price_cents * i.quantity, 0);
  const shippingCentsParsed = (() => {
    if (!shippingValue.trim()) return 0;
    const normalized = shippingValue.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
  })();
  const totalCents = subtotalCents + shippingCentsParsed;

  async function handleSubmit() {
    setError(null);
    if (!customerName.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    if (lineItems.length === 0) {
      setError("Adicione pelo menos um produto.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/agenda/manual-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          cartItems: lineItems.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
          booking_date: date,
          shipping_method: shippingMethod,
          shipping_city: shippingMethod === "entrega_propria" || shippingMethod === "uber_flash" ? shippingCity : undefined,
          shipping_cents: shippingCentsParsed,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível criar o pedido.");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-pink-100 p-4">
          <h2 className="font-display text-lg text-ink">
            Novo pedido manual —{" "}
            {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
              weekday: "long", day: "2-digit", month: "2-digit",
            })}
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-2 hover:bg-pink-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-xs text-ink-soft">
            Use para pedidos combinados por WhatsApp ou presencialmente. Entra já como aprovado e ocupa uma vaga na cota desta semana.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Nome do cliente</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Telefone (opcional)</label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="(71) 9…"
                className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-ink">Produtos</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto para adicionar…"
              className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
            />
            {search.trim() && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-pink-100">
                {loadingProducts ? (
                  <p className="p-2 text-xs text-ink-soft">Carregando…</p>
                ) : filteredProducts.length === 0 ? (
                  <p className="p-2 text-xs text-ink-soft">Nenhum produto encontrado.</p>
                ) : (
                  filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduct(p)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-pink-50"
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-ink-soft">{formatBRL(p.price_cents)}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {lineItems.length > 0 && (
              <ul className="mt-3 flex flex-col divide-y divide-pink-50 rounded-xl border border-pink-100">
                {lineItems.map((i) => (
                  <li key={i.product.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{i.product.name}</p>
                      <p className="text-xs text-ink-soft">{formatBRL(i.product.price_cents)} un.</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQty(i.product.id, -1)}
                        className="rounded-full border border-pink-200 p-1 hover:bg-pink-50"
                        aria-label="Diminuir"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm">{i.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(i.product.id, 1)}
                        className="rounded-full border border-pink-200 p-1 hover:bg-pink-50"
                        aria-label="Aumentar"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(i.product.id)}
                        className="ml-1 rounded-full p-1 text-red-500 hover:bg-red-50"
                        aria-label="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Entrega</label>
              <select
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                className="w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm outline-none focus:border-pink-500"
              >
                {(Object.keys(SHIPPING_LABELS) as ShippingMethod[]).map((m) => (
                  <option key={m} value={m}>{SHIPPING_LABELS[m]}</option>
                ))}
              </select>
            </div>
            {(shippingMethod === "entrega_propria" || shippingMethod === "uber_flash") && (
              <div>
                <label className="mb-1 block text-sm font-medium text-ink">Cidade</label>
                <select
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value as DeliveryCity)}
                  className="w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm outline-none focus:border-pink-500"
                >
                  {(Object.keys(CITY_LABELS) as DeliveryCity[]).map((c) => (
                    <option key={c} value={c}>{CITY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Frete (R$, opcional)</label>
              <input
                value={shippingValue}
                onChange={(e) => setShippingValue(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-ink">Observação (opcional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-pink-100 px-3 py-2 text-sm text-pink-700">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-pink-100 p-4">
          <div className="text-sm">
            <span className="text-ink-soft">Total: </span>
            <span className="font-semibold text-ink">{formatBRL(totalCents)}</span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full bg-pink-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pink-600 disabled:opacity-50"
          >
            {submitting ? "Criando…" : "Criar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}
