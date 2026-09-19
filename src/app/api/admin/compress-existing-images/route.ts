import { NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

// ROTA DE MANUTENÇÃO — acesse /api/admin/compress-existing-images logado
// como admin sempre que quiser reduzir o storage já usado.
//
// Recomprime todas as imagens já existentes nos buckets "product-images" e
// "site-content": redimensiona pro máximo de 1600px no maior lado e
// reencoda como WebP qualidade 80. Isso é o mesmo tratamento que as
// imagens novas já recebem no upload (ver src/lib/compress-image.ts), só
// que aplicado retroativamente às que já estavam no bucket antes dessa
// mudança — é o que reduz o storage ACUMULADO, não só freia o crescimento.
//
// Substitui só_bytes (>5% menor) — se o WebP recomprimido não ficar
// visivelmente menor que o arquivo atual, mantém o original como está
// (evita reprocessar em loop um arquivo que já está otimizado).
const BUCKETS = ["product-images", "site-content"];
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 80;
const MIN_SAVINGS_RATIO = 0.95; // só substitui se o novo arquivo for <= 95% do tamanho atual

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  }

  const results: Record<
    string,
    { compressed: { path: string; before: number; after: number }[]; skipped: string[]; failed: { path: string; error: string }[] }
  > = {};

  let totalSavedBytes = 0;

  for (const bucket of BUCKETS) {
    results[bucket] = { compressed: [], skipped: [], failed: [] };

    const { data: files, error: listError } = await supabase.storage
      .from(bucket)
      .list("", { limit: 1000 });

    if (listError) {
      results[bucket].failed.push({ path: "(list)", error: listError.message });
      continue;
    }

    for (const file of files ?? []) {
      const path = file.name;

      // GIFs animados perderiam a animação ao passar por sharp — pula.
      if (path.toLowerCase().endsWith(".gif")) {
        results[bucket].skipped.push(path);
        continue;
      }

      const { data: downloaded, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(path);

      if (downloadError) {
        results[bucket].failed.push({ path, error: downloadError.message });
        continue;
      }

      const originalBuffer = Buffer.from(await downloaded.arrayBuffer());
      const originalSize = originalBuffer.byteLength;

      let compressedBuffer: Buffer;
      try {
        compressedBuffer = await sharp(originalBuffer)
          .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();
      } catch (err) {
        results[bucket].failed.push({
          path,
          error: err instanceof Error ? err.message : "Falha ao processar imagem.",
        });
        continue;
      }

      if (compressedBuffer.byteLength >= originalSize * MIN_SAVINGS_RATIO) {
        results[bucket].skipped.push(path);
        continue;
      }

      // path novo (.webp) — atualiza o mesmo nome-base pra não quebrar a
      // URL já salva no produto/conteúdo. Se o arquivo original já não
      // era .webp, o path muda; nesse caso fazemos upload do novo arquivo
      // E deixamos o antigo, porque não temos aqui a referência de quem
      // aponta pra essa URL para atualizar em cascata (products/site_content).
      // Por isso: só recomprime em-place quando o arquivo já é .webp.
      if (!path.toLowerCase().endsWith(".webp")) {
        results[bucket].skipped.push(path);
        continue;
      }

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .update(path, compressedBuffer, {
          cacheControl: "31536000",
          upsert: true,
          contentType: "image/webp",
        });

      if (uploadError) {
        results[bucket].failed.push({ path, error: uploadError.message });
        continue;
      }

      const saved = originalSize - compressedBuffer.byteLength;
      totalSavedBytes += saved;
      results[bucket].compressed.push({ path, before: originalSize, after: compressedBuffer.byteLength });
    }
  }

  return NextResponse.json({ done: true, totalSavedMB: (totalSavedBytes / 1024 / 1024).toFixed(2), results });
}
