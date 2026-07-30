import { CouponDiscountType, CouponScope, ProductCategory } from "@/lib/types";
import { CouponInput } from "@/lib/coupons";

const VALID_CATEGORIES: ProductCategory[] = [
  "bolsas", "necessaires", "copos", "lembrancinhas", "chaveiros", "outros",
];
const VALID_DISCOUNT_TYPES: CouponDiscountType[] = ["percentage", "fixed"];
const VALID_SCOPES: CouponScope[] = ["all", "category", "products"];
const CODE_RE = /^[A-Z0-9-]{3,30}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PRODUCTS_IN_SCOPE = 200;

/**
 * Valida (e normaliza) o payload de criação/edição de cupom vindo do
 * admin. Usado em /api/admin/cupons — nunca confiamos apenas na tipagem
 * TypeScript de um `req.json()`, que não é verificada em runtime.
 */
export function validateCouponInput(
  body: unknown,
  { partial = false }: { partial?: boolean } = {}
): { data: Partial<CouponInput> } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Corpo da requisição inválido." };
  const b = body as Record<string, unknown>;
  const out: Partial<CouponInput> = {};

  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);

  if (!partial || has("code")) {
    if (typeof b.code !== "string" || !CODE_RE.test(b.code.trim().toUpperCase())) {
      return {
        error:
          "Código inválido — use de 3 a 30 letras maiúsculas, números e hífens (ex: FESTA10).",
      };
    }
    out.code = b.code.trim().toUpperCase();
  }

  if (!partial || has("description")) {
    if (typeof b.description !== "string" || b.description.length > 300) {
      return { error: "Descrição inválida (máx. 300 caracteres)." };
    }
    out.description = b.description.trim();
  }

  if (!partial || has("discount_type")) {
    if (typeof b.discount_type !== "string" || !VALID_DISCOUNT_TYPES.includes(b.discount_type as CouponDiscountType)) {
      return { error: "Tipo de desconto inválido." };
    }
    out.discount_type = b.discount_type as CouponDiscountType;
  }

  if (!partial || has("discount_value")) {
    if (typeof b.discount_value !== "number" || !Number.isInteger(b.discount_value) || b.discount_value <= 0) {
      return { error: "Valor de desconto inválido." };
    }
    // Só conseguimos validar o teto de 100% contra discount_type quando ele
    // também está presente neste payload (numa edição parcial que só muda
    // discount_value, o backend confia no valor já salvo antes — o teto de
    // 100_000_00 centavos cobre o caso 'fixed' de qualquer forma).
    if (out.discount_type === "percentage" && b.discount_value > 100) {
      return { error: "Desconto percentual não pode passar de 100%." };
    }
    if (b.discount_value > 100_000_00) {
      return { error: "Valor de desconto inválido." };
    }
    out.discount_value = b.discount_value;
  }

  if (!partial || has("scope")) {
    if (typeof b.scope !== "string" || !VALID_SCOPES.includes(b.scope as CouponScope)) {
      return { error: "Escopo do cupom inválido." };
    }
    out.scope = b.scope as CouponScope;
  }

  if (!partial || has("scope_category")) {
    if (b.scope_category !== null && b.scope_category !== undefined) {
      if (typeof b.scope_category !== "string" || !VALID_CATEGORIES.includes(b.scope_category as ProductCategory)) {
        return { error: "Categoria do cupom inválida." };
      }
      out.scope_category = b.scope_category as ProductCategory;
    } else {
      out.scope_category = null;
    }
  }

  if (!partial || has("scope_product_ids")) {
    if (b.scope_product_ids !== undefined) {
      if (
        !Array.isArray(b.scope_product_ids) ||
        b.scope_product_ids.length > MAX_PRODUCTS_IN_SCOPE ||
        !b.scope_product_ids.every((id) => typeof id === "string" && UUID_RE.test(id))
      ) {
        return { error: `Lista de produtos do cupom inválida (máximo ${MAX_PRODUCTS_IN_SCOPE}).` };
      }
      out.scope_product_ids = b.scope_product_ids as string[];
    } else {
      out.scope_product_ids = [];
    }
  }

  // Consistência: escopo 'category' exige scope_category; 'products' exige
  // scope_product_ids não vazio. Só valida quando ambos os campos relevantes
  // estão presentes neste payload (evita falso-negativo em PATCH parcial).
  if (out.scope === "category" && (has("scope_category") || !partial) && !out.scope_category) {
    return { error: "Selecione a categoria à qual o cupom se aplica." };
  }
  if (out.scope === "products" && (has("scope_product_ids") || !partial) && (!out.scope_product_ids || out.scope_product_ids.length === 0)) {
    return { error: "Selecione ao menos um produto ao qual o cupom se aplica." };
  }

  if (!partial || has("min_order_value_cents")) {
    if (b.min_order_value_cents !== null && b.min_order_value_cents !== undefined) {
      if (
        typeof b.min_order_value_cents !== "number" ||
        !Number.isInteger(b.min_order_value_cents) ||
        b.min_order_value_cents < 0 ||
        b.min_order_value_cents > 100_000_00
      ) {
        return { error: "Valor mínimo do pedido inválido." };
      }
      out.min_order_value_cents = b.min_order_value_cents;
    } else {
      out.min_order_value_cents = null;
    }
  }

  if (!partial || has("max_uses")) {
    if (b.max_uses !== null && b.max_uses !== undefined) {
      if (typeof b.max_uses !== "number" || !Number.isInteger(b.max_uses) || b.max_uses <= 0) {
        return { error: "Limite de usos inválido." };
      }
      out.max_uses = b.max_uses;
    } else {
      out.max_uses = null;
    }
  }

  if (!partial || has("active")) {
    if (typeof b.active !== "boolean") return { error: "Campo 'active' inválido." };
    out.active = b.active;
  }

  const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

  if (!partial || has("valid_from")) {
    if (b.valid_from !== null && b.valid_from !== undefined) {
      if (typeof b.valid_from !== "string" || !DATE_ISO_RE.test(b.valid_from) || Number.isNaN(Date.parse(b.valid_from))) {
        return { error: "Data de início inválida." };
      }
      out.valid_from = b.valid_from;
    } else {
      out.valid_from = null;
    }
  }

  if (!partial || has("valid_until")) {
    if (b.valid_until !== null && b.valid_until !== undefined) {
      if (typeof b.valid_until !== "string" || !DATE_ISO_RE.test(b.valid_until) || Number.isNaN(Date.parse(b.valid_until))) {
        return { error: "Data de expiração inválida." };
      }
      out.valid_until = b.valid_until;
    } else {
      out.valid_until = null;
    }
  }

  if (out.valid_from && out.valid_until && new Date(out.valid_from) > new Date(out.valid_until)) {
    return { error: "A data de início não pode ser depois da data de expiração." };
  }

  return { data: out };
}
