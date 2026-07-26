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

export interface OrderItem {
  product_id: string;
  name: string;
  unit_price_cents: number;
  quantity: number;
}

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
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: "cliente" | "admin";
}
