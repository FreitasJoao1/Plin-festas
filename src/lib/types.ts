export type ProductCategory =
  | "bolsas"
  | "necessaires"
  | "copos"
  | "lembrancinhas"
  | "chaveiros"
  | "outros";

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: ProductCategory;
  price_cents: number;
  compare_at_price_cents: number | null;
  /** Pedido mínimo de unidades (null = sem mínimo) */
  min_order: number | null;
  /** Pedido mínimo em valor, centavos (null = sem mínimo) */
  min_order_value_cents: number | null;
  stock: number;
  images: string[];
  active: boolean;
  created_at: string;
}

export type ShippingMethod =
  | "retirada"
  | "entrega_propria"
  | "uber_flash"
  | "correios";

export type DeliveryCity = "salvador" | "lauro_de_freitas";

export interface ShippingQuote {
  method: ShippingMethod;
  label: string;
  price_cents: number;
  manual: boolean;
  note: string;
}

export type OrderStatus =
  | "novo"
  | "confirmado"
  | "em_producao"
  | "pronto"
  | "enviado"
  | "entregue"
  | "cancelado";

/** Status de aprovação da DATA solicitada — independente do status de produção acima. */
export type BookingStatus = "pending_approval" | "approved" | "rejected";

/** Estorno é sempre manual (sem gateway de pagamento no site). */
export type RefundStatus = "none" | "refund_pending" | "refunded";

export interface OrderItem {
  product_id: string;
  name: string;
  unit_price_cents: number;
  quantity: number;
}

// ── Cupons de desconto ──────────────────────────────────────────────────

export type CouponDiscountType = "percentage" | "fixed";

/** A quais itens do carrinho o cupom se aplica. */
export type CouponScope = "all" | "category" | "products";

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: CouponDiscountType;
  /** Percentual (1-100) se discount_type='percentage', ou centavos se 'fixed'. */
  discount_value: number;
  scope: CouponScope;
  scope_category: ProductCategory | null;
  scope_product_ids: string[];
  /** Valor mínimo (centavos) dos itens ELEGÍVEIS ao cupom para o desconto valer. */
  min_order_value_cents: number | null;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
}

/** Estado de um pagamento opcional via InfinitePay — 'none' quando o cliente escolheu WhatsApp em vez de pagar online. */
export type PaymentStatus = "none" | "pending" | "paid" | "failed";
export type PaymentMethod = "pix" | "credit_card";
export type PaymentPlan = "full" | "split_50_50";

export interface Order {
  id: string;
  /** Código legível gerado na criação, ex: PLN-2507-A3K */
  order_code: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  items: OrderItem[];
  subtotal_cents: number;
  /** Código do cupom aplicado (já validado no servidor), ou null se nenhum. */
  coupon_code: string | null;
  /** Desconto em centavos já calculado e validado no servidor. */
  discount_cents: number;
  shipping_method: ShippingMethod;
  shipping_city: DeliveryCity | null;
  shipping_cents: number;
  total_cents: number;
  status: OrderStatus;
  /** Observação do cliente */
  note: string | null;
  booking_date: string | null;
  booking_status: BookingStatus;
  booking_rejection_reason: string | null;
  booking_alternative_date: string | null;
  refund_status: RefundStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  infinitepay_order_nsu: string | null;
  infinitepay_transaction_nsu: string | null;
  infinitepay_invoice_slug: string | null;
  infinitepay_paid_amount_cents: number | null;
  /** 'full' = cobra tudo de uma vez. 'split_50_50' = 50% sinal (usa os campos payment_* acima) + 50% saldo na entrega (campos balance_* abaixo). */
  payment_plan: PaymentPlan;
  /** Valor do sinal em centavos (50% do total). 0 quando payment_plan='full'. */
  deposit_amount_cents: number;
  /** Valor do saldo restante em centavos (50% do total), cobrado na entrega. 0 quando payment_plan='full'. */
  balance_amount_cents: number;
  balance_payment_status: PaymentStatus;
  balance_payment_method: PaymentMethod | null;
  balance_infinitepay_transaction_nsu: string | null;
  balance_infinitepay_invoice_slug: string | null;
  balance_infinitepay_paid_amount_cents: number | null;
  created_at: string;
}

export interface BookingSettings {
  weekly_capacity: number;
  horizon_days: number;
}

/** Ocupação agregada de uma semana, para renderizar o calendário. */
export interface WeekOccupancy {
  /** Segunda-feira da semana, formato YYYY-MM-DD */
  week_start: string;
  count: number;
  /** Cota efetiva já resolvida (override da semana, se existir, senão o padrão global). */
  capacity: number;
  /** true se a cota veio de um override manual, não do padrão global. */
  has_override: boolean;
}

export type DayStatus = "available" | "limited" | "full" | "blocked";

/** Sobrescrita manual de status de um dia específico, independente da ocupação calculada. */
export interface DayStatusOverride {
  date: string;
  status: DayStatus;
}

/** Bloco "hero" editável da home — texto e imagem de apresentação principal. */
export interface HomeHeroContent {
  badge: string;
  title: string;
  description: string;
  button_label: string;
  image_url: string;
  image_alt: string;
}

/** Um dos 3 cards de confiança no rodapé da home (só texto, ícone é fixo). */
export interface HomeTrustCard {
  title: string;
  description: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: "cliente" | "admin";
}
