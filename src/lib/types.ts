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
  /** Pedido mínimo de unidades (null = sem mínimo). Mutuamente exclusivo com min_order_value_cents. */
  min_order: number | null;
  /** Pedido mínimo em valor, no carrinho, para este produto (null = sem mínimo). Mutuamente exclusivo com min_order. */
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

/** Estado de um pagamento opcional via InfinitePay — 'none' quando o cliente escolheu WhatsApp em vez de pagar online. */
export type PaymentStatus = "none" | "pending" | "paid" | "failed";
export type PaymentMethod = "pix" | "credit_card";

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
  capacity: number;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: "cliente" | "admin";
}

export interface DaySchedule {
  id: string;
  day: string;
  is_open: boolean;
  capacity_override: number | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteCustomization {
  id: number;
  hero_title: string | null;
  hero_subtitle: string | null;
  hero_image_url: string | null;
  footer_text: string | null;
  about_text: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
