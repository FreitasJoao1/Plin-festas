"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X, ShoppingBag, User, Sparkles, ShieldAlert, LogOut } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS } from "@/lib/mock-data";
import { ProductCategory } from "@/lib/types";
import PlinLogo from "@/components/PlinLogo";

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [ProductCategory, string][];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const totalItems = useCartStore((s) => s.totalItems());
  const openCart = useCartStore((s) => s.open);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    async function loadUser() {
      const { data: { user } } = await supabase!.auth.getUser();
      
      if (user) {
        setLoggedIn(true);
        const adminFlag = user.user_metadata?.is_admin || user.app_metadata?.role === 'admin';
        setIsAdmin(!!adminFlag);

        const { data: profile } = await supabase!
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();

        if (profile?.role === 'admin') setIsAdmin(true);

        const name = profile?.full_name || user.user_metadata?.full_name;
        const first = name?.trim().split(" ")[0];
        setFirstName(first || "Conta");
      } else {
        setLoggedIn(false);
        setFirstName(null);
        setIsAdmin(false);
      }
    }

    loadUser();
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadUser());
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    setUserDropdownOpen(false);
    setLoggedIn(false);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-pink-100 bg-white/95 backdrop-blur">
      <div className="container-plin flex h-20 items-center justify-between gap-4">
        <button
          className="rounded-full p-2 transition-colors hover:bg-pink-50 md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          {menuOpen ? <X className="h-5 w-5 text-ink" /> : <Menu className="h-5 w-5 text-ink" />}
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
          {/* Dropdown do Usuário */}
          <div className="relative" ref={dropdownRef}>
            {loggedIn ? (
              <button
                onClick={() => setUserDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-ink-soft transition-colors hover:bg-pink-50 hover:text-pink-600"
              >
                <User className="h-5 w-5 text-pink-500" />
                <span className="hidden text-sm font-medium sm:inline">
                  {firstName}
                </span>
              </button>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 rounded-full p-2 text-ink-soft transition-colors hover:bg-pink-50 hover:text-pink-600"
              >
                <User className="h-5 w-5" />
                <span className="hidden text-sm font-medium sm:inline">Entrar</span>
              </Link>
            )}

            {/* Submenu ao Clicar na Conta */}
            {loggedIn && userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-pink-100 bg-white p-2 shadow-xl z-50">
                <Link
                  href="/conta"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:bg-pink-50 hover:text-pink-600"
                >
                  <User className="h-4 w-4 text-pink-500" />
                  <span>Minha Conta</span>
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 rounded-xl bg-pink-50 px-3 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-100"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>Painel Admin</span>
                  </Link>
                )}

                <hr className="my-1 border-pink-100" />

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>

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

      {/* Faixa Rosa com Saudação do Usuário */}
      {loggedIn && firstName && (
        <div className="bg-gradient-to-r from-pink-400 via-lilac-400 to-babyblue-400 px-4 py-2">
          <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-white">
            <Sparkles className="h-3.5 w-3.5" />
            Olá, {firstName}! Como posso te ajudar hoje?
          </p>
        </div>
      )}

      {/* Menu Hambúrguer do Mobile */}
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
