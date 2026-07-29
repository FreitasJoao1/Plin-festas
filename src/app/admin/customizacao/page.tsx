"use client";

import { useState, useEffect } from "react";
import { SiteCustomization } from "@/lib/types";
import { Save, Lock, AlertCircle } from "lucide-react";

export default function AdminCustomizacaoPage() {
  const [customization, setCustomization] = useState<SiteCustomization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewMode, setPreviewMode] = useState<"hero" | "footer" | "about">("hero");

  useEffect(() => {
    fetch("/api/admin/customization")
      .then((r) => r.json())
      .then((data) => {
        setCustomization(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!customization) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/customization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hero_title: customization.hero_title,
          hero_subtitle: customization.hero_subtitle,
          hero_image_url: customization.hero_image_url,
          footer_text: customization.footer_text,
          about_text: customization.about_text,
          data: customization.data,
        }),
      });
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-ink-soft">Carregando customização...</div>;
  }

  if (!customization) {
    return <div className="text-red-600">Erro ao carregar dados.</div>;
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="font-display text-2xl text-ink">Customização do Site</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Altere textos e imagens vistos pelos clientes. Campos de banco de dados são protegidos.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Painel de edição */}
        <div className="space-y-6">
          {/* Seção Hero */}
          <div className="rounded-3xl border border-pink-100 bg-white p-6">
            <h2 className="mb-4 font-semibold text-ink">Seção Hero (Destaque)</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink">Título principal</label>
                <input
                  type="text"
                  value={customization.hero_title || ""}
                  onChange={(e) =>
                    setCustomization({ ...customization, hero_title: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-pink-100 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                  placeholder="Ex: Personalize seus produtos"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink">Subtítulo</label>
                <textarea
                  value={customization.hero_subtitle || ""}
                  onChange={(e) =>
                    setCustomization({ ...customization, hero_subtitle: e.target.value })
                  }
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-pink-100 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                  placeholder="Ex: Crie lembranças únicas para suas festas"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink">URL da imagem hero</label>
                <input
                  type="url"
                  value={customization.hero_image_url || ""}
                  onChange={(e) =>
                    setCustomization({ ...customization, hero_image_url: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-pink-100 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                  placeholder="https://..."
                />
                {customization.hero_image_url && (
                  <img
                    src={customization.hero_image_url}
                    alt="Preview"
                    className="mt-2 max-h-40 w-full rounded-lg object-cover"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Seção About */}
          <div className="rounded-3xl border border-pink-100 bg-white p-6">
            <h2 className="mb-4 font-semibold text-ink">Sobre a loja</h2>
            
            <div>
              <label className="block text-sm font-medium text-ink">Texto sobre a loja</label>
              <textarea
                value={customization.about_text || ""}
                onChange={(e) =>
                  setCustomization({ ...customization, about_text: e.target.value })
                }
                rows={5}
                className="mt-1 w-full rounded-lg border border-pink-100 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                placeholder="Conte a história da sua loja..."
              />
            </div>
          </div>

          {/* Seção Footer */}
          <div className="rounded-3xl border border-pink-100 bg-white p-6">
            <h2 className="mb-4 font-semibold text-ink">Rodapé</h2>
            
            <div>
              <label className="block text-sm font-medium text-ink">Texto do rodapé</label>
              <textarea
                value={customization.footer_text || ""}
                onChange={(e) =>
                  setCustomization({ ...customization, footer_text: e.target.value })
                }
                rows={3}
                className="mt-1 w-full rounded-lg border border-pink-100 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                placeholder="Copyright, redes sociais, etc."
              />
            </div>
          </div>

          {/* Aviso de proteção */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <Lock className="h-5 w-5 flex-shrink-0 text-amber-600" />
              <div className="text-sm text-amber-900">
                <p className="font-medium">Campos protegidos</p>
                <p className="mt-1 text-xs">
                  Configurações de banco de dados (capacidade, horizonte de agendamento) só podem ser alteradas pelo programador. Entre em contato se precisar ajustá-las.
                </p>
              </div>
            </div>
          </div>

          {/* Botão salvar */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 font-medium text-white hover:bg-pink-700 disabled:opacity-50"
            >
              <Save className="h-5 w-5" />
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
            
            {saved && (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-600">
                ✓ Salvo!
              </div>
            )}
          </div>
        </div>

        {/* Pré-visualização */}
        <div className="rounded-3xl border border-pink-100 bg-white p-6 h-fit sticky top-6">
          <h2 className="mb-4 font-semibold text-ink">Pré-visualização</h2>

          <div className="flex gap-2 mb-4 border-b border-pink-100">
            {["hero", "about", "footer"].map((mode) => (
              <button
                key={mode}
                onClick={() => setPreviewMode(mode as "hero" | "about" | "footer")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  previewMode === mode
                    ? "border-pink-600 text-pink-600"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {mode === "hero" ? "Hero" : mode === "about" ? "Sobre" : "Rodapé"}
              </button>
            ))}
          </div>

          {previewMode === "hero" && (
            <div className="space-y-3">
              {customization.hero_image_url && (
                <img
                  src={customization.hero_image_url}
                  alt="Hero"
                  className="w-full rounded-lg object-cover h-40"
                />
              )}
              {customization.hero_title && (
                <h3 className="font-display text-lg font-bold text-ink">
                  {customization.hero_title}
                </h3>
              )}
              {customization.hero_subtitle && (
                <p className="text-sm text-ink-soft whitespace-pre-wrap">
                  {customization.hero_subtitle}
                </p>
              )}
              {!customization.hero_title && !customization.hero_subtitle && (
                <p className="text-xs text-ink-soft italic">Nenhum conteúdo configurado</p>
              )}
            </div>
          )}

          {previewMode === "about" && (
            <div className="space-y-3">
              {customization.about_text ? (
                <p className="text-sm text-ink-soft whitespace-pre-wrap">
                  {customization.about_text}
                </p>
              ) : (
                <p className="text-xs text-ink-soft italic">Nenhum conteúdo configurado</p>
              )}
            </div>
          )}

          {previewMode === "footer" && (
            <div className="rounded-lg bg-ink p-4 space-y-2">
              {customization.footer_text ? (
                <p className="text-xs text-white whitespace-pre-wrap">
                  {customization.footer_text}
                </p>
              ) : (
                <p className="text-xs text-white/50 italic">Nenhum conteúdo configurado</p>
              )}
            </div>
          )}

          <div className="mt-6 rounded-lg bg-blue-50 p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-blue-600 mt-0.5" />
            <p className="text-xs text-blue-900">
              A pré-visualização reflete as mudanças locais. Clique em "Salvar" para que os clientes vejam as alterações.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
