"use client";

interface Props {
  data?: number[];
  color?: string;
  width?: number;
  height?: number;
}

/**
 * Minimal static sparkline — visual element, not a real chart.
 * Default data matches the reference relationship-health "cooled" line (74 → 61).
 */
export function Sparkline({
  data = [74, 73, 71, 68, 64, 61],
  color = "var(--color-bad)",
  width = 80,
  height = 22,
}: Props) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);
  const stepX = width / Math.max(1, data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block align-middle"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
