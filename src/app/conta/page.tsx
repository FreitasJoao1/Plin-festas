'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Order, OrderStatus } from '@/lib/types';
import { formatBRL } from '@/lib/shipping';
import { 
  User, 
  Package, 
  Settings, 
  ShieldAlert, 
  LogOut, 
  Moon, 
  Sun, 
  Loader2, 
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

const STATUS_LABEL: Record<OrderStatus, string> = {
  novo: 'Novo',
  confirmado: 'Confirmado',
  em_producao: 'Em produção',
  pronto: 'Pronto',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  novo: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  confirmado: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400',
  em_producao: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  pronto: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400',
  enviado: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  entregue: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  cancelado: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

/** Pedido só pode ser cancelado pelo cliente nesses status. */
const CANCELABLE_STATUSES: OrderStatus[] = ['novo', 'confirmado'];

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

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [payingBalanceId, setPayingBalanceId] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  const loadOrders = useCallback(async (userId: string) => {
    if (!supabase) {
      setOrdersLoading(false);
      return;
    }
    setOrdersLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      setOrdersError('Não foi possível carregar seus pedidos.');
    } else {
      setOrders((data ?? []) as Order[]);
    }
    setOrdersLoading(false);
  }, [supabase]);

  useEffect(() => {
    // Detectar hash da URL (ex: #pedidos)
    if (typeof window !== 'undefined' && window.location.hash === '#pedidos') {
      setActiveTab('pedidos');
    }

    async function loadUserData() {
      if (!supabase) {
        setLoading(false);
        setOrdersLoading(false);
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

      // is_admin vem SEMPRE da tabela profiles (fonte de verdade protegida
      // por RLS), nunca de user_metadata — esse campo é editável pelo
      // próprio usuário e não deve decidir o que aparece na tela.
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setIsAdmin(profile?.role === 'admin');

      // Tema
      const savedTheme = localStorage.getItem('theme');
      setIsDarkMode(savedTheme === 'dark' || document.documentElement.classList.contains('dark'));

      setLoading(false);
      loadOrders(user.id);
    }

    loadUserData();
  }, [supabase, router, loadOrders]);

  const handleCancelOrder = useCallback(async (orderId: string) => {
    setCancelingId(orderId);
    setOrdersError(null);
    try {
      const res = await fetch(`/api/pedidos/${orderId}/cancelar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setOrdersError(data.error ?? 'Não foi possível cancelar o pedido.');
        return;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelado' } : o))
      );
    } catch {
      setOrdersError('Erro de conexão. Tente novamente.');
    } finally {
      setCancelingId(null);
      setConfirmCancelId(null);
    }
  }, []);

  const handlePayBalance = useCallback(async (orderId: string) => {
    setPayingBalanceId(orderId);
    setOrdersError(null);
    try {
      const res = await fetch(`/api/pedidos/${orderId}/pagar-saldo`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setOrdersError(data.error ?? 'Não foi possível gerar o link de pagamento.');
        return;
      }
      window.location.href = data.url;
    } catch {
      setOrdersError('Erro de conexão. Tente novamente.');
    } finally {
      setPayingBalanceId(null);
    }
  }, []);

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

              {ordersError && (
                <div className="p-3 text-sm flex items-center gap-2 text-red-700 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {ordersError}
                </div>
              )}

              {ordersLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : orders.length === 0 ? (
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
              ) : (
                <ul className="space-y-4">
                  {orders.map((order) => {
                    const canCancel = CANCELABLE_STATUSES.includes(order.status);
                    return (
                      <li key={order.id} className="border rounded-xl p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm">{order.order_code}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                              })}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
                            {STATUS_LABEL[order.status]}
                          </span>
                        </div>

                        <ul className="text-sm text-muted-foreground space-y-0.5">
                          {order.items.map((item, idx) => (
                            <li key={idx}>{item.quantity}× {item.name}</li>
                          ))}
                        </ul>

                        {order.booking_date && (
                          <div className="text-xs rounded-lg px-3 py-2 bg-muted/50 space-y-1">
                            <p>
                              📅 Data solicitada:{" "}
                              <strong>
                                {new Date(order.booking_date + "T12:00:00").toLocaleDateString("pt-BR")}
                              </strong>
                              {order.booking_status === "pending_approval" && (
                                <span className="ml-2 text-amber-600 font-semibold">Aguardando confirmação</span>
                              )}
                              {order.booking_status === "approved" && (
                                <span className="ml-2 text-emerald-600 font-semibold">Confirmada ✓</span>
                              )}
                              {order.booking_status === "rejected" && (
                                <span className="ml-2 text-red-600 font-semibold">Não foi possível confirmar</span>
                              )}
                            </p>
                            {order.booking_status === "rejected" && (
                              <>
                                {order.booking_rejection_reason && (
                                  <p className="text-muted-foreground">
                                    Motivo: {order.booking_rejection_reason}
                                  </p>
                                )}
                                {order.booking_alternative_date && (
                                  <p className="text-muted-foreground">
                                    Data alternativa sugerida:{" "}
                                    {new Date(order.booking_alternative_date + "T12:00:00").toLocaleDateString("pt-BR")}
                                  </p>
                                )}
                                <a
                                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5571993008464"}?text=${encodeURIComponent(`Olá! Sobre o pedido ${order.order_code}, gostaria de conversar sobre a data.`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block mt-1 text-green-700 font-semibold hover:underline"
                                >
                                  Falar no WhatsApp →
                                </a>
                              </>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="font-semibold flex items-center gap-2">
                            {formatBRL(order.total_cents)}
                            {order.payment_status === "paid" && (
                              <span className="text-xs font-semibold text-emerald-600">✅ Pago</span>
                            )}
                            {order.payment_status === "pending" && (
                              <span className="text-xs font-semibold text-amber-600">⏳ Pagamento pendente</span>
                            )}
                          </span>

                          {order.payment_plan === "split_50_50" &&
                            order.balance_payment_status !== "paid" &&
                            (order.status === "enviado" || order.status === "entregue") && (
                              <button
                                onClick={() => handlePayBalance(order.id)}
                                disabled={payingBalanceId === order.id}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center gap-1.5"
                              >
                                {payingBalanceId === order.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  `Pagar restante (${formatBRL(order.balance_amount_cents)})`
                                )}
                              </button>
                            )}

                          {canCancel && (
                            confirmCancelId === order.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Cancelar de verdade?</span>
                                <button
                                  onClick={() => handleCancelOrder(order.id)}
                                  disabled={cancelingId === order.id}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                                >
                                  {cancelingId === order.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : 'Sim, cancelar'}
                                </button>
                                <button
                                  onClick={() => setConfirmCancelId(null)}
                                  disabled={cancelingId === order.id}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-accent transition-colors"
                                >
                                  Voltar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmCancelId(order.id)}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 transition-colors flex items-center gap-1.5"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Cancelar pedido
                              </button>
                            )
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
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