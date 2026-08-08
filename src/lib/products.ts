import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { Product, ProductCategory } from "@/lib/types";

export async function getProducts(opts: {
  category?: ProductCategory | ProductCategory[];
} = {}): Promise<Product[]> {
  const categories = opts.category
    ? Array.isArray(opts.category) ? opts.category : [opts.category]
    : undefined;

  if (!isSupabaseConfigured()) {
    const items = MOCK_PRODUCTS.filter((p) => p.active);
    return categories
      ? items.filter((p) => categories.includes(p.category))
      : items;
  }

  const supabase = await createClient();
  let query = supabase!.from("products").select("*").eq("active", true);
  if (categories) query = query.in("category", categories);
  const { data, error } = await query.order("created_at", {
    ascending: false,
  });

  if (error) {
    console.error("Erro ao buscar produtos:", error.message);
    return [];
  }
  return data as Product[];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!isSupabaseConfigured()) {
    return MOCK_PRODUCTS.find((p) => p.slug === slug) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase!
    .from("products")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return null;
  return data as Product;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];

  if (!isSupabaseConfigured()) {
    return MOCK_PRODUCTS.filter((p) => ids.includes(p.id));
  }

  const supabase = await createClient();
  const { data, error } = await supabase!
    .from("products")
    .select("*")
    .in("id", ids);

  if (error) {
    console.error("Erro ao buscar produtos por id:", error.message);
    return [];
  }
  return data as Product[];
}

export async function getFeaturedProducts(limit = 12): Promise<Product[]> {
  const all = await getProducts();
  return all.slice(0, limit);
}

/** Produtos ativos com preço "de/por" (compare_at_price_cents > price_cents) e em estoque. */
export async function getPromoProducts(limit = 8): Promise<Product[]> {
  const all = await getProducts();
  return all
    .filter(
      (p) =>
        p.stock > 0 &&
        p.compare_at_price_cents !== null &&
        p.compare_at_price_cents > p.price_cents
    )
    .slice(0, limit);
}

// ============================================================================
// Funções de admin — usadas só dentro de /admin (rotas protegidas pelo
// middleware). Diferente de getProducts(), estas trazem produtos inativos
// também, porque quem gerencia o catálogo precisa vê-los.
// ============================================================================

export async function getProductById(id: string): Promise<Product | null> {
  if (!isSupabaseConfigured()) {
    return MOCK_PRODUCTS.find((p) => p.id === id) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase!
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Product;
}

export async function getAllProductsAdmin(): Promise<Product[]> {
  if (!isSupabaseConfigured()) {
    // Modo demo: mostra o catálogo mock só para visualização — criar,
    // editar e excluir de verdade exige Supabase configurado.
    return MOCK_PRODUCTS;
  }

  const supabase = await createClient();
  const { data, error } = await supabase!
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar produtos (admin):", error.message);
    return [];
  }
  return data as Product[];
}

export interface ProductInput {
  slug: string;
  name: string;
  description: string;
  category: ProductCategory;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock: number;
  images: string[];
  active: boolean;
  min_order?: number | null;
  min_order_value_cents?: number | null;
}

type AdminResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export async function createProduct(
  input: ProductInput
): Promise<AdminResult<{ id: string }>> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase não está configurado neste ambiente (modo demo) — configure as variáveis do .env.local para criar produtos de verdade.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase!
    .from("products")
    .insert(input)
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { data: { id: data.id } };
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>
): Promise<AdminResult<{ ok: true }>> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  }

  const supabase = await createClient();
  const { error } = await supabase!.from("products").update(input).eq("id", id);

  if (error) return { error: error.message };
  return { data: { ok: true } };
}

export async function deleteProduct(id: string): Promise<AdminResult<{ ok: true }>> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  }

  const supabase = await createClient();
  const { error } = await supabase!.from("products").delete().eq("id", id);

  if (error) return { error: error.message };
  return { data: { ok: true } };
}
