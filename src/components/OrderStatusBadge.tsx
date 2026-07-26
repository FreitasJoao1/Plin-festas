import { OrderStatus } from "@/lib/types";

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  novo:        { label: "Novo",        className: "bg-blue-100 text-blue-700" },
  confirmado:  { label: "Confirmado",  className: "bg-purple-100 text-purple-700" },
  em_producao: { label: "Em produção", className: "bg-amber-100 text-amber-700" },
  pronto:      { label: "Pronto",      className: "bg-teal-100 text-teal-700" },
  enviado:     { label: "Enviado",     className: "bg-indigo-100 text-indigo-700" },
  entregue:    { label: "Entregue",    className: "bg-green-100 text-green-700" },
  cancelado:   { label: "Cancelado",   className: "bg-red-100 text-red-700" },
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, className } = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}
