# Plin Festas

Loja virtual de bolsas, necessaires, copos, lembrancinhas e chaveiros
personalizados, atendendo clientes em Salvador e Lauro de Freitas (BA).
O projeto existe para dar à marca uma vitrine própria — hoje as vendas
acontecem só por Instagram e WhatsApp direto — sem o custo e a
complexidade de processar pagamento online: o cliente monta o carrinho,
revisa o pedido, e finaliza sendo redirecionado ao WhatsApp da loja com
a mensagem já pronta para combinar produção, entrega e pagamento.

## O que o site faz

**Para quem compra:**
- Navega o catálogo por categoria (bolsas, necessaires, copos,
  lembrancinhas, chaveiros), vê fotos, preço e pedido mínimo de cada item
- Monta o carrinho e escolhe entre quatro formas de entrega: retirada
  pessoal, entrega própria da loja, Uber Flash, ou Correios (com cotação
  automática via Melhor Envio)
- Finaliza o pedido e é levado direto ao WhatsApp com tudo resumido
- Se estiver logado, acompanha o status de cada pedido (novo → confirmado
  → em produção → pronto → enviado → entregue) e pode cancelar enquanto
  o pedido ainda não entrou em produção

**Para quem administra a loja:**
- Painel em `/admin` com dashboard (receita, pedidos por status, produtos
  mais vendidos, evolução dos últimos 14 dias)
- CRUD completo de produtos, com upload de fotos
- Gestão de pedidos: ver detalhes e avançar o status conforme a produção
  anda, com notificação em tempo real quando chega pedido novo

Cada pedido recebe um código curto e legível (formato `PLN-DDMM-XXXX`)
usado tanto na mensagem do WhatsApp quanto no painel admin, para achar
qualquer pedido rapidamente numa conversa.

## Identidade visual

A marca usa rosa (#F2578C), lilás (#C9AEEA), azul bebê (#AEE0F5) e tinta
(#3A2E39), com as fontes Baloo 2 (títulos) e Plus Jakarta Sans (texto), e
um elemento gráfico assinatura em formato de bandeirinha de festa junina
usado como divisor entre seções.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS no front, Supabase
(Postgres, Auth, Storage, Realtime) como backend, Melhor Envio para
cotação de frete dos Correios, Zustand para o carrinho, e Recharts para
os gráficos do painel admin. Todas as regras de negócio sensíveis
(preço, frete, criação de pedido) são recalculadas no servidor — o
client nunca é a fonte de verdade para valores.

O projeto também roda em **modo demo**, sem nenhuma variável de ambiente
configurada: catálogo mockado, sem login, sem persistência — útil para
navegar a interface sem depender de infraestrutura.

## Para instruções de instalação, deploy e configuração

Ver `AGENTS.md`, que documenta a arquitetura completa, e os comentários
de topo em `supabase/schema.sql` e `.env.example` para os passos práticos
de setup.
