/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Desabilita otimização automática de imagens (Image Optimization)
    // para não contar com limite free do Vercel (5k/mês). Imagens são
    // servidas direto do Supabase Storage sem processamento no servidor.
    unoptimized: true,
    // TODO: troque pelo(s) domínio(s) reais de onde as fotos dos produtos
    // vão ser servidas (Supabase Storage, Cloudinary, etc.)
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  // Headers de segurança aplicados a todas as rotas.
  async headers() {
    // CSP montada por lista de domínios em vez de string solta, pra ficar
    // óbvio o que cada origem permitida faz aqui.
    const csp = [
      "default-src 'self'",
      // Next.js precisa de 'unsafe-inline' no style por causa do CSS-in-JS
      // do App Router; 'unsafe-eval' não é necessário e fica de fora.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com",
      "font-src 'self' data:",
      // conexões do client: Supabase (auth/db/storage/realtime) e Melhor Envio.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://melhorenvio.com.br https://sandbox.melhorenvio.com.br https://api.checkout.infinitepay.io",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

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
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          // Força HTTPS em todas as requisições futuras por 1 ano,
          // incluindo subdomínios (a Vercel já serve HTTPS por padrão,
          // isto impede downgrade attack para HTTP).
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Restringe de onde scripts/estilos/imagens/conexões podem vir —
          // mitigação principal contra XSS e injeção de conteúdo externo.
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
