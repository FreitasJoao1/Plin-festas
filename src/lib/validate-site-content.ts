import { HomeHeroContent, HomeTrustCard } from "@/lib/types";

/**
 * Limites de caracteres calibrados para não quebrar o layout do hero
 * (grid 2 colunas, título em font-display grande). Não são arbitrários:
 * títulos/badges muito longos quebram linha de forma feia no hero atual.
 */
const LIMITS = {
  badge: 60,
  title: 90,
  description: 400,
  button_label: 30,
  image_alt: 200,
  card_title: 40,
  card_description: 120,
};

const MAX_TRUST_CARDS = 3;
const MIN_TRUST_CARDS = 3; // o layout é grid de 3 colunas fixo — menos que 3 deixa buraco

/** Dimensão mínima para a imagem do hero não ficar borrada/pixelada no grid de até 480px. */
const MIN_HERO_IMAGE_WIDTH = 600;
const MIN_HERO_IMAGE_HEIGHT = 600;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function validateHomeHero(
  body: unknown
): { data: HomeHeroContent } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Corpo inválido." };
  const b = body as Record<string, unknown>;

  if (!isNonEmptyString(b.badge) || b.badge.length > LIMITS.badge) {
    return { error: `Badge é obrigatório, até ${LIMITS.badge} caracteres.` };
  }
  if (!isNonEmptyString(b.title) || b.title.length > LIMITS.title) {
    return { error: `Título é obrigatório, até ${LIMITS.title} caracteres (evita quebrar o layout do hero).` };
  }
  if (!isNonEmptyString(b.description) || b.description.length > LIMITS.description) {
    return { error: `Descrição é obrigatória, até ${LIMITS.description} caracteres.` };
  }
  if (!isNonEmptyString(b.button_label) || b.button_label.length > LIMITS.button_label) {
    return { error: `Texto do botão é obrigatório, até ${LIMITS.button_label} caracteres.` };
  }
  if (!isNonEmptyString(b.image_url) || b.image_url.length > 2000) {
    return { error: "Imagem é obrigatória (envie uma foto)." };
  }
  if (!isNonEmptyString(b.image_alt) || b.image_alt.length > LIMITS.image_alt) {
    return { error: `Texto alternativo da imagem é obrigatório, até ${LIMITS.image_alt} caracteres.` };
  }

  return {
    data: {
      badge: b.badge.trim(),
      title: b.title.trim(),
      description: b.description.trim(),
      button_label: b.button_label.trim(),
      image_url: b.image_url.trim(),
      image_alt: b.image_alt.trim(),
    },
  };
}

export function validateHomeTrustCards(
  body: unknown
): { data: HomeTrustCard[] } | { error: string } {
  if (!Array.isArray(body)) return { error: "Formato inválido." };
  if (body.length !== MIN_TRUST_CARDS) {
    return { error: `É preciso exatamente ${MAX_TRUST_CARDS} cards (o layout é fixo em 3 colunas).` };
  }
  const out: HomeTrustCard[] = [];
  for (const item of body) {
    if (typeof item !== "object" || item === null) return { error: "Card inválido." };
    const c = item as Record<string, unknown>;
    if (!isNonEmptyString(c.title) || c.title.length > LIMITS.card_title) {
      return { error: `Título do card é obrigatório, até ${LIMITS.card_title} caracteres.` };
    }
    if (!isNonEmptyString(c.description) || c.description.length > LIMITS.card_description) {
      return { error: `Descrição do card é obrigatória, até ${LIMITS.card_description} caracteres.` };
    }
    out.push({ title: c.title.trim(), description: c.description.trim() });
  }
  return { data: out };
}

/**
 * Valida as dimensões reais da imagem (não só a URL) baixando os bytes e
 * lendo o header. Evita o admin subir uma foto pequena/quadrada errada que
 * fica esticada ou pixelada no hero (que é renderizado em aspect-square até
 * 480px de largura).
 */
export async function validateImageDimensions(
  imageUrl: string
): Promise<{ ok: true } | { error: string }> {
  try {
    const res = await fetch(imageUrl, { method: "GET" });
    if (!res.ok) return { error: "Não foi possível acessar a imagem enviada." };
    const buffer = Buffer.from(await res.arrayBuffer());
    const dims = readImageDimensions(buffer);
    if (!dims) return { error: "Formato de imagem não reconhecido." };
    if (dims.width < MIN_HERO_IMAGE_WIDTH || dims.height < MIN_HERO_IMAGE_HEIGHT) {
      return {
        error: `Imagem muito pequena (${dims.width}×${dims.height}px). Mínimo ${MIN_HERO_IMAGE_WIDTH}×${MIN_HERO_IMAGE_HEIGHT}px para não ficar borrada.`,
      };
    }
    return { ok: true };
  } catch {
    return { error: "Erro ao validar a imagem enviada." };
  }
}

/** Lê width/height de PNG, JPEG ou WEBP direto dos bytes, sem depender de libs de imagem. */
function readImageDimensions(buf: Buffer): { width: number; height: number } | null {
  // PNG: assinatura fixa, IHDR sempre começa no byte 16
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: percorre os marcadores SOF
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length - 8) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      const isSOF =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      const segmentLength = buf.readUInt16BE(offset + 2);
      if (isSOF) {
        return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      }
      offset += 2 + segmentLength;
    }
    return null;
  }
  // WEBP (VP8/VP8L/VP8X, formato RIFF)
  if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const format = buf.toString("ascii", 12, 16);
    if (format === "VP8X") {
      const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { width, height };
    }
    if (format === "VP8 ") {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (format === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}
