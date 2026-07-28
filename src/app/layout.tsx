import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import CartDrawer from "@/components/CartDrawer";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Plin Designs | Bolsas, Necessaires e Lembrancinhas Personalizadas",
  description:
    "Bolsas, necessaires, copos e lembrancinhas personalizadas para festas em Salvador e região. Feito sob medida para o seu tema.",
  keywords: [
    "bolsas personalizadas",
    "necessaires personalizadas",
    "lembrancinhas de festa",
    "copos personalizados",
    "chaveiros personalizados",
    "Plin Designs",
    "Salvador",
  ],
  authors: [{ name: "Plin Designs" }],
  openGraph: {
    title: "Plin Designs | Bolsas, Necessaires e Lembrancinhas Personalizadas",
    description:
      "Bolsas, necessaires, copos e lembrancinhas personalizadas para festas em Salvador e região.",
    url: "https://plin-design-zeta.vercel.app",
    siteName: "Plin Designs",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col bg-white text-ink antialiased selection:bg-pink-100 selection:text-pink-700">
        {/* Cabeçalho fixo no topo */}
        <Header />

        {/* Conteúdo dinâmico das páginas */}
        <main className="flex-1">
          {children}
        </main>

        {/* Carrinho lateral deslizante (se o projeto utilizar) */}
        <CartDrawer />

        {/* Rodapé institucional com avisos e links da LGPD */}
        <Footer />

        {/* Banner flutuante de Consentimento de Cookies (LGPD) */}
        <CookieBanner />
      </body>
    </html>
  );
}
