import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

// ROTA TEMPORÁRIA — apaga depois de rodar uma vez.
// Reenvia todas as imagens já existentes nos buckets "product-images" e
// "site-content" com cacheControl de 1 ano, substituindo o cache de 1h
// com que foram enviadas originalmente. Reduz Cached Egress em visitas
// repetidas.
//
// Uso: acesse /api/admin/refresh-image-cache logado como admin.

const BUCKETS = ["product-images", "site-content"];
const NEW_CACHE_CONTROL = "31536000"; // 1 ano

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const supabase = createServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 500 });
  }

  const results: Record<string, { ok: string[]; failed: { path: string; error: string }[] }> = {};

  for (const bucket of BUCKETS) {
    results[bucket] = { ok: [], failed: [] };

    const { data: files, error: listError } = await supabase.storage
      .from(bucket)
      .list("", { limit: 1000 });

    if (listError) {
      results[bucket].failed.push({ path: "(list)", error: listError.message });
      continue;
    }

    for (const file of files ?? []) {
      const path = file.name;

      const { data: downloaded, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(path);

      if (downloadError) {
        results[bucket].failed.push({ path, error: downloadError.message });
        continue;
      }

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .update(path, downloaded, {
          cacheControl: NEW_CACHE_CONTROL,
          upsert: true,
        });

      if (uploadError) {
        results[bucket].failed.push({ path, error: uploadError.message });
        continue;
      }

      results[bucket].ok.push(path);
    }
  }

  return NextResponse.json({ done: true, results });
}
