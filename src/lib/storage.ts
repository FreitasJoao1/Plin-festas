import { createClient } from "@/lib/supabase/client";

const BUCKET = "product-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Envia uma imagem para o Supabase Storage (bucket público "product-images")
 * e retorna a URL pública. Usado no formulário de produto do admin.
 * A policy do bucket (ver supabase/schema.sql, seção 5) só permite
 * upload para quem tem role=admin — a checagem de permissão já acontece
 * no lado do banco, não só no client. Aqui validamos tamanho e tipo do
 * arquivo antes de gastar banda enviando algo inválido.
 */
export async function uploadProductImage(
  file: File
): Promise<{ url: string } | { error: string }> {
  const supabase = createClient();
  if (!supabase) {
    return { error: "Supabase não configurado (modo demo) — upload indisponível." };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: "Formato inválido. Use JPG, PNG, WEBP ou GIF." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "Arquivo muito grande (máximo 5MB)." };
  }

  const ext = EXT_BY_TYPE[file.type];
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Remove uma imagem do Storage a partir da URL pública salva no produto. */
export async function deleteProductImage(url: string): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;

  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return; // não é uma URL do nosso bucket (ex: Unsplash demo)

  const path = url.slice(idx + marker.length);
  await supabase.storage.from(BUCKET).remove([path]);
}
