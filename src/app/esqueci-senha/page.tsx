"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supabase) {
      setError("Recuperação de senha indisponível: Supabase não configurado (modo demo).");
      return;
    }

    setLoading(true);
    const redirectTo = `${window.location.origin}/redefinir-senha`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);

    // Por segurança, sempre mostramos sucesso (não revelamos se o
    // e-mail existe ou não na base — evita enumeração de contas).
    if (error) {
      console.error(error);
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="container-plin flex justify-center py-16">
        <div className="w-full max-w-sm rounded-3xl border border-pink-100 p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h1 className="mt-4 font-display text-xl text-ink">E-mail enviado!</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Se <strong>{email}</strong> tiver uma conta, você vai receber um
            link para redefinir sua senha em instantes. Confira também a
            caixa de spam.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-full bg-pink-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-lilac-500"
          >
            Voltar para o login
          </Link>
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
        <Mail className="h-8 w-8 text-pink-500" />
        <h1 className="mt-3 font-display text-2xl text-ink">Esqueceu a senha?</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Digite seu e-mail e enviaremos um link para você criar uma nova senha.
        </p>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Seu e-mail"
          className="mt-6 w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none transition-colors focus:border-pink-500"
        />

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
          {loading ? "Enviando..." : "Enviar link de recuperação"}
        </button>

        <p className="mt-4 text-center text-sm text-ink-soft">
          Lembrou a senha?{" "}
          <Link href="/login" className="font-medium text-pink-600 hover:text-lilac-500">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
