"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function CadastroPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Máscara para telefone (71) 99300-8464
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 6) {
      v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    } else if (v.length > 2) {
      v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    } else if (v.length > 0) {
      v = `(${v}`;
    }
    setPhone(v);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!supabase) {
      setError("Cadastro indisponível no momento.");
      return;
    }

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem. Digite novamente.");
      return;
    }

    setLoading(true);

    // URL oficial de redirecionamento do e-mail de confirmação
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://plin-festas-zeta.vercel.app";

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, phone },
        emailRedirectTo: `${siteUrl}/login`,
      },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    setOk(true);
  }

  if (ok) {
    return (
      <div className="container-plin flex flex-col items-center py-20 text-center">
        <MailCheck className="h-12 w-12 text-pink-500" />
        <h1 className="mt-4 font-display text-2xl text-ink">
          Confirme seu e-mail
        </h1>
        <p className="mt-2 max-w-sm text-ink-soft">
          Enviamos um link de confirmação para <strong>{email}</strong>.
          Clique nele para ativar sua conta.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-pink-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-lilac-500"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <div className="container-plin flex justify-center py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-pink-100 p-8 shadow-sm transition-shadow hover:shadow-md"
      >
        <h1 className="font-display text-2xl text-ink">Criar conta</h1>

        <div className="mt-6 flex flex-col gap-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo"
            className="rounded-xl border border-pink-200 px-4 py-2.5 outline-none transition-colors focus:border-pink-500"
          />
          <input
            required
            value={phone}
            onChange={handlePhoneChange}
            placeholder="WhatsApp / telefone"
            className="rounded-xl border border-pink-200 px-4 py-2.5 outline-none transition-colors focus:border-pink-500"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="rounded-xl border border-pink-200 px-4 py-2.5 outline-none transition-colors focus:border-pink-500"
          />

          {/* Campo de Senha com Ícone de Olho */}
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha (mín. 8 caracteres)"
              className="w-full rounded-xl border border-pink-200 px-4 py-2.5 pr-10 outline-none transition-colors focus:border-pink-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-pink-400 hover:text-pink-600"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {/* Campo Confirmar Senha */}
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar senha"
              className="w-full rounded-xl border border-pink-200 px-4 py-2.5 pr-10 outline-none transition-colors focus:border-pink-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-3 text-pink-400 hover:text-pink-600"
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
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
          {loading ? "Criando..." : "Criar conta"}
        </button>

        <p className="mt-4 text-center text-sm text-ink-soft">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-pink-600 hover:text-lilac-500">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
