import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type AdminGuard =
  | { ok: true; user: { id: string } }
  | { ok: false; status: number; error: string };

/**
 * Confere autenticação + role='admin' dentro das rotas de API do painel.
 * É uma segunda camada de proteção além do middleware — o middleware já
 * bloqueia o acesso às páginas /admin/*, mas o matcher dele não cobre
 * /api/admin/*, então as rotas de API precisam checar por conta própria.
 */
export async function requireAdmin(): Promise<AdminGuard> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      status: 503,
      error:
        "Supabase não está configurado neste ambiente (modo demo) — ações de admin exigem o banco configurado.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase!.auth.getUser();

  if (!user) {
    return { ok: false, status: 401, error: "Não autenticado." };
  }

  const { data: profile } = await supabase!
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { ok: false, status: 403, error: "Acesso restrito a administradores." };
  }

  return { ok: true, user: { id: user.id } };
}
