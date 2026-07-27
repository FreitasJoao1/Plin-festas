"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("plin_cookie_consent");
    if (!consent) {
      setShow(true);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem("plin_cookie_consent", "accepted");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl rounded-2xl border border-pink-200 bg-white p-4 shadow-2xl backdrop-blur sm:p-5">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="text-xs leading-relaxed text-ink-soft">
            <p className="font-semibold text-ink">Valorizamos sua privacidade!</p>
            <span>
              Utilizamos cookies para melhorar sua experiência na loja e personalizar conteúdos de acordo com a nossa{" "}
              <Link href="/privacidade" className="font-medium text-pink-600 underline hover:text-lilac-500">
                Política de Privacidade (LGPD)
              </Link>.
            </span>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            onClick={acceptAll}
            className="w-full shrink-0 rounded-full bg-pink-500 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-lilac-500 sm:w-auto"
          >
            Aceitar e Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
