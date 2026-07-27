"use client";

import Link from "next/link";
import { ShieldCheck, Lock, Heart, Instagram, MessageCircle, Mail, Cookie } from "lucide-react";
import PlinLogo from "@/components/PlinLogo";

export default function Footer() {
  return (
    <footer className="border-t border-pink-100 bg-white pt-12 pb-8 text-ink-soft">
      <div className="container-plin">
        {/* Banner de Benefícios & Segurança LGPD */}
        <div className="mb-10 grid grid-cols-1 gap-6 rounded-3xl bg-pink-50/60 p-6 sm:grid-cols-3 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pink-500 text-white shadow-sm">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-ink">Compra 100% Segura</h4>
              <p className="text-xs text-ink-soft">Dados criptografados com certificado SSL</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lilac-500 text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-ink">Conformidade LGPD</h4>
              <p className="text-xs text-ink-soft">Respeito total à sua privacidade de dados</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-pink-500 text-white shadow-sm">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-ink">Feito com Amor</h4>
              <p className="text-xs text-ink-soft">Atendimento humanizado e personalizado</p>
            </div>
          </div>
        </div>

        {/* Links Principais */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Coluna 1: Sobre */}
          <div className="flex flex-col gap-3">
            <PlinLogo className="h-12 w-auto" />
            <p className="text-xs leading-relaxed text-ink-soft">
              Especialistas em papelaria personalizada, encadernação e mimos exclusivos para tornar seus momentos inesquecíveis.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-pink-100 p-2 text-pink-600 transition-colors hover:bg-pink-500 hover:text-white"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://wa.me/5571993008464"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-pink-100 p-2 text-pink-600 transition-colors hover:bg-pink-500 hover:text-white"
                aria-label="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <a
                href="mailto:contato@plindesigngrafico.com.br"
                className="rounded-full bg-pink-100 p-2 text-pink-600 transition-colors hover:bg-pink-500 hover:text-white"
                aria-label="E-mail"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Coluna 2: Navegação */}
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink">Navegação</h3>
            <ul className="flex flex-col gap-2 text-xs">
              <li>
                <Link href="/produtos" className="hover:text-pink-600">Todos os Produtos</Link>
              </li>
              <li>
                <Link href="/produtos?categoria=agendas" className="hover:text-pink-600">Agendas e Planners</Link>
              </li>
              <li>
                <Link href="/produtos?categoria=cadernos" className="hover:text-pink-600">Cadernos Personalizados</Link>
              </li>
              <li>
                <Link href="/produtos?categoria=festas" className="hover:text-pink-600">Kits para Festas</Link>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Atendimento */}
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-ink">Atendimento</h3>
            <ul className="flex flex-col gap-2 text-xs">
              <li>
                <Link href="/conta" className="hover:text-pink-600">Minha Conta</Link>
              </li>
              <li>
                <a href="https://wa.me/5571993008464" target="_blank" rel="noopener noreferrer" className="hover:text-pink-600">
                  Suporte pelo WhatsApp
                </a>
              </li>
              <li>
                <span className="text-ink-soft">Seg. a Sex. das 09h às 18h</span>
              </li>
            </ul>
          </div>

          {/* Coluna 4: LGPD & Privacidade (Normas Obrigatórias) */}
          <div>
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-ink">
              <ShieldCheck className="h-4 w-4 text-pink-500" />
              Privacidade & LGPD
            </h3>
            <ul className="flex flex-col gap-2 text-xs">
              <li>
                <Link href="/privacidade" className="font-medium hover:text-pink-600">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link href="/termos" className="hover:text-pink-600">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link href="/privacidade#direitos-lgpd" className="hover:text-pink-600">
                  Seus Direitos (LGPD)
                </Link>
              </li>
              <li>
                <span className="text-[11px] text-ink-soft/80">
                  Encarregado de Dados (DPO): <br />
                  <a href="mailto:dpo@plindesigngrafico.com.br" className="underline hover:text-pink-600">
                    dpo@plindesigngrafico.com.br
                  </a>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Linha Divisória */}
        <hr className="my-8 border-pink-100" />

        {/* Rodapé Inferior: Direitos Autorais e Nota Legal LGPD */}
        <div className="flex flex-col items-center justify-between gap-4 text-center text-xs text-ink-soft/80 md:flex-row md:text-left">
          <div>
            <p>© {new Date().getFullYear()} Plin Designs. Todos os direitos reservados.</p>
            <p className="mt-0.5 text-[11px]">
              Em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span>Pagamento seguro via Pix e Cartão de Crédito</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
