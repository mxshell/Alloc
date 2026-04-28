import React from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { formatCurrency, formatPercentageOfPortfolio } from "../utils/formatters";

export interface TreemapTooltipRow {
    label: string;
    value: React.ReactNode;
}

export interface TreemapDatum {
    name: string;
    size: number;
    percentage?: number | null;
    tooltipTitle?: string;
    tooltipRows?: TreemapTooltipRow[];
}

interface TreemapChartProps {
    data: TreemapDatum[];
    animationDuration?: number;
    aspectRatio?: number;
    emptyMessage?: string;
    heightClassName?: string;
    initialHeight?: number;
}

interface TooltipPayload<T> {
    payload?: T;
}

interface TooltipContentProps<T> {
    active?: boolean;
    payload?: TooltipPayload<T>[];
}

interface TreemapContentProps {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    index?: number;
    name?: string;
    percentage?: number | null;
}

const CHART_COLORS = [
    "#0f766e",
    "#2563eb",
    "#7c3aed",
    "#ca8a04",
    "#db2777",
    "#059669",
    "#0284c7",
    "#9333ea",
    "#d97706",
    "#64748b",
];

const LABEL_FONT_SIZE = 14;
const DETAIL_FONT_SIZE = 12;

const truncateSvgLabel = (value: string, width: number, fontSize: number) => {
    const maxChars = Math.floor(Math.max(width - 16, 0) / (fontSize * 0.62));
    if (value.length <= maxChars) return value;
    if (maxChars <= 3) return "";
    return `${value.slice(0, maxChars - 3)}...`;
};

const getFillColor = (index: number, totalCount: number) => {
    if (totalCount <= 1) return CHART_COLORS[0];

    const colorIndex = Math.min(
        Math.floor((index / totalCount) * CHART_COLORS.length),
        CHART_COLORS.length - 1,
    );

    return CHART_COLORS[colorIndex];
};

const TreemapTooltip: React.FC<TooltipContentProps<TreemapDatum>> = ({
    active,
    payload,
}) => {
    const datum = payload?.[0]?.payload;
    if (!active || !datum) return null;

    const rows = datum.tooltipRows ?? [
        { label: "Market Value", value: formatCurrency(datum.size) },
        {
            label: "Portfolio",
            value: formatPercentageOfPortfolio(datum.percentage),
        },
    ];

    return (
        <div className="z-50 rounded border border-slate-700 bg-slate-950 p-3 text-sm shadow-xl">
            <p className="mb-1 font-bold text-white">
                {datum.tooltipTitle ?? datum.name}
            </p>
            {rows.map((row) => (
                <p key={row.label} className="text-slate-300">
                    {row.label}:{" "}
                    <span className="font-mono text-white">{row.value}</span>
                </p>
            ))}
        </div>
    );
};

const createTreemapContent = (totalCount: number) => {
    return ({
        x = 0,
        y = 0,
        width = 0,
        height = 0,
        index = 0,
        name = "",
        percentage,
    }: TreemapContentProps) => {
        if (width < 30 || height < 30) return null;

        const label = truncateSvgLabel(name, width, LABEL_FONT_SIZE);

        return (
            <g>
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx={4}
                    ry={4}
                    style={{
                        fill: getFillColor(index, totalCount),
                        stroke: "#0f172a",
                        strokeOpacity: 0.55,
                        strokeWidth: 1,
                    }}
                />
                {label && width > 56 && height > 42 && (
                    <>
                        <text
                            x={x + width / 2}
                            y={y + height / 2 - 7}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontFamily='"Inter", sans-serif'
                            fontSize={LABEL_FONT_SIZE}
                            fontWeight={700}
                            style={{ pointerEvents: "none" }}
                        >
                            {label}
                        </text>
                        <text
                            x={x + width / 2}
                            y={y + height / 2 + 11}
                            textAnchor="middle"
                            fill="#ffffff"
                            fillOpacity={0.88}
                            fontFamily='"Inter", sans-serif'
                            fontSize={DETAIL_FONT_SIZE}
                            style={{ pointerEvents: "none" }}
                        >
                            {formatPercentageOfPortfolio(percentage)}
                        </text>
                    </>
                )}
            </g>
        );
    };
};

const TreemapChart: React.FC<TreemapChartProps> = ({
    data,
    animationDuration = 450,
    aspectRatio = 1,
    emptyMessage = "No data available.",
    heightClassName = "h-[400px]",
    initialHeight = 400,
}) => {
    if (data.length === 0) {
        return (
            <div
                className={`${heightClassName} flex items-center justify-center rounded border border-dashed border-slate-700 text-sm text-slate-500`}
            >
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className={`${heightClassName} min-w-0 w-full`}>
            <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={1}
                minHeight={1}
                initialDimension={{ width: 1, height: initialHeight }}
            >
                <Treemap
                    data={data}
                    dataKey="size"
                    aspectRatio={aspectRatio}
                    animationDuration={animationDuration}
                    content={createTreemapContent(data.length)}
                >
                    <Tooltip content={<TreemapTooltip />} />
                </Treemap>
            </ResponsiveContainer>
        </div>
    );
};

export default TreemapChart;
