/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // TODO: troque pelo(s) domínio(s) reais de onde as fotos dos produtos
    // vão ser servidas (Supabase Storage, Cloudinary, etc.)
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  // Headers de segurança aplicados a todas as rotas.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Impede que o site seja carregado dentro de um <iframe> em
          // outro domínio (proteção contra clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Impede que o navegador tente "adivinhar" o tipo de um
          // arquivo diferente do Content-Type declarado.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Não vaza a URL completa de origem ao navegar para outro site.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Desativa APIs sensíveis do navegador que o site não usa.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
