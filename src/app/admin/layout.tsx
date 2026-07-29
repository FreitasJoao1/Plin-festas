import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Package, ClipboardList, CalendarDays, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import PlinLogo from "@/components/PlinLogo";
import RealtimeOrdersNotifier from "@/components/admin/RealtimeOrdersNotifier";

export const metadata = { title: "Admin — Plin Designs" };

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/agenda", label: "Agenda", icon: CalendarDays },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demoMode = !isSupabaseConfigured();

  // O middleware (src/lib/supabase/middleware.ts) já bloqueia /admin/* para
  // quem não é admin em modo real — esta é uma segunda checagem no próprio
  // layout, por defesa em profundidade. Em modo demo, o middleware não faz
  // nada, então deixamos o painel acessível só para visualização (com aviso).
  if (!demoMode) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase!.auth.getUser();

    if (!user) redirect("/login?redirect=/admin");

    const { data: profile } = await supabase!
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") redirect("/");
  }

  return (
    <div className="min-h-screen bg-pink-50/40">
      {demoMode && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-800">
          Modo demo: o Supabase não está configurado, então o painel mostra
          dados de exemplo e as ações de salvar/excluir ficam desativadas.
        </div>
      )}

      {/* Cabeçalho + nav mobile */}
      <div className="flex items-center justify-between border-b border-pink-100 bg-white px-4 py-3 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <PlinLogo className="h-8 w-auto" />
          <span className="text-sm font-normal text-ink-soft">admin</span>
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-pink-100 bg-white px-4 py-2 md:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft hover:bg-pink-50 hover:text-pink-600"
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </nav>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-56 flex-shrink-0 flex-col border-r border-pink-100 bg-white p-4 md:flex">
          <Link href="/" className="mb-8">
            <PlinLogo className="h-10 w-auto" />
          </Link>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:bg-pink-50 hover:text-pink-600"
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
          </nav>
          <Link
            href="/"
            className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:bg-pink-50"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao site
          </Link>
        </aside>

        <main className="min-w-0 flex-1 p-6 md:p-8">{children}</main>
      </div>

      <RealtimeOrdersNotifier />
    </div>
  );
}
