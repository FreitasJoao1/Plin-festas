"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  ALL_SHIPPING_METHODS,
  DELIVERY_CITY_LABELS,
  OWN_DELIVERY_FEES_CENTS,
  PICKUP_INFO,
  SHIPPING_METHOD_LABELS,
  formatBRL,
  getShippingQuote,
} from "@/lib/shipping";
import { DeliveryCity, OrderItem, ShippingMethod, ShippingQuote } from "@/lib/types";

export default function ShippingSelector({
  items,
  onChange,
}: {
  items: OrderItem[];
  onChange: (quote: ShippingQuote & { city?: DeliveryCity; cep?: string }) => void;
}) {
  const [method, setMethod] = useState<ShippingMethod>("retirada");
  const [city, setCity] = useState<DeliveryCity>("salvador");
  const [cep, setCep] = useState("");
  const [correiosQuoteCents, setCorreiosQuoteCents] = useState<number | null>(
    null
  );
  const [loadingFrete, setLoadingFrete] = useState(false);

  function selectMethod(next: ShippingMethod) {
    setMethod(next);
    const quote = getShippingQuote(next, { city, correiosQuoteCents });
    onChange({ ...quote, city, cep });
  }

  function selectCity(next: DeliveryCity) {
    setCity(next);
    const quote = getShippingQuote("entrega_propria", { city: next });
    onChange({ ...quote, city: next });
  }

  async function checkCorreios() {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    setLoadingFrete(true);
    try {
      const res = await fetch("/api/frete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep: clean, items }),
      });
      const quote: ShippingQuote = await res.json();
      setCorreiosQuoteCents(quote.manual ? null : quote.price_cents);
      onChange({ ...quote, cep: clean });
    } finally {
      setLoadingFrete(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {ALL_SHIPPING_METHODS.map((m) => (
        <div
          key={m}
          className={`rounded-2xl border p-4 transition-colors ${
            method === m
              ? "border-pink-500 bg-pink-50"
              : "border-pink-100 bg-white"
          }`}
        >
          <button
            type="button"
            onClick={() => selectMethod(m)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <p className="font-semibold text-ink">
                {SHIPPING_METHOD_LABELS[m]}
              </p>
              {m === "retirada" && (
                <p className="text-sm text-ink-soft">
                  {PICKUP_INFO.addressLine} · {PICKUP_INFO.hours}
                </p>
              )}
              {m === "entrega_propria" && (
                <p className="text-sm text-ink-soft">
                  Salvador {formatBRL(OWN_DELIVERY_FEES_CENTS.salvador)} ·
                  Lauro de Freitas{" "}
                  {formatBRL(OWN_DELIVERY_FEES_CENTS.lauro_de_freitas)}
                </p>
              )}
              {m === "uber_flash" && (
                <p className="text-sm text-ink-soft">
                  Corrida solicitada e paga por você, direto no app
                </p>
              )}
              {m === "correios" && (
                <p className="text-sm text-ink-soft">
                  Informe o CEP para calcular
                </p>
              )}
            </div>
            <span
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                method === m
                  ? "border-pink-500 bg-pink-500"
                  : "border-pink-200"
              }`}
            >
              {method === m && <Check className="h-3 w-3 text-white" />}
            </span>
          </button>

          {method === m && m === "entrega_propria" && (
            <div className="mt-3 flex gap-2">
              {(["salvador", "lauro_de_freitas"] as DeliveryCity[]).map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => selectCity(c)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      city === c
                        ? "border-pink-500 bg-pink-500 text-white"
                        : "border-pink-200 text-ink-soft"
                    }`}
                  >
                    {DELIVERY_CITY_LABELS[c]} —{" "}
                    {formatBRL(OWN_DELIVERY_FEES_CENTS[c])}
                  </button>
                )
              )}
            </div>
          )}

          {method === m && m === "correios" && (
            <div className="mt-3">
              <div className="flex gap-2">
                <input
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  onBlur={checkCorreios}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-32 rounded-full border border-pink-200 px-3 py-1.5 text-sm outline-none focus:border-pink-500"
                />
                {loadingFrete && (
                  <Loader2 className="h-5 w-5 animate-spin text-pink-500" />
                )}
              </div>
              {!loadingFrete && correiosQuoteCents != null && (
                <p className="mt-2 text-sm font-medium text-pink-600">
                  Frete: {formatBRL(correiosQuoteCents)}
                </p>
              )}
              {!loadingFrete &&
                cep.replace(/\D/g, "").length === 8 &&
                correiosQuoteCents == null && (
                  <p className="mt-2 text-sm text-ink-soft">
                    Não conseguimos calcular automaticamente — o frete fica
                    por conta do cliente, combinado pelo WhatsApp.
                  </p>
                )}
            </div>
          )}

          {method === m && (m === "uber_flash" || m === "entrega_propria") && (
            <p className="mt-2 text-xs text-ink-soft">
              {getShippingQuote(m, { city }).note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
