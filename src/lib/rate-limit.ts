/**
 * Rate limiting simples em memória, por IP, para rotas públicas
 * sensíveis (checkout). Não substitui um rate-limiter de borda
 * (Cloudflare, Vercel Firewall) em produção com tráfego real, mas
 * evita flood básico de bots enquanto isso não é configurado.
 *
 * Limitação conhecida: em ambientes serverless com múltiplas instâncias,
 * cada instância tem seu próprio contador (não é compartilhado). Para
 * um controle robusto em produção, considere o Vercel Firewall/WAF ou
 * um rate-limiter com Redis (ex: Upstash).
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): boolean {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count += 1;
  return true;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
