import type { Metadata } from "next";
import { Baloo_2, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import CartDrawer from "@/components/CartDrawer";

const display = Baloo_2({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Plin Designs — Brindes e personalizados em Salvador",
  description:
    "Balões, arranjos, descartáveis e kits prontos para sua festa. Retirada em Cabula/Tancredo Neves, entrega em Salvador e Lauro de Freitas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable}`}>
      <body>
        <Header />
        <main className="min-h-[60vh]">{children}</main>
        <Footer />
        <WhatsAppButton />
        <CartDrawer />
      </body>
    </html>
  );
}
