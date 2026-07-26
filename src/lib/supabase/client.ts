import { createBrowserClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "./config";

/**
 * Cliente Supabase para Client Components ("use client").
 * Retorna `null` em modo demo — todo código que chama isso precisa checar
 * o retorno antes de usar (ver src/lib/products.ts para o padrão).
 */
export function createClient() {
  if (!isSupabaseConfigured()) return null;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
