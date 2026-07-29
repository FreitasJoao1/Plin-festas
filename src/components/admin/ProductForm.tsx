"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Product, ProductCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/mock-data";
import { uploadProductImage } from "@/lib/storage";

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [ProductCategory, string][];

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseMoneyToCents(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? null : Math.round(parsed * 100);
}

export default function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const isEditing = Boolean(product);

  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState<ProductCategory>(
    product?.category ?? "bolsas"
  );
  const [price, setPrice] = useState(
    product ? (product.price_cents / 100).toFixed(2).replace(".", ",") : ""
  );
  const [compareAtPrice, setCompareAtPrice] = useState(
    product?.compare_at_price_cents
      ? (product.compare_at_price_cents / 100).toFixed(2).replace(".", ",")
      : ""
  );
  const [stock, setStock] = useState(product ? String(product.stock) : "0");
  const [minOrderType, setMinOrderType] = useState<"none" | "quantity" | "value">(
    product?.min_order ? "quantity" : product?.min_order_value_cents ? "value" : "none"
  );
  const [minOrderQty, setMinOrderQty] = useState(product?.min_order ? String(product.min_order) : "");
  const [minOrderValue, setMinOrderValue] = useState(
    product?.min_order_value_cents
      ? (product.min_order_value_cents / 100).toFixed(2).replace(".", ",")
      : ""
  );
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState(product?.active ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceCents = parseMoneyToCents(price);
    if (!name.trim() || !slug.trim() || priceCents == null) {
      setError("Preencha nome, slug e um preço válido (ex: 49,90).");
      return;
    }

    let minOrder: number | null = null;
    let minOrderValueCents: number | null = null;
    const stockValue = Math.max(0, parseInt(stock, 10) || 0);
    if (minOrderType === "quantity") {
      const n = parseInt(minOrderQty, 10);
      if (!Number.isInteger(n) || n < 1) {
        setError("Informe uma quantidade mínima válida (ex: 2).");
        return;
      }
      if (n > stockValue) {
        setError(`Pedido mínimo (${n} un.) não pode ser maior que o estoque (${stockValue} un.).`);
        return;
      }
      minOrder = n;
    } else if (minOrderType === "value") {
      const cents = parseMoneyToCents(minOrderValue);
      if (cents == null || cents < 1) {
        setError("Informe um valor mínimo válido (ex: 50,00).");
        return;
      }
      minOrderValueCents = cents;
    }

    const payload = {
      slug: slug.trim(),
      name: name.trim(),
      description: description.trim(),
      category,
      price_cents: priceCents,
      compare_at_price_cents: parseMoneyToCents(compareAtPrice),
      stock: Math.max(0, parseInt(stock, 10) || 0),
      images,
      active,
      min_order: minOrder,
      min_order_value_cents: minOrderValueCents,
    };

    setSubmitting(true);
    try {
      const res = await fetch(
        isEditing ? `/api/admin/produtos/${product!.id}` : "/api/admin/produtos",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar o produto.");
        return;
      }

      router.push("/admin/produtos");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!product) return;
    if (!confirm(`Excluir "${product.name}"? Essa ação não pode ser desfeita.`)) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/produtos/${product.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Não foi possível excluir o produto.");
        return;
      }

      router.push("/admin/produtos");
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
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink">Nome</label>
          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink">
            Slug (URL: /produtos/seu-slug)
          </label>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            required
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 font-mono text-sm outline-none focus:border-pink-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink">
            Descrição
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Categoria
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductCategory)}
            className="w-full rounded-xl border border-pink-200 bg-white px-4 py-2.5 outline-none focus:border-pink-500"
          >
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Estoque
          </label>
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            required
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Preço (R$)
          </label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="99,90"
            required
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Preço &quot;de&quot; (opcional, mostra riscado)
          </label>
          <input
            value={compareAtPrice}
            onChange={(e) => setCompareAtPrice(e.target.value)}
            placeholder="129,90"
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink">Fotos do produto</label>

          <div className="flex flex-wrap gap-3">
            {images.map((url, idx) => (
              <div
                key={url + idx}
                className="group relative h-24 w-24 overflow-hidden rounded-xl border border-pink-200 bg-pink-50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((imgs) => imgs.filter((_, i) => i !== idx))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remover foto"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </div>
            ))}

            <label
              className={`flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-pink-300 text-pink-500 transition-colors hover:border-pink-500 hover:bg-pink-50 ${uploading ? "pointer-events-none opacity-50" : ""}`}
            >
              <Upload className="h-5 w-5" />
              <span className="text-[10px] font-medium">
                {uploading ? "Enviando…" : "Adicionar"}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length === 0) return;
                  setUploading(true);
                  setError(null);
                  for (const file of files) {
                    const result = await uploadProductImage(file);
                    if ("error" in result) {
                      setError(result.error);
                    } else {
                      setImages((imgs) => [...imgs, result.url]);
                    }
                  }
                  setUploading(false);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            Envie fotos direto do seu computador ou celular — vão para o
            Storage do Supabase automaticamente.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-ink">
            Pedido mínimo (opcional)
          </label>
          <div className="flex flex-wrap gap-3 text-sm text-ink">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="min_order_type"
                checked={minOrderType === "none"}
                onChange={() => setMinOrderType("none")}
                className="h-4 w-4 border-pink-300 text-pink-500 focus:ring-pink-400"
              />
              Sem mínimo
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="min_order_type"
                checked={minOrderType === "quantity"}
                onChange={() => setMinOrderType("quantity")}
                className="h-4 w-4 border-pink-300 text-pink-500 focus:ring-pink-400"
              />
              Por quantidade
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="min_order_type"
                checked={minOrderType === "value"}
                onChange={() => setMinOrderType("value")}
                className="h-4 w-4 border-pink-300 text-pink-500 focus:ring-pink-400"
              />
              Por valor (R$)
            </label>
          </div>

          {minOrderType === "quantity" && (
            <input
              type="number"
              min={1}
              value={minOrderQty}
              onChange={(e) => setMinOrderQty(e.target.value)}
              placeholder="Ex: 3 (unidades)"
              className="mt-2 w-full max-w-[220px] rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500 sm:w-48"
            />
          )}
          {minOrderType === "value" && (
            <input
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(e.target.value)}
              placeholder="Ex: 50,00"
              className="mt-2 w-full max-w-[220px] rounded-xl border border-pink-200 px-4 py-2.5 outline-none focus:border-pink-500 sm:w-48"
            />
          )}
          <p className="mt-1.5 text-xs text-ink-soft">
            Escolha um dos dois modos, ou deixe sem mínimo. Isso aparece pro
            cliente na vitrine e é conferido de novo no fechamento do pedido.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-pink-300 text-pink-500 focus:ring-pink-400"
          />
          Produto ativo (visível na loja)
        </label>
      </div>

      {error && (
        <p className="rounded-xl bg-pink-100 px-4 py-3 text-sm text-pink-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-pink-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-lilac-500 disabled:opacity-60"
        >
          {submitting
            ? "Salvando..."
            : isEditing
              ? "Salvar alterações"
              : "Criar produto"}
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-full border border-red-200 px-6 py-3 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? "Excluindo..." : "Excluir produto"}
          </button>
        )}
      </div>
    </form>
  );
}
