import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { HomeHeroContent, HomeTrustCard } from "@/lib/types";

/**
 * Valores padrão — usados em modo demo (sem Supabase configurado) e como
 * fallback se a linha ainda não existir no banco (ex: schema.sql não rodado
 * ainda). Mantidos em sincronia com o seed em supabase/schema.sql seção 7.
 */
export const DEFAULT_HOME_HERO: HomeHeroContent = {
  badge: "Entrega em Salvador e Lauro de Freitas",
  title: "Tudo para te encantar. 🪄🧚‍♀️",
  description:
    "Transformamos momentos especiais em lembranças inesquecíveis. Bolsas personalizadas feitas com qualidade, carinho e atenção aos detalhes para surpreender seus convidados e tornar cada festa ainda mais especial.",
  button_label: "Ver produtos",
  image_url: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&q=80",
  image_alt: "Decoração de festa em tons de rosa com balões e arranjo",
};

export const DEFAULT_HOME_TRUST_CARDS: HomeTrustCard[] = [
  { title: "Retire sem taxa", description: "Cabula/Tancredo Neves, seg-sáb 14h-18h" },
  { title: "Entrega própria", description: "Salvador e Lauro de Freitas, taxa fixa" },
  { title: "Pagamento seguro", description: "Pix ou cartão via Mercado Pago" },
];

async function getContentValue<T>(key: string, fallback: T): Promise<T> {
  if (!isSupabaseConfigured()) return fallback;
  const supabase = await createClient();
  if (!supabase) return fallback;
  const { data, error } = await supabase
    .from("site_content")
    .select("value")
    .eq("key", key)
    .single();
  if (error || !data) return fallback;
  return data.value as T;
}

export async function getHomeHero(): Promise<HomeHeroContent> {
  return getContentValue("home.hero", DEFAULT_HOME_HERO);
}

export async function getHomeTrustCards(): Promise<HomeTrustCard[]> {
  return getContentValue("home.trust_cards", DEFAULT_HOME_TRUST_CARDS);
}

/** Busca os dois blocos de uma vez (usado no editor admin). */
export async function getAllHomeContent(): Promise<{
  hero: HomeHeroContent;
  trustCards: HomeTrustCard[];
}> {
  const [hero, trustCards] = await Promise.all([getHomeHero(), getHomeTrustCards()]);
  return { hero, trustCards };
}

export async function setHomeHero(
  hero: HomeHeroContent
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  const { error } = await supabase
    .from("site_content")
    .upsert({ key: "home.hero", value: hero, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function setHomeTrustCards(
  cards: HomeTrustCard[]
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  const { error } = await supabase
    .from("site_content")
    .upsert({ key: "home.trust_cards", value: cards, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  return { ok: true };
}
