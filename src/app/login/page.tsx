"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supabase) {
      setError(
        "Login ainda não está disponível: o Supabase não foi configurado neste ambiente (modo demo)."
      );
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError("E-mail ou senha incorretos.");
      return;
    }
    router.push(params.get("redirect") || "/conta");
    router.refresh();
  }

  return (
    <div className="container-plin flex justify-center py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-pink-100 p-8 shadow-sm transition-shadow hover:shadow-md"
      >
        <h1 className="font-display text-2xl text-ink">Entrar</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Acompanhe seus pedidos na Plin Designs.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="rounded-xl border border-pink-200 px-4 py-2.5 outline-none transition-colors focus:border-pink-500"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="rounded-xl border border-pink-200 px-4 py-2.5 outline-none transition-colors focus:border-pink-500"
          />
        </div>

        <div className="mt-2 text-right">
          <Link href="/esqueci-senha" className="text-sm font-medium text-pink-600 hover:text-lilac-500">
            Esqueci minha senha
          </Link>
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
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="mt-4 text-center text-sm text-ink-soft">
          Não tem conta?{" "}
          <Link href="/cadastro" className="font-medium text-pink-600 hover:text-lilac-500">
            Cadastre-se
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-plin flex justify-center py-16 text-ink-soft">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
