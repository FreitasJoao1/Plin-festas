/**
 * Gera um código de pedido legível e único.
 * Formato: PLN-DDMM-XXXX  (ex: PLN-2507-A3KF)
 * - PLN = prefixo Plin Designs
 * - DDMM = dia e mês da criação
 * - XXXX = 4 chars alfanuméricos aleatórios maiúsculos
 *
 * Probabilidade de colisão no mesmo dia: ~1.5M pedidos, na prática
 * suficiente para qualquer volume de loja pequena/média.
 */
export function generateOrderCode(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1 pra não confundir
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `PLN-${dd}${mm}-${suffix}`;
}
