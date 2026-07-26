const COLORS = ["#F2578C", "#C9AEEA", "#AEE0F5", "#FFFFFF"];

/**
 * Elemento assinatura da Plin Designs: uma fileira de bandeirinhas de festa
 * (o mesmo motivo usado em decoração real de festa) como divisor entre
 * seções, em vez de uma linha genérica. Repetido ao longo do site para dar
 * identidade — é o "acessório" que a marca não tira.
 */
export default function BuntingDivider({
  className = "",
  background = "transparent",
}: {
  className?: string;
  background?: string;
}) {
  const flags = Array.from({ length: 24 });

  return (
    <div
      aria-hidden="true"
      className={`flex w-full justify-center overflow-hidden ${className}`}
      style={{ background }}
    >
      <div className="flex">
        {flags.map((_, i) => (
          <svg
            key={i}
            width="28"
            height="22"
            viewBox="0 0 28 22"
            className="-ml-[1px]"
          >
            <path
              d="M0 0 H28 L14 22 Z"
              fill={COLORS[i % COLORS.length]}
              stroke="#FFFFFF"
              strokeWidth="1"
            />
          </svg>
        ))}
      </div>
    </div>
  );
}
