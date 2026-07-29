import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Envia uma imagem para um bucket público do Supabase Storage e retorna a
 * URL pública. As policies dos buckets (ver supabase/schema.sql) só
 * permitem upload para quem tem role=admin — a checagem de permissão já
 * acontece no lado do banco, não só no client. Aqui validamos tamanho e
 * tipo do arquivo antes de gastar banda enviando algo inválido.
 */
async function uploadImage(
  file: File,
  bucket: string
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
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Envia uma imagem de produto (bucket "product-images"). Usado no formulário de produto do admin. */
export async function uploadProductImage(file: File): Promise<{ url: string } | { error: string }> {
  return uploadImage(file, "product-images");
}

/** Envia uma imagem de bloco editável da home (bucket "site-content"). Usado em /admin/site. */
export async function uploadSiteContentImage(file: File): Promise<{ url: string } | { error: string }> {
  return uploadImage(file, "site-content");
}

/** Remove uma imagem do Storage a partir da URL pública salva no produto. */
export async function deleteProductImage(url: string): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;

  const marker = `/object/public/product-images/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return; // não é uma URL do nosso bucket (ex: Unsplash demo)

  const path = url.slice(idx + marker.length);
  await supabase.storage.from("product-images").remove([path]);
}
