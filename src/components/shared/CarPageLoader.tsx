import { cn } from "cn";

// Scoped keyframes (cpl- prefix): the truck drifts and bobs, wheels spin, the road and speed
// lines scroll left to imply motion. Reduced motion keeps a still truck (and the global rule
// in globals.css already shortens every animation).
const STYLES = `
@keyframes cpl-drive { 0%, 100% { transform: translateX(-4px); } 50% { transform: translateX(4px); } }
@keyframes cpl-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
@keyframes cpl-spin { to { transform: rotate(360deg); } }
@keyframes cpl-road { to { stroke-dashoffset: -28; } }
@keyframes cpl-speed { 0% { transform: translateX(10px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateX(-18px); opacity: 0; } }
.cpl-drive { animation: cpl-drive 2.4s ease-in-out infinite; }
.cpl-bob { animation: cpl-bob 0.45s ease-in-out infinite; }
.cpl-wheel { transform-box: fill-box; transform-origin: center; animation: cpl-spin 0.55s linear infinite; }
.cpl-road { animation: cpl-road 0.5s linear infinite; }
.cpl-speed { animation: cpl-speed 0.9s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .cpl-drive, .cpl-bob, .cpl-wheel, .cpl-road, .cpl-speed { animation: none; }
  .cpl-speed { opacity: 0; }
}
`;

function Wheel({ cx }: { cx: number }) {
  return (
    <g className="cpl-wheel">
      <circle cx={cx} cy={58} r={7} className="fill-ink-primary" />
      <circle cx={cx} cy={58} r={3} className="fill-bg-surface" />
      <path
        d={`M${cx} 52.5v11M${cx - 5.5} 58h11`}
        className="stroke-ink-primary"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </g>
  );
}

/**
 * Logistics-themed full-page loader: a delivery truck driving on a scrolling road.
 * Pure SVG + scoped CSS, no animation dependency. Announces `label` to screen readers.
 */
export function CarPageLoader({
  label = "Đang tải…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" className={cn("flex flex-col items-center gap-3", className)}>
      <style>{STYLES}</style>
      <svg viewBox="0 0 160 76" className="h-auto w-40" aria-hidden="true" focusable="false">
        {/* Speed lines behind the truck */}
        <g className="stroke-border-strong" strokeWidth={2} strokeLinecap="round">
          <path className="cpl-speed" d="M16 30h14" />
          <path className="cpl-speed" style={{ animationDelay: "0.3s" }} d="M10 40h18" />
          <path className="cpl-speed" style={{ animationDelay: "0.6s" }} d="M18 50h12" />
        </g>
        <g className="cpl-drive">
          <g className="cpl-bob">
            {/* Cargo box */}
            <rect x={36} y={22} width={58} height={32} rx={3} className="fill-brand" />
            <rect x={44} y={30} width={22} height={4} rx={2} className="fill-accent" />
            {/* Cab */}
            <path
              d="M94 32h16.5a4 4 0 0 1 3.4 1.9l7.6 12.2a4 4 0 0 1 .6 2.1V54H94z"
              className="fill-ink-primary"
            />
            <path d="M99 36h10.5l5.6 9H99z" className="fill-bg-subtle" />
            <rect x={119} y={49} width={4} height={3} rx={1} className="fill-accent" />
          </g>
          <Wheel cx={52} />
          <Wheel cx={108} />
        </g>
        {/* Road: solid base and scrolling lane dashes */}
        <path
          d="M4 66h152"
          className="stroke-border-default"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <path
          d="M4 72h152"
          className="cpl-road stroke-ink-tertiary"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="14 14"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
