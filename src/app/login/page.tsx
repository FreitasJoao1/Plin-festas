"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supabase) {
      setError("Serviço de login indisponível no momento.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        setError("E-mail ou senha incorretos.");
      } else {
        setError(error.message);
      }
      return;
    }

    // Se desmarcar a caixinha, encerra a sessão ao fechar a janela
    if (!rememberMe && typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        supabase.auth.signOut();
      });
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="container-plin flex justify-center py-16">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-3xl border border-pink-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-100 text-pink-600">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-ink">Entrar na conta</h1>
        </div>
        <p className="text-xs text-ink-soft mb-6">
          Acesse seus pedidos e informações do seu perfil na Plin Designs.
        </p>

        <div className="flex flex-col gap-4">
          {/* E-mail */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none transition-colors focus:border-pink-500 text-sm text-ink"
            />
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                className="w-full rounded-xl border border-pink-200 px-4 py-2.5 pr-10 outline-none transition-colors focus:border-pink-500 text-sm text-ink"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-pink-400 hover:text-pink-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* CAIXINHA ESTILIZADA DE LEMBRAR ESTE DISPOSITIVO */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setRememberMe(!rememberMe)}
              className="flex items-center gap-2.5 text-xs text-ink cursor-pointer select-none"
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                  rememberMe
                    ? "bg-pink-500 border-pink-500 text-white shadow-sm"
                    : "border-pink-300 bg-white hover:border-pink-400"
                }`}
              >
                {rememberMe && <Check className="h-3.5 w-3.5 stroke-[3]" />}
              </div>
              <span className="font-medium text-ink-soft">Lembrar deste dispositivo</span>
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-pink-100 px-4 py-3 text-xs font-medium text-pink-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-pink-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-lilac-500 disabled:opacity-60 shadow-sm"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="mt-6 text-center text-xs text-ink-soft">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-bold text-pink-600 hover:text-lilac-500">
            Criar conta
          </Link>
        </p>
      </form>
    </div>
  );
}