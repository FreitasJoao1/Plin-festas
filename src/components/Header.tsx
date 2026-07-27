'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShoppingBag, 
  User, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  ShieldAlert, 
  Package, 
  Settings, 
  LogOut, 
  ChevronDown 
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/lib/cart-store';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const { totalItems, toggleCart } = useCartStore();
  const supabase = createClient();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  // Carregar estado do usuário e tema
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Verifica se o usuário é admin via metadata ou role
        const adminStatus = user.user_metadata?.is_admin || user.app_metadata?.role === 'admin';
        setIsAdmin(!!adminStatus);
      }
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setIsAdmin(!!(currentUser?.user_metadata?.is_admin || currentUser?.app_metadata?.role === 'admin'));
    });

    // Tema escuro
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Fechar menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsUserMenuOpen(false);
    setUser(null);
    setIsAdmin(false);
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-2xl font-black tracking-tight text-primary">PLIN FESTAS</span>
        </Link>

        {/* Navegação Desktop */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          <Link href="/produtos" className="transition-colors hover:text-primary">
            Produtos
          </Link>
          <Link href="/produtos?categoria=decoracao" className="transition-colors hover:text-primary">
            Decoração
          </Link>
          <Link href="/produtos?categoria=descartaveis" className="transition-colors hover:text-primary">
            Descartáveis
          </Link>
          <Link href="/produtos?categoria=baloes" className="transition-colors hover:text-primary">
            Balões
          </Link>
        </nav>

        {/* Ações / Ícones */}
        <div className="flex items-center space-x-4">
          {/* Menu de Usuário */}
          <div className="relative" ref={menuRef}>
            {user ? (
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-1 p-2 rounded-full hover:bg-accent transition-colors"
                aria-label="Menu do usuário"
              >
                <User className="h-5 w-5" />
                <ChevronDown className="h-3 w-3" />
              </button>
            ) : (
              <Link
                href="/login"
                className="p-2 rounded-full hover:bg-accent transition-colors block"
                title="Entrar ou Cadastrar"
              >
                <User className="h-5 w-5" />
              </Link>
            )}

            {/* Dropdown do Usuário */}
            {isUserMenuOpen && user && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border bg-card p-2 shadow-lg ring-1 ring-black/5 z-50">
                <div className="px-3 py-2 border-b mb-1">
                  <p className="text-xs text-muted-foreground">Conectado como</p>
                  <p className="text-sm font-semibold truncate">{user.email}</p>
                </div>

                {/* Opção de Admin (Apenas para Administradores) */}
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 mb-1 transition-colors"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>Painel Admin</span>
                  </Link>
                )}

                <Link
                  href="/conta"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <User className="h-4 w-4" />
                  <span>Minha Conta</span>
                </Link>

                <Link
                  href="/conta#pedidos"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <Package className="h-4 w-4" />
                  <span>Meus Pedidos</span>
                </Link>

                {/* Alternar Tema Escuro/Claro */}
                <button
                  onClick={toggleDarkMode}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    {isDarkMode ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
                    <span>Tema Escuro</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {isDarkMode ? 'Ligado' : 'Desligado'}
                  </span>
                </button>

                <div className="border-t my-1"></div>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2 rounded-lg px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair</span>
                </button>
              </div>
            )}
          </div>

          {/* Carrinho */}
          <button
            onClick={toggleCart}
            className="relative p-2 rounded-full hover:bg-accent transition-colors"
            aria-label="Abrir carrinho"
          >
            <ShoppingBag className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {totalItems}
              </span>
            )}
          </button>

          {/* Botão do Menu Mobile */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-accent"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Menu Mobile */}
      {isMenuOpen && (
        <div className="md:hidden border-b bg-background px-4 pt-2 pb-4 space-y-2">
          <Link
            href="/produtos"
            onClick={() => setIsMenuOpen(false)}
            className="block py-2 text-base font-medium transition-colors hover:text-primary"
          >
            Produtos
          </Link>
          <Link
            href="/produtos?categoria=decoracao"
            onClick={() => setIsMenuOpen(false)}
            className="block py-2 text-base font-medium transition-colors hover:text-primary"
          >
            Decoração
          </Link>
          <Link
            href="/produtos?categoria=descartaveis"
            onClick={() => setIsMenuOpen(false)}
            className="block py-2 text-base font-medium transition-colors hover:text-primary"
          >
            Descartáveis
          </Link>
          <Link
            href="/produtos?categoria=baloes"
            onClick={() => setIsMenuOpen(false)}
            className="block py-2 text-base font-medium transition-colors hover:text-primary"
          >
            Balões
          </Link>
        </div>
      )}
    </header>
  );
}
