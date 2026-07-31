"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Coupon, CouponDiscountType, CouponScope, Product, ProductCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/mock-data";

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [ProductCategory, string][];

function parseMoneyToCents(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? null : Math.round(parsed * 100);
}

/**
 * Datas de cupom são só "dia" (sem hora) — pra evitar o bug de fuso onde
 * um <input type="datetime-local"> compara o horário exato do navegador
 * contra o horário exato salvo no banco, e "hoje" vira "ainda não válido"
 * dependendo da hora/fuso de quem cria o cupom. Aqui sempre fixamos
 * horário de Brasília (-03:00): início do dia para valid_from, fim do dia
 * para valid_until — assim "início hoje" sempre significa 00:00 de hoje
 * no Brasil, não 00:00 UTC (que pode cair ainda no dia anterior aqui).
 */
const BRAZIL_OFFSET = "-03:00";

function toDateOnly(iso: string | null): string {
  if (!iso) return "";
  // O valor já foi salvo como "00:00-03:00" ou "23:59:59-03:00" (ver
  // buildValidFromIso/buildValidUntilIso), então os 10 primeiros
  // caracteres do ISO já são o dia certo em horário de Brasília — não
  // precisa (e não deve) passar por new Date(), que reconverteria pro
  // fuso do navegador e poderia voltar um dia.
  return iso.slice(0, 10);
}

function buildValidFromIso(dateOnly: string): string | null {
  if (!dateOnly) return null;
  return `${dateOnly}T00:00:00${BRAZIL_OFFSET}`;
}

function buildValidUntilIso(dateOnly: string): string | null {
  if (!dateOnly) return null;
  return `${dateOnly}T23:59:59${BRAZIL_OFFSET}`;
}

export default function CouponForm({
  coupon,
  products,
}: {
  coupon?: Coupon;
  products: Product[];
}) {
  const router = useRouter();
  const isEditing = Boolean(coupon);

  const [code, setCode] = useState(coupon?.code ?? "");
  const [description, setDescription] = useState(coupon?.description ?? "");
  const [discountType, setDiscountType] = useState<CouponDiscountType>(
    coupon?.discount_type ?? "percentage"
  );
  const [discountValue, setDiscountValue] = useState(
    coupon
      ? coupon.discount_type === "percentage"
        ? String(coupon.discount_value)
        : (coupon.discount_value / 100).toFixed(2).replace(".", ",")
      : ""
  );
  const [scope, setScope] = useState<CouponScope>(coupon?.scope ?? "all");
  const [scopeCategory, setScopeCategory] = useState<ProductCategory>(
    coupon?.scope_category ?? "bolsas"
  );
  const [scopeProductIds, setScopeProductIds] = useState<string[]>(
    coupon?.scope_product_ids ?? []
  );
  const [minOrderValue, setMinOrderValue] = useState(
    coupon?.min_order_value_cents
      ? (coupon.min_order_value_cents / 100).toFixed(2).replace(".", ",")
      : ""
  );
  const [maxUses, setMaxUses] = useState(coupon?.max_uses ? String(coupon.max_uses) : "");
  const [validFrom, setValidFrom] = useState(toDateOnly(coupon?.valid_from ?? null));
  const [validUntil, setValidUntil] = useState(toDateOnly(coupon?.valid_until ?? null));
  const [active, setActive] = useState(coupon?.active ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleProduct(id: string) {
    setScopeProductIds((ids) =>
      ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Informe o código do cupom.");
      return;
    }

    let discountValueParsed: number | null;
    if (discountType === "percentage") {
      const n = parseInt(discountValue.replace(/\D/g, ""), 10);
      discountValueParsed = Number.isNaN(n) ? null : n;
      if (discountValueParsed !== null && (discountValueParsed < 1 || discountValueParsed > 100)) {
        setError("Percentual de desconto deve ser entre 1 e 100.");
        return;
      }
    } else {
      discountValueParsed = parseMoneyToCents(discountValue);
    }
    if (!discountValueParsed) {
      setError("Informe um valor de desconto válido.");
      return;
    }

    if (scope === "products" && scopeProductIds.length === 0) {
      setError("Selecione ao menos um produto para o cupom se aplicar.");
      return;
    }

    const minOrderValueParsed =
      minOrderValue.trim() === "" ? null : parseMoneyToCents(minOrderValue);
    if (minOrderValue.trim() !== "" && minOrderValueParsed === null) {
      setError("Valor mínimo inválido (ex: 50,00).");
      return;
    }

    const maxUsesParsed = maxUses.trim() === "" ? null : parseInt(maxUses, 10);
    if (maxUsesParsed !== null && (!Number.isInteger(maxUsesParsed) || maxUsesParsed < 1)) {
      setError("Limite de usos deve ser um número inteiro maior que zero.");
      return;
    }

    const payload = {
      code: code.trim().toUpperCase(),
      description: description.trim(),
      discount_type: discountType,
      discount_value: discountValueParsed,
      scope,
      scope_category: scope === "category" ? scopeCategory : null,
      scope_product_ids: scope === "products" ? scopeProductIds : [],
      min_order_value_cents: minOrderValueParsed,
      max_uses: maxUsesParsed,
      active,
      valid_from: buildValidFromIso(validFrom),
      valid_until: buildValidUntilIso(validUntil),
    };

    setSubmitting(true);
    try {
      const res = await fetch(
        isEditing ? `/api/admin/cupons/${coupon!.id}` : "/api/admin/cupons",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar o cupom.");
        return;
      }

      router.push("/admin/cupons");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!coupon) return;
    if (!confirm(`Excluir o cupom "${coupon.code}"? Essa ação não pode ser desfeita.`)) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cupons/${coupon.id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Não foi possível excluir o cupom.");
        return;
      }

      router.push("/admin/cupons");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Código do cupom</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ex: FESTA10"
            required
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 font-mono uppercase outline-none focus:border-pink-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Descrição (opcional, uso interno)
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ex: Campanha de aniversário"
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Tipo de desconto</label>
          <select
            value={discountType}
            onChange={(e) => {
              setDiscountType(e.target.value as CouponDiscountType);
              setDiscountValue("");
            }}
            className="w-full rounded-xl border border-pink-200 bg-white px-4 py-2.5 outline-none focus:border-pink-500"
          >
            <option value="percentage">Percentual (%)</option>
            <option value="fixed">Valor fixo (R$)</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            {discountType === "percentage" ? "Percentual de desconto" : "Valor do desconto (R$)"}
          </label>
          <input
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === "percentage" ? "ex: 10" : "ex: 20,00"}
            required
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink">
            Aplica-se a
          </label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as CouponScope)}
            className="w-full rounded-xl border border-pink-200 bg-white px-4 py-2.5 outline-none focus:border-pink-500"
          >
            <option value="all">Todo o carrinho</option>
            <option value="category">Uma categoria específica</option>
            <option value="products">Produtos específicos</option>
          </select>
          <p className="mt-1 text-xs text-ink-soft">
            O desconto é calculado só sobre os itens elegíveis — não sobre o carrinho inteiro, a
            não ser que o escopo seja &quot;Todo o carrinho&quot;.
          </p>
        </div>

        {scope === "category" && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-ink">Categoria</label>
            <select
              value={scopeCategory}
              onChange={(e) => setScopeCategory(e.target.value as ProductCategory)}
              className="w-full rounded-xl border border-pink-200 bg-white px-4 py-2.5 outline-none focus:border-pink-500"
            >
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        {scope === "products" && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-ink">
              Produtos ({scopeProductIds.length} selecionado(s))
            </label>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-pink-200 p-2">
              {products.map((product) => (
                <label
                  key={product.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-pink-50"
                >
                  <input
                    type="checkbox"
                    checked={scopeProductIds.includes(product.id)}
                    onChange={() => toggleProduct(product.id)}
                    className="h-4 w-4 rounded border-pink-300 text-pink-500 focus:ring-pink-400"
                  />
                  <span className="text-ink">{product.name}</span>
                  <span className="text-xs text-ink-soft">({CATEGORY_LABELS[product.category]})</span>
                </label>
              ))}
              {products.length === 0 && (
                <p className="p-2 text-sm text-ink-soft">Nenhum produto cadastrado.</p>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Valor mínimo dos itens elegíveis (opcional)
          </label>
          <input
            value={minOrderValue}
            onChange={(e) => setMinOrderValue(e.target.value)}
            placeholder="ex: 50,00"
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500"
          />
          <p className="mt-1 text-xs text-ink-soft">
            Só aplica o desconto se o valor dos produtos elegíveis (ver &quot;Aplica-se a&quot;
            acima) atingir esse mínimo.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Limite de usos (opcional)
          </label>
          <input
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="ilimitado"
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500"
          />
          {isEditing && (
            <p className="mt-1 text-xs text-ink-soft">Já usado {coupon!.used_count}x.</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Válido a partir de (opcional)
          </label>
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Válido até (opcional)
          </label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-ink sm:col-span-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-pink-300 text-pink-500 focus:ring-pink-400"
          />
          Cupom ativo (pode ser usado no checkout)
        </label>
      </div>

      {error && (
        <p className="rounded-xl bg-pink-100 px-4 py-3 text-sm text-pink-700">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-pink-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-lilac-500 disabled:opacity-60"
        >
          {submitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar cupom"}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-full border border-red-200 px-6 py-3 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? "Excluindo..." : "Excluir cupom"}
          </button>
        )}
      </div>
    </form>
  );
}
