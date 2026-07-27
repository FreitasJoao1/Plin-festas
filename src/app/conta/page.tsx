'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  User, 
  Package, 
  Settings, 
  ShieldAlert, 
  LogOut, 
  Moon, 
  Sun, 
  Loader2, 
  CheckCircle2 
} from 'lucide-react';

export default function ContaPage() {
  const [activeTab, setActiveTab] = useState<'perfil' | 'pedidos' | 'configuracoes'>('perfil');
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // Detectar hash da URL (ex: #pedidos)
    if (typeof window !== 'undefined' && window.location.hash === '#pedidos') {
      setActiveTab('pedidos');
    }

    async function loadUserData() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);
      setFullName(user.user_metadata?.full_name || '');
      setPhone(user.user_metadata?.phone || '');
      
      const adminStatus = user.user_metadata?.is_admin || user.app_metadata?.role === 'admin';
      setIsAdmin(!!adminStatus);

      // Tema
      const savedTheme = localStorage.getItem('theme');
      setIsDarkMode(savedTheme === 'dark' || document.documentElement.classList.contains('dark'));

      setLoading(false);
    }

    loadUserData();
  }, [supabase, router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          phone: phone,
        },
      });

      if (error) throw error;
      setMessage('Perfil atualizado com sucesso!');
    } catch (err: any) {
      setMessage(`Erro ao atualizar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

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
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push('/');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="container mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Menu Lateral de Navegação da Conta */}
        <aside className="w-full md:w-64 space-y-2">
          <div className="p-4 bg-card rounded-2xl border mb-4">
            <p className="text-xs text-muted-foreground">Bem-vindo(a)</p>
            <p className="font-bold text-lg truncate">{fullName || user?.email}</p>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full mt-2">
                <ShieldAlert className="h-3 w-3" /> Administrador
              </span>
            )}
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('perfil')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                activeTab === 'perfil' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Meu Perfil</span>
            </button>

            <button
              onClick={() => setActiveTab('pedidos')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                activeTab === 'pedidos' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Meus Pedidos</span>
            </button>

            <button
              onClick={() => setActiveTab('configuracoes')}
              className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                activeTab === 'configuracoes' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Configurações</span>
            </button>

            {isAdmin && (
              <Link
                href="/admin"
                className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors mt-4"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Painel de Administração</span>
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl font-medium text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors mt-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair da Conta</span>
            </button>
          </nav>
        </aside>

        {/* Conteúdo Principal da Aba Selecionada */}
        <main className="flex-1 bg-card rounded-2xl border p-6 shadow-sm">
          {message && (
            <div className="mb-6 p-3 text-sm flex items-center gap-2 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </div>
          )}

          {/* Aba: Meu Perfil */}
          {activeTab === 'perfil' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Informações Pessoais</h2>
                <p className="text-sm text-muted-foreground">
                  Atualize seus dados cadastrais para facilitar suas compras
                </p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Nome Completo</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">E-mail</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full px-4 py-2 text-sm rounded-lg border bg-muted opacity-70 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-muted-foreground">O e-mail não pode ser alterado diretamente.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="py-2 px-6 bg-primary text-primary-foreground font-semibold rounded-lg shadow hover:opacity-90 transition-opacity flex items-center justify-center"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
                </button>
              </form>
            </div>
          )}

          {/* Aba: Meus Pedidos */}
          {activeTab === 'pedidos' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Meus Pedidos</h2>
                <p className="text-sm text-muted-foreground">
                  Acompanhe o histórico e status de suas compras
                </p>
              </div>

              <div className="border rounded-xl p-8 text-center space-y-3">
                <Package className="h-12 w-12 text-muted-foreground mx-auto" />
                <h3 className="font-semibold text-lg">Nenhum pedido encontrado</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Você ainda não realizou nenhum pedido em nossa loja.
                </p>
                <Link
                  href="/produtos"
                  className="inline-block px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  Explorar Produtos
                </Link>
              </div>
            </div>
          )}

          {/* Aba: Configurações */}
          {activeTab === 'configuracoes' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">Configurações da Conta</h2>
                <p className="text-sm text-muted-foreground">
                  Personalize suas preferências de uso do site
                </p>
              </div>

              <div className="space-y-4 max-w-md">
                <div className="flex items-center justify-between p-4 border rounded-xl">
                  <div className="flex items-center space-x-3">
                    {isDarkMode ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
                    <div>
                      <p className="font-medium text-sm">Tema do Site</p>
                      <p className="text-xs text-muted-foreground">
                        {isDarkMode ? 'Modo Escuro Ativo' : 'Modo Claro Ativo'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={toggleDarkMode}
                    className="px-3 py-1.5 border rounded-lg text-xs font-semibold hover:bg-accent transition-colors"
                  >
                    Alternar
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
