/**
 * Logo da Plin Design conforme briefing:
 * - "Plin" em gradiente rosa → azul-bebê → lilás
 * - "design" com cada letra em quadrado/estrela 4 pontas, branco sobre fundo colorido
 */
export default function PlinLogo({ className = "h-10" }: { className?: string }) {
  const LETTERS = ["d", "e", "s", "i", "g", "n"];
  // Alterna entre quadrado e estrela 4 pontas
  const shapes = ["square", "star", "square", "star", "square", "star"] as const;
  const colors = ["#F2578C", "#AD87DC", "#82CBE9", "#F2578C", "#AD87DC", "#82CBE9"];

  return (
    <svg
      viewBox="0 0 292 60"
      className={className}
      role="img"
      aria-label="Plin Design"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="plin-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F2578C" />
          <stop offset="50%" stopColor="#82CBE9" />
          <stop offset="100%" stopColor="#AD87DC" />
        </linearGradient>
      </defs>

      {/* "Plin" */}
      <text
        x="0"
        y="44"
        fontFamily="'Baloo 2', sans-serif"
        fontSize="48"
        fontWeight="800"
        fill="url(#plin-grad)"
        letterSpacing="-1"
      >
        Plin
      </text>

      {/* "design" — cada letra num quadrado ou estrela */}
      {LETTERS.map((letter, idx) => {
        const x = 118 + idx * 29;
        const cy = 30;
        const cx = x + 12;
        const color = colors[idx];
        const isSquare = shapes[idx] === "square";

        return (
          <g key={idx}>
            {isSquare ? (
              <rect
                x={x}
                y={cy - 14}
                width={24}
                height={24}
                rx={4}
                fill={color}
              />
            ) : (
              /* Estrela 4 pontas via path */
              <path
                d={`M${cx},${cy - 14} L${cx + 8},${cy - 6} L${cx + 14},${cy} L${cx + 8},${cy + 6} L${cx},${cy + 14} L${cx - 8},${cy + 6} L${cx - 14},${cy} L${cx - 8},${cy - 6} Z`}
                fill={color}
              />
            )}
            <text
              x={cx}
              y={cy + 5}
              textAnchor="middle"
              fontFamily="'Baloo 2', sans-serif"
              fontSize="13"
              fontWeight="700"
              fill="white"
            >
              {letter}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
