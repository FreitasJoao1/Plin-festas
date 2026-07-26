/**
 * O site inteiro consegue rodar em "modo demo" (sem banco real) para você
 * navegar e validar UX/fluxo. Isso aqui é o único lugar que decide se
 * estamos em modo demo ou modo real — todo o resto do código consulta
 * esta função em vez de checar `process.env` direto.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
