import { cn } from "cn";

// Scoped keyframes (cpl- prefix): the truck drifts and bobs, wheels spin, the road and speed
// lines scroll left, exhaust puffs fade out behind. Reduced motion keeps a still truck (and the
// global rule in globals.css already shortens every animation).
const STYLES = `
@keyframes cpl-drive { 0%, 100% { transform: translateX(-4px); } 50% { transform: translateX(4px); } }
@keyframes cpl-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
@keyframes cpl-spin { to { transform: rotate(360deg); } }
@keyframes cpl-road { to { stroke-dashoffset: -32; } }
@keyframes cpl-speed { 0% { transform: translateX(10px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateX(-18px); opacity: 0; } }
@keyframes cpl-puff { 0% { transform: translate(0, 0) scale(0.6); opacity: 0.5; } 100% { transform: translate(-14px, -6px) scale(1.4); opacity: 0; } }
.cpl-drive { animation: cpl-drive 2.4s ease-in-out infinite; }
.cpl-bob { animation: cpl-bob 0.45s ease-in-out infinite; }
.cpl-wheel { transform-box: fill-box; transform-origin: center; animation: cpl-spin 0.55s linear infinite; }
.cpl-road { animation: cpl-road 0.5s linear infinite; }
.cpl-speed { animation: cpl-speed 0.9s linear infinite; }
.cpl-puff { transform-box: fill-box; transform-origin: center; animation: cpl-puff 1.2s ease-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .cpl-drive, .cpl-bob, .cpl-wheel, .cpl-road, .cpl-speed, .cpl-puff { animation: none; }
  .cpl-speed, .cpl-puff { opacity: 0; }
}
`;

function Wheel({ cx }: { cx: number }) {
  return (
    <g>
      <circle cx={cx} cy={70} r={9} className="fill-ink-primary" />
      <g className="cpl-wheel">
        <circle cx={cx} cy={70} r={5} className="fill-bg-surface" />
        <path
          d={`M${cx} 66v8M${cx - 4} 70h8`}
          className="stroke-ink-tertiary"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </g>
      <circle cx={cx} cy={70} r={1.5} className="fill-ink-primary" />
    </g>
  );
}

/**
 * Logistics-themed full-page loader: a delivery truck (white cargo box, accent-blue cab) driving on
 * a scrolling road. Pure SVG + scoped CSS, token colours only (light/dark follow the theme).
 * Announces `label` to screen readers.
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
      <svg viewBox="0 0 200 92" className="h-auto w-56" aria-hidden="true" focusable="false">
        {/* Speed lines behind the truck */}
        <g className="stroke-accent" strokeWidth={2.5} strokeLinecap="round" opacity={0.55}>
          <path className="cpl-speed" d="M8 30h16" />
          <path className="cpl-speed" style={{ animationDelay: "0.3s" }} d="M2 42h20" />
          <path className="cpl-speed" style={{ animationDelay: "0.6s" }} d="M10 54h12" />
        </g>
        {/* Soft ground shadow */}
        <ellipse cx={100} cy={80} rx={74} ry={3.5} className="fill-ink-primary" opacity={0.12} />
        <g className="cpl-drive">
          {/* Exhaust puffs */}
          <circle cx={24} cy={66} r={3} className="cpl-puff fill-border-strong" />
          <circle
            cx={24}
            cy={66}
            r={3}
            className="cpl-puff fill-border-strong"
            style={{ animationDelay: "0.6s" }}
          />
          <g className="cpl-bob">
            {/* Cargo box: white body, thin outline, accent stripe, a parcel badge */}
            <rect
              x={30}
              y={18}
              width={96}
              height={46}
              rx={6}
              className="fill-bg-surface stroke-border-strong"
              strokeWidth={1.5}
            />
            <path d="M31 57h94v1a5 5 0 0 1-5 5H36a5 5 0 0 1-5-5z" className="fill-accent" />
            <path d="M38 22v32" className="stroke-border-default" strokeWidth={1.5} />
            <rect
              x={70}
              y={28}
              width={20}
              height={18}
              rx={2}
              style={{ fill: "var(--scene-carton)" }}
            />
            <rect
              x={78}
              y={28}
              width={4}
              height={18}
              style={{ fill: "var(--scene-carton-tape)" }}
            />
            <rect
              x={70}
              y={28}
              width={20}
              height={4}
              rx={1}
              style={{ fill: "var(--scene-carton-light)" }}
            />
            <rect x={31} y={44} width={3} height={8} rx={1} className="fill-danger" />
            {/* Cab: accent body, glass window with a highlight, headlight, bumper */}
            <path
              d="M126 30h22a6 6 0 0 1 5 2.7l10.5 15.6a6 6 0 0 1 1 3.3V64h-38.5z"
              className="fill-accent"
            />
            <path d="M132 35h14.5a3 3 0 0 1 2.5 1.3l7 10.2H132z" className="fill-bg-subtle" />
            <path
              d="M136 36.5l-2 9"
              className="stroke-bg-surface"
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.9}
            />
            <path d="M144 50v10" className="stroke-ink-primary" strokeWidth={1} opacity={0.25} />
            <rect x={159} y={52} width={6} height={4} rx={1.5} className="fill-dot-warning" />
            <rect x={124} y={62} width={44} height={5} rx={2.5} className="fill-ink-primary" />
            <rect x={28} y={62} width={100} height={5} rx={2.5} className="fill-ink-primary" />
          </g>
          <Wheel cx={56} />
          <Wheel cx={104} />
          <Wheel cx={148} />
        </g>
        {/* Road: solid base and scrolling lane dashes */}
        <path
          d="M4 86h192"
          className="stroke-border-default"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <path
          d="M4 86h192"
          className="cpl-road stroke-ink-tertiary"
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="16 16"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
