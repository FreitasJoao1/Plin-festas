import { ProductCategory } from "@/lib/types";
import { ProductInput } from "@/lib/products";

const VALID_CATEGORIES: ProductCategory[] = [
  "bolsas", "necessaires", "copos", "lembrancinhas", "chaveiros", "outros",
];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_IMAGES = 10;

/**
 * Valida (e normaliza) o payload de criação/edição de produto vindo do
 * admin. Usado nas rotas /api/admin/produtos — nunca confiamos apenas na
 * tipagem TypeScript de um `req.json()`, que não é verificada em runtime.
 */
export function validateProductInput(
  body: unknown,
  { partial = false }: { partial?: boolean } = {}
): { data: Partial<ProductInput> } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Corpo da requisição inválido." };
  const b = body as Record<string, unknown>;
  const out: Partial<ProductInput> = {};

  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);

  if (!partial || has("name")) {
    if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 150) {
      return { error: "Nome inválido (obrigatório, até 150 caracteres)." };
    }
    out.name = b.name.trim();
  }

  if (!partial || has("slug")) {
    if (typeof b.slug !== "string" || !SLUG_RE.test(b.slug) || b.slug.length > 100) {
      return { error: "Slug inválido — use apenas letras minúsculas, números e hífens." };
    }
    out.slug = b.slug;
  }

  if (!partial || has("description")) {
    if (typeof b.description !== "string" || b.description.length > 2000) {
      return { error: "Descrição inválida (máx. 2000 caracteres)." };
    }
    out.description = b.description;
  }

  if (!partial || has("category")) {
    if (typeof b.category !== "string" || !VALID_CATEGORIES.includes(b.category as ProductCategory)) {
      return { error: "Categoria inválida." };
    }
    out.category = b.category as ProductCategory;
  }

  if (!partial || has("price_cents")) {
    if (
      typeof b.price_cents !== "number" || !Number.isInteger(b.price_cents) ||
      b.price_cents < 0 || b.price_cents > 100_000_00
    ) {
      return { error: "Preço inválido." };
    }
    out.price_cents = b.price_cents;
  }

  if (!partial || has("compare_at_price_cents")) {
    if (b.compare_at_price_cents !== null && b.compare_at_price_cents !== undefined) {
      if (
        typeof b.compare_at_price_cents !== "number" ||
        !Number.isInteger(b.compare_at_price_cents) ||
        b.compare_at_price_cents < 0 || b.compare_at_price_cents > 100_000_00
      ) {
        return { error: "Preço 'de' inválido." };
      }
      out.compare_at_price_cents = b.compare_at_price_cents;
    } else {
      out.compare_at_price_cents = null;
    }
  }

  if (!partial || has("stock")) {
    if (typeof b.stock !== "number" || !Number.isInteger(b.stock) || b.stock < 0 || b.stock > 100_000) {
      return { error: "Estoque inválido." };
    }
    out.stock = b.stock;
  }

  if (!partial || has("min_order")) {
    if (b.min_order !== null && b.min_order !== undefined) {
      if (typeof b.min_order !== "number" || !Number.isInteger(b.min_order) || b.min_order < 1 || b.min_order > 100_000) {
        return { error: "Pedido mínimo por quantidade inválido." };
      }
      out.min_order = b.min_order;
    } else {
      out.min_order = null;
    }
  }

  if (!partial || has("min_order_value_cents")) {
    if (b.min_order_value_cents !== null && b.min_order_value_cents !== undefined) {
      if (
        typeof b.min_order_value_cents !== "number" ||
        !Number.isInteger(b.min_order_value_cents) ||
        b.min_order_value_cents < 1 || b.min_order_value_cents > 100_000_00
      ) {
        return { error: "Pedido mínimo por valor inválido." };
      }
      out.min_order_value_cents = b.min_order_value_cents;
    } else {
      out.min_order_value_cents = null;
    }
  }

  if (!partial || has("images")) {
    if (
      !Array.isArray(b.images) || b.images.length > MAX_IMAGES ||
      !b.images.every((u) => typeof u === "string" && u.length < 2000)
    ) {
      return { error: `Imagens inválidas (máximo ${MAX_IMAGES}).` };
    }
    out.images = b.images as string[];
  }

  if (!partial || has("active")) {
    if (typeof b.active !== "boolean") return { error: "Campo 'active' inválido." };
    out.active = b.active;
  }

  return { data: out };
}
