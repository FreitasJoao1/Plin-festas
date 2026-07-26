"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Página que o link do e-mail de recuperação abre. O Supabase já
 * autentica a sessão automaticamente via o token na URL (hash fragment)
 * antes desta página carregar — só precisamos capturar a nova senha e
 * chamar updateUser().
 */
export default function RedefinirSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Confirma que existe uma sessão válida (vinda do link do e-mail)
    // antes de liberar o formulário.
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(() => setReady(true));
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!supabase) {
      setError("Indisponível: Supabase não configurado (modo demo).");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("Não foi possível atualizar a senha. O link pode ter expirado — solicite um novo.");
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  if (!ready) return null;

  if (success) {
    return (
      <div className="container-plin flex justify-center py-16">
        <div className="w-full max-w-sm rounded-3xl border border-pink-100 p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="mt-4 font-display text-xl text-ink">Senha atualizada!</h1>
          <p className="mt-2 text-sm text-ink-soft">Redirecionando para o login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-plin flex justify-center py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-pink-100 p-8"
      >
        <KeyRound className="h-8 w-8 text-pink-500" />
        <h1 className="mt-3 font-display text-2xl text-ink">Nova senha</h1>
        <p className="mt-1 text-sm text-ink-soft">Escolha uma nova senha para sua conta.</p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nova senha (mín. 8 caracteres)"
            className="rounded-xl border border-pink-200 px-4 py-2.5 outline-none transition-colors focus:border-pink-500"
          />
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirme a nova senha"
            className="rounded-xl border border-pink-200 px-4 py-2.5 outline-none transition-colors focus:border-pink-500"
          />
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-pink-100 px-4 py-3 text-sm text-pink-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-full bg-pink-500 py-3 font-semibold text-white transition-colors hover:bg-lilac-500 disabled:opacity-60"
        >
          {loading ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}
