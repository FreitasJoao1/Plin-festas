"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff } from "lucide-react";
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

    // Se o usuário desmarcar "Lembrar deste dispositivo", a sessão expira ao fechar a aba
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

        <div className="flex flex-col gap-3">
          {/* E-mail */}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Seu e-mail"
            className="w-full rounded-xl border border-pink-200 px-4 py-2.5 outline-none transition-colors focus:border-pink-500 text-sm text-ink"
          />

          {/* Senha */}
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

          {/* Checkbox: Lembrar deste dispositivo */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-ink-soft hover:text-ink">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-pink-300 text-pink-500 focus:ring-pink-400 cursor-pointer accent-pink-500"
              />
              <span>Lembrar deste dispositivo</span>
            </label>
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
