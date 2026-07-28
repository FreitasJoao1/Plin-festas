import Link from "next/link";
import { ShieldCheck, Lock, UserCheck, Mail } from "lucide-react";

export const metadata = {
  title: "Política de Privacidade e Proteção de Dados (LGPD) | Plin Designs",
  description: "Entenda como a Plin Designs coleta, utiliza e protege seus dados pessoais de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).",
};

export default function PrivacidadePage() {
  return (
    <div className="container-plin max-w-4xl py-12">
      <div className="mb-8 border-b border-pink-100 pb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600">
          <ShieldCheck className="h-4 w-4" /> Conformidade com a Lei nº 13.709/2018
        </div>
        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
          Política de Privacidade e Proteção de Dados
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>
      </div>

      <div className="space-y-8 text-sm leading-relaxed text-ink-soft">
        <section className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Lock className="h-5 w-5 text-pink-500" /> 1. Compromisso com sua Privacidade
          </h2>
          <p>
            A <strong>Plin Designs</strong> tem o compromisso de respeitar a sua privacidade e garantir a segurança dos seus dados pessoais. Esta Política de Privacidade descreve como coletamos, armazenamos, usamos e protegemos as informações fornecidas por você durante o uso da nossa loja virtual.
          </p>
        </section>

        <section className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">
            2. Quais Dados Coletamos e Para Quê?
          </h2>
          <p className="mb-3">
            Coletamos apenas os dados essenciais para efetuar o cadastro, processar vendas e entregar seus produtos personalizados:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Nome completo e e-mail:</strong> Para identificação da conta, envio de comprovantes de compra e suporte.</li>
            <li><strong>Telefone / WhatsApp:</strong> Para alinhamento de personalização das artes e atualização sobre o envio do pedido.</li>
            <li><strong>Endereço de entrega e CEP:</strong> Para cálculo de frete e envio físico das encomendas.</li>
            <li><strong>Dados de Pagamento:</strong> Processados de forma 100% criptografada diretamente pelo intermediador de pagamento. Não armazenamos senhas de cartão ou dados bancários em nossos servidores.</li>
          </ul>
        </section>

        <section id="direitos-lgpd" className="rounded-2xl border border-pink-100 bg-pink-50/50 p-6 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
            <UserCheck className="h-5 w-5 text-pink-500" /> 3. Seus Direitos Garantidos pela LGPD (Art. 18)
          </h2>
          <p className="mb-3">Como titular dos dados pessoais, você tem o direito de solicitar a qualquer momento:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Confirmação da existência de tratamento dos seus dados;</li>
            <li>Acesso fácil e rápido aos dados cadastrados;</li>
            <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
            <li><strong>Exclusão ou anonimização de dados:</strong> você pode solicitar a exclusão definitiva da sua conta a qualquer momento.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-display text-lg font-bold text-ink">
            4. Compartilhamento de Dados com Terceiros
          </h2>
          <p>
            Não vendemos nem alugamos seus dados pessoais. O compartilhamento ocorre estritamente com parceiros necessários para a operação do e-commerce:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Serviços de transporte e entrega (Correios / Transportadoras);</li>
            <li>Processadores de pagamento seguros;</li>
            <li>Plataforma de banco de dados e autenticação criptografada.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Mail className="h-5 w-5 text-pink-500" /> 5. Contato do Encarregado de Dados (DPO)
          </h2>
          <p>
            Para exercer seus direitos de titular, tirar dúvidas sobre nossa Política de Privacidade ou solicitar a exclusão do seu cadastro, entre em contato com a nossa equipe:
          </p>
          <div className="mt-3 rounded-xl bg-pink-50 p-4 font-medium text-pink-700">
            E-mail do DPO: <a href="mailto:dpo@plindesigngrafico.com.br" className="underline">dpo@plindesigngrafico.com.br</a><br />
            Atendimento: Segunda a Sexta, das 09h às 18h
          </div>
        </section>
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-lilac-500">
          Voltar para a Loja
        </Link>
      </div>
    </div>
  );
}
