/**
 * Comprime uma imagem no navegador (resize + reencode WebP) antes do
 * upload. Roda 100% no client via canvas — não gasta nenhuma cota de
 * otimização do Supabase nem da Vercel, e já entra pequena no bucket.
 *
 * Motivo de existir: o plano gratuito do Supabase tem um limite de 5GB de
 * "Cached Egress" para o Image Transformation deles. Path anterior:
 * subir a imagem crua e deixar algo (Supabase ou Next/Image) redimensionar
 * depois, gastando essa cota a cada acesso não cacheado. Path atual: a
 * imagem já sai pequena do dispositivo do admin, então nada precisa
 * transformar nada depois — a URL pública do bucket já é a versão final.
 */

const MAX_DIMENSION = 1600; // px no maior lado — suficiente pra qualquer card/hero do site
const WEBP_QUALITY = 0.8;

export async function compressImage(file: File): Promise<File> {
  // GIF perderia a animação se passasse por canvas — mantém como está.
  if (file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file; // fallback: navegador sem suporte, sobe o original

  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY)
  );
  if (!blob) return file; // fallback: encode falhou, sobe o original

  // Só troca se realmente compensou — imagem já pequena/simples pode gerar
  // um WebP maior que o original (raro, mas evita piorar nesses casos).
  if (blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], newName, { type: "image/webp" });
}
