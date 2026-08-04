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

/**
 * O fluxo de pagamento online (link/status) precisa de service_role para
 * ler pedidos de checkout anônimo (user_id=null), já que RLS nunca
 * reconhece "auth.uid() = null" como o próprio dono — ver comentário em
 * getOrderByIdForPaymentFlow (src/lib/orders.ts). Se essa variável faltar
 * no ambiente de deploy, é melhor avisar com uma mensagem específica do
 * que deixar cair no genérico "pedido não encontrado".
 */
export function isServiceRoleConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
