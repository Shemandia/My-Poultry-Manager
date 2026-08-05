"use client";

import { cn } from "@/lib/utils";

type SeriesConfig = {
  key: string;
  label: string;
  color: string;
};

type MultiLineDatum = {
  label: string;
  [key: string]: string | number;
};

type DualLineConfig = {
  key: string;
  label: string;
  color: string;
};

type StackedRow = {
  label: string;
  income: number;
  expense: number;
};

function clampMinMax(min: number, max: number) {
  if (min === max) {
    return { min: Math.max(0, min - 1), max: max + 1 };
  }
  return { min, max };
}

function toPath(
  values: number[],
  width: number,
  height: number,
  minValue: number,
  maxValue: number,
  padding = 8
) {
  if (values.length === 0) return "";
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const span = maxValue - minValue || 1;

  return values
    .map((value, idx) => {
      const x = padding + (idx / Math.max(values.length - 1, 1)) * innerWidth;
      const y = padding + (1 - (value - minValue) / span) * innerHeight;
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function Sparkline({
  values,
  color = "#10b981",
  className,
}: {
  values: number[];
  color?: string;
  className?: string;
}) {
  const width = 180;
  const height = 56;
  const safe = values.length > 1 ? values : [0, 0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = clampMinMax(min, max);
  const path = toPath(safe, width, height, range.min, range.max, 5);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-14 w-full", className)}
      role="img"
      aria-label="Trend sparkline"
    >
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function MultiLineChart({
  data,
  series,
  className,
  height = 260,
}: {
  data: MultiLineDatum[];
  series: SeriesConfig[];
  className?: string;
  height?: number;
}) {
  const width = 900;
  const padX = 36;
  const padY = 20;
  const values = data.flatMap((row) => series.map((s) => Number(row[s.key] ?? 0)));
  const max = Math.max(...values, 1);

  return (
    <div className={cn("rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Time series chart">
        {[0.25, 0.5, 0.75, 1].map((p) => {
          const y = height - padY - (height - padY * 2) * p;
          return <line key={p} x1={padX} y1={y} x2={width - padX} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
        })}
        {series.map((s) => {
          const pts = data.map((row) => Number(row[s.key] ?? 0));
          const path = toPath(pts, width, height, 0, max, padX);
          return <path key={s.key} d={path} fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" />;
        })}
        {data.length > 0 && (
          <>
            <text x={padX} y={height - 4} className="fill-gray-400 text-[11px]">
              {data[0].label}
            </text>
            <text x={width / 2} y={height - 4} textAnchor="middle" className="fill-gray-400 text-[11px]">
              {data[Math.floor((data.length - 1) / 2)]?.label}
            </text>
            <text x={width - padX} y={height - 4} textAnchor="end" className="fill-gray-400 text-[11px]">
              {data[data.length - 1].label}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

export function DualAxisOverlayChart({
  data,
  left,
  right,
  className,
  height = 260,
}: {
  data: MultiLineDatum[];
  left: DualLineConfig;
  right: DualLineConfig;
  className?: string;
  height?: number;
}) {
  const width = 900;
  const padX = 36;
  const padY = 20;

  const leftVals = data.map((d) => Number(d[left.key] ?? 0));
  const rightVals = data.map((d) => Number(d[right.key] ?? 0));
  const leftMax = Math.max(...leftVals, 1);
  const rightMax = Math.max(...rightVals, 1);

  const leftPath = toPath(leftVals, width, height, 0, leftMax, padX);
  const rightPath = toPath(rightVals, width, height, 0, rightMax, padX);

  return (
    <div className={cn("rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200", className)}>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: left.color }} />
          <span>{left.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: right.color }} />
          <span>{right.label}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Overlay chart">
        {[0.25, 0.5, 0.75, 1].map((p) => {
          const y = height - padY - (height - padY * 2) * p;
          return <line key={p} x1={padX} y1={y} x2={width - padX} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
        })}

        <path d={leftPath} fill="none" stroke={left.color} strokeWidth="3" strokeLinecap="round" />
        <path d={rightPath} fill="none" stroke={right.color} strokeWidth="3" strokeLinecap="round" />

        <text x={padX} y={14} className="fill-gray-500 text-[11px]">
          {left.label}: {leftVals[leftVals.length - 1] ?? 0}
        </text>
        <text x={width - padX} y={14} textAnchor="end" className="fill-gray-500 text-[11px]">
          {right.label}: {rightVals[rightVals.length - 1] ?? 0}
        </text>
      </svg>
    </div>
  );
}

export function StackedCategoryChart({
  rows,
  className,
  height = 260,
}: {
  rows: StackedRow[];
  className?: string;
  height?: number;
}) {
  const width = 900;
  const padX = 50;
  const padBottom = 54;
  const max = Math.max(...rows.map((r) => r.income + r.expense), 1);
  const innerHeight = height - 18 - padBottom;
  const barWidth = Math.min(64, (width - padX * 2) / Math.max(rows.length, 1) - 12);

  return (
    <div className={cn("rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200", className)}>
      <div className="mb-3 flex items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>Income</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          <span>Expense</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Stacked category chart">
        {[0.25, 0.5, 0.75, 1].map((p) => {
          const y = height - padBottom - innerHeight * p;
          return <line key={p} x1={padX} y1={y} x2={width - padX} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
        })}

        {rows.map((row, idx) => {
          const xStep = (width - padX * 2) / Math.max(rows.length, 1);
          const x = padX + idx * xStep + (xStep - barWidth) / 2;
          const incomeH = (row.income / max) * innerHeight;
          const expenseH = (row.expense / max) * innerHeight;
          const incomeY = height - padBottom - incomeH;
          const expenseY = incomeY - expenseH;

          return (
            <g key={row.label}>
              <rect x={x} y={incomeY} width={barWidth} height={incomeH} fill="#10b981" rx="6" />
              <rect x={x} y={expenseY} width={barWidth} height={expenseH} fill="#f43f5e" rx="6" />
              <text
                x={x + barWidth / 2}
                y={height - 28}
                textAnchor="middle"
                className="fill-gray-500 text-[10px]"
                transform={`rotate(-28 ${x + barWidth / 2} ${height - 28})`}
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
