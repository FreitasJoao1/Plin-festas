import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Status a partir dos quais o cliente ainda pode cancelar o próprio pedido. */
const CANCELABLE_STATUSES = ["novo", "confirmado"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`cancelar-pedido:${ip}`, { limit: 15, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um minuto e tente novamente." },
      { status: 429 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase não está configurado neste ambiente (modo demo)." },
      { status: 503 }
    );
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase!.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Busca o pedido primeiro para dar mensagens de erro específicas
  // (RLS já garante que só o dono ou admin conseguem ler a linha).
  const { data: order, error: fetchError } = await supabase!
    .from("orders")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (fetchError || !order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (order.user_id !== user.id) {
    return NextResponse.json(
      { error: "Este pedido não pertence à sua conta." },
      { status: 403 }
    );
  }

  if (!CANCELABLE_STATUSES.includes(order.status)) {
    return NextResponse.json(
      {
        error:
          "Este pedido já entrou em produção ou foi concluído e não pode mais ser cancelado. Fale com a loja pelo WhatsApp.",
      },
      { status: 409 }
    );
  }

  // O update passa pela policy "orders_client_cancel" + trigger de guarda
  // definidas no schema — mesmo que este código tenha um bug, o banco
  // não deixa o cliente alterar nada além do status para 'cancelado'.
  const { error: updateError } = await supabase!
    .from("orders")
    .update({ status: "cancelado" })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
