"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ShoppingBag, User, Sparkles } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS } from "@/lib/mock-data";
import { ProductCategory } from "@/lib/types";
import PlinLogo from "@/components/PlinLogo";

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [
  ProductCategory,
  string
][];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const totalItems = useCartStore((s) => s.totalItems());
  const openCart = useCartStore((s) => s.open);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return; // modo demo: sem sessão

    async function loadUser() {
      const { data } = await supabase!.auth.getUser();
      setLoggedIn(!!data.user);

      if (data.user) {
        const { data: profile } = await supabase!
          .from("profiles")
          .select("full_name")
          .eq("id", data.user.id)
          .single();
        const first = profile?.full_name?.trim().split(" ")[0];
        setFirstName(first || null);
      } else {
        setFirstName(null);
      }
    }

    loadUser();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadUser());
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-pink-100 bg-white/90 backdrop-blur">
      <div className="container-plin flex h-20 items-center justify-between gap-4">
        <button
          className="rounded-full p-2 transition-colors hover:bg-pink-50 md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link href="/" aria-label="Plin Designs — Início" className="transition-transform hover:scale-105">
          <PlinLogo className="h-14 w-auto sm:h-16" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {CATEGORIES.map(([slug, label]) => (
            <Link
              key={slug}
              href={`/produtos?categoria=${slug}`}
              className="text-sm font-medium text-ink-soft transition-colors hover:text-pink-600"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href={loggedIn ? "/conta" : "/login"}
            className="flex items-center gap-1.5 rounded-full p-2 text-ink-soft transition-colors hover:bg-pink-50 hover:text-pink-600"
          >
            <User className="h-5 w-5" />
            <span className="hidden text-sm font-medium sm:inline">
              {loggedIn ? (firstName ? firstName : "Minha conta") : "Entrar"}
            </span>
          </Link>

          <button
            onClick={openCart}
            aria-label="Abrir carrinho"
            className="relative rounded-full p-2 transition-colors hover:bg-pink-50"
          >
            <ShoppingBag className="h-5 w-5 text-ink-soft" />
            {totalItems > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] animate-pulse items-center justify-center rounded-full bg-pink-500 px-1 text-[10px] font-bold text-white">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Saudação estética para cliente logado */}
      {loggedIn && firstName && (
        <div className="bg-gradient-to-r from-pink-400 via-lilac-400 to-babyblue-400 px-4 py-2">
          <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-white">
            <Sparkles className="h-3.5 w-3.5" />
            Olá, {firstName}! Como posso te ajudar hoje?
          </p>
        </div>
      )}

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-pink-100 bg-white px-4 py-3 md:hidden">
          {CATEGORIES.map(([slug, label]) => (
            <Link
              key={slug}
              href={`/produtos?categoria=${slug}`}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-2 py-2 text-sm font-medium text-ink transition-colors hover:bg-pink-50"
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
