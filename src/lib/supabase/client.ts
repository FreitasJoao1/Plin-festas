import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para Client Components ("use client").
 *
 * Usa `createBrowserClient` de `@supabase/ssr` (NÃO o `createClient` de
 * `@supabase/supabase-js` puro). O motivo não é estilo — é o que faz o
 * login funcionar em todo o site:
 *
 * - `@supabase/supabase-js` puro guarda a sessão só no localStorage.
 * - `@supabase/ssr` guarda a sessão em COOKIES, que viajam com toda
 *   requisição ao servidor.
 *
 * O middleware e os Server Components só leem sessão via cookie. Usar o
 * client errado aqui faz o navegador achar que está logado (localStorage
 * tem o token) mas o servidor nunca vê a sessão — todo acesso a /admin
 * ou /conta é barrado e a pessoa cai de volta no login mesmo depois de
 * logar com sucesso. NÃO trocar esta implementação.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
