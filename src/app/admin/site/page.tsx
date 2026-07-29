"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Sparkles, Store, Truck, ShieldCheck, Upload } from "lucide-react";
import { HomeHeroContent, HomeTrustCard } from "@/lib/types";
import { uploadSiteContentImage } from "@/lib/storage";

const TRUST_ICONS = [Store, Truck, ShieldCheck];

const HERO_LIMITS = { badge: 60, title: 90, description: 400, button_label: 30, image_alt: 200 };
const CARD_LIMITS = { title: 40, description: 120 };

function CharCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className={`text-[11px] ${over ? "font-semibold text-red-600" : "text-ink-soft"}`}>
      {value.length}/{max}
    </span>
  );
}

export default function AdminSitePage() {
  const [hero, setHero] = useState<HomeHeroContent | null>(null);
  const [trustCards, setTrustCards] = useState<HomeTrustCard[]>([]);
  const [loading, setLoading] = useState(true);

  const [savingHero, setSavingHero] = useState(false);
  const [savingCards, setSavingCards] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [heroSaved, setHeroSaved] = useState(false);
  const [cardsSaved, setCardsSaved] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/site/hero")
      .then((r) => r.json())
      .then((data) => {
        if (data.hero) setHero(data.hero);
        if (data.trustCards) setTrustCards(data.trustCards);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveHero() {
    if (!hero) return;
    setHeroError(null);
    setHeroSaved(false);

    for (const [key, max] of Object.entries(HERO_LIMITS) as [keyof typeof HERO_LIMITS, number][]) {
      if (!hero[key]?.trim()) {
        setHeroError("Preencha todos os campos do banner principal.");
        return;
      }
      if (hero[key].length > max) {
        setHeroError(`Campo "${key}" excede o limite de ${max} caracteres.`);
        return;
      }
    }

    setSavingHero(true);
    try {
      const res = await fetch("/api/admin/site/hero", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hero),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHeroError(data.error ?? "Não foi possível salvar.");
        return;
      }
      setHeroSaved(true);
      setTimeout(() => setHeroSaved(false), 2500);
    } catch {
      setHeroError("Erro de conexão. Tente novamente.");
    } finally {
      setSavingHero(false);
    }
  }

  async function saveTrustCards() {
    setCardsError(null);
    setCardsSaved(false);

    for (const card of trustCards) {
      if (!card.title.trim() || !card.description.trim()) {
        setCardsError("Preencha título e descrição de todos os cards.");
        return;
      }
      if (card.title.length > CARD_LIMITS.title || card.description.length > CARD_LIMITS.description) {
        setCardsError("Algum card excede o limite de caracteres.");
        return;
      }
    }

    setSavingCards(true);
    try {
      const res = await fetch("/api/admin/site/trust-cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(trustCards),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCardsError(data.error ?? "Não foi possível salvar.");
        return;
      }
      setCardsSaved(true);
      setTimeout(() => setCardsSaved(false), 2500);
    } catch {
      setCardsError("Erro de conexão. Tente novamente.");
    } finally {
      setSavingCards(false);
    }
  }

  async function handleImageUpload(file: File) {
    if (!hero) return;
    setUploadingImage(true);
    setHeroError(null);
    const result = await uploadSiteContentImage(file);
    setUploadingImage(false);
    if ("error" in result) {
      setHeroError(result.error);
      return;
    }
    setHero({ ...hero, image_url: result.url });
  }

  if (loading || !hero) {
    return (
      <div>
        <h1 className="font-display text-2xl text-ink">Site</h1>
        <p className="mt-4 text-sm text-ink-soft">Carregando…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Site</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Edite os textos e a foto principal da home. O preview ao lado mostra exatamente como vai aparecer.
      </p>

      {/* ===== BANNER PRINCIPAL (HERO) ===== */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-pink-100 bg-white p-5">
          <h2 className="font-semibold text-ink">Banner principal</h2>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-ink">Selo/badge</label>
                <CharCount value={hero.badge} max={HERO_LIMITS.badge} />
              </div>
              <input
                value={hero.badge}
                onChange={(e) => setHero({ ...hero, badge: e.target.value })}
                className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-ink">Título</label>
                <CharCount value={hero.title} max={HERO_LIMITS.title} />
              </div>
              <input
                value={hero.title}
                onChange={(e) => setHero({ ...hero, title: e.target.value })}
                className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-ink">Descrição</label>
                <CharCount value={hero.description} max={HERO_LIMITS.description} />
              </div>
              <textarea
                value={hero.description}
                onChange={(e) => setHero({ ...hero, description: e.target.value })}
                rows={4}
                className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-ink">Texto do botão</label>
                <CharCount value={hero.button_label} max={HERO_LIMITS.button_label} />
              </div>
              <input
                value={hero.button_label}
                onChange={(e) => setHero({ ...hero, button_label: e.target.value })}
                className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Foto principal</label>
              <div className="flex items-center gap-3">
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-pink-200 bg-pink-50">
                  <Image src={hero.image_url} alt="" fill className="object-cover" />
                </div>
                <label
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-pink-300 py-3 text-sm font-medium text-pink-500 transition-colors hover:border-pink-500 hover:bg-pink-50 ${uploadingImage ? "pointer-events-none opacity-50" : ""}`}
                >
                  <Upload className="h-4 w-4" />
                  {uploadingImage ? "Enviando…" : "Trocar foto"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="mt-1.5 text-xs text-ink-soft">
                Mínimo 600×600px (formato quadrado). Fotos menores ou desproporcionais são rejeitadas para não ficarem borradas no banner.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink">Texto alternativo da foto</label>
              <input
                value={hero.image_alt}
                onChange={(e) => setHero({ ...hero, image_alt: e.target.value })}
                placeholder="Descreva a imagem (acessibilidade e SEO)"
                className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
              />
            </div>

            {heroError && (
              <p className="rounded-xl bg-pink-100 px-3 py-2 text-sm text-pink-700">{heroError}</p>
            )}
            {heroSaved && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Banner atualizado.</p>
            )}

            <button
              type="button"
              onClick={saveHero}
              disabled={savingHero}
              className="rounded-full bg-pink-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pink-600 disabled:opacity-50"
            >
              {savingHero ? "Salvando…" : "Salvar banner"}
            </button>
          </div>
        </div>

        {/* Preview visual — canvas, mesma estrutura visual da home real */}
        <div className="rounded-3xl border border-pink-100 bg-gradient-to-b from-pink-100 via-pink-50 to-white p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-soft">Pré-visualização</p>
          <div className="grid items-center gap-4 rounded-2xl bg-white/40 p-4 sm:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-pink-600 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> {hero.badge || "—"}
              </span>
              <h1 className="mt-3 font-display text-2xl leading-tight text-ink">
                {hero.title || "—"}
              </h1>
              <p className="mt-2 text-sm text-ink-soft">{hero.description || "—"}</p>
              <div className="mt-3">
                <span className="inline-block rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                  {hero.button_label || "—"}
                </span>
              </div>
            </div>
            <div className="relative mx-auto aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl shadow-lg">
              <Image src={hero.image_url} alt={hero.image_alt} fill className="object-cover" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== CARDS DE CONFIANÇA ===== */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-pink-100 bg-white p-5">
          <h2 className="font-semibold text-ink">Cards de confiança</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Os 3 cards no rodapé da home (retirada, entrega, pagamento). Os ícones são fixos por posição.
          </p>

          <div className="mt-4 flex flex-col gap-4">
            {trustCards.map((card, i) => (
              <div key={i} className="rounded-2xl border border-pink-100 p-3">
                <p className="mb-2 text-xs font-medium text-ink-soft">Card {i + 1}</p>
                <div className="flex flex-col gap-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium text-ink">Título</label>
                      <CharCount value={card.title} max={CARD_LIMITS.title} />
                    </div>
                    <input
                      value={card.title}
                      onChange={(e) => {
                        const next = [...trustCards];
                        next[i] = { ...card, title: e.target.value };
                        setTrustCards(next);
                      }}
                      className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium text-ink">Descrição</label>
                      <CharCount value={card.description} max={CARD_LIMITS.description} />
                    </div>
                    <input
                      value={card.description}
                      onChange={(e) => {
                        const next = [...trustCards];
                        next[i] = { ...card, description: e.target.value };
                        setTrustCards(next);
                      }}
                      className="w-full rounded-xl border border-pink-200 px-3 py-2 text-sm outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
              </div>
            ))}

            {cardsError && (
              <p className="rounded-xl bg-pink-100 px-3 py-2 text-sm text-pink-700">{cardsError}</p>
            )}
            {cardsSaved && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Cards atualizados.</p>
            )}

            <button
              type="button"
              onClick={saveTrustCards}
              disabled={savingCards}
              className="rounded-full bg-pink-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pink-600 disabled:opacity-50"
            >
              {savingCards ? "Salvando…" : "Salvar cards"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-pink-100 bg-babyblue-100/60 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-soft">Pré-visualização</p>
          <div className="grid gap-4 rounded-2xl bg-white/50 p-4 sm:grid-cols-3">
            {trustCards.map((card, i) => {
              const Icon = TRUST_ICONS[i] ?? Store;
              return (
                <div key={i} className="flex items-start gap-2">
                  <Icon className="h-5 w-5 flex-shrink-0 text-pink-500" />
                  <div>
                    <p className="text-sm font-semibold text-ink">{card.title || "—"}</p>
                    <p className="text-xs text-ink-soft">{card.description || "—"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
