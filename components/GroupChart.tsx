import React from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import {
    formatCurrency,
    formatPercentageOfPortfolio,
} from "../utils/dataParser";

interface GroupChartDatum {
    name: string;
    size: number;
    percentage: number;
    tickers: string[];
}

interface GroupChartProps {
    data: GroupChartDatum[];
    emptyMessage?: string;
}

// Coastal Blues gradient palette (same as PortfolioChart)
const COLORS = [
    "#012a4a",
    "#013a63",
    "#01497c",
    "#014f86",
    "#2a6f97",
    "#2c7da0",
    "#468faf",
    "#61a5c2",
    "#89c2d9",
    "#a9d6e5",
];

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div
                className="bg-slate-900 border border-slate-700 p-3 rounded shadow-xl text-sm z-50"
                style={{
                    fontFamily: '"Inter", sans-serif',
                    WebkitFontSmoothing: "antialiased",
                    MozOsxFontSmoothing: "grayscale",
                }}
            >
                <p className="font-bold text-white mb-1">{data.name}</p>
                <p className="text-slate-300">
                    Market Value:{" "}
                    <span className="font-mono text-white">
                        {formatCurrency(data.size)}
                    </span>
                </p>
                <p className="text-slate-300">
                    Percentage:{" "}
                    <span className="font-mono text-white">
                        {formatPercentageOfPortfolio(data.percentage)}
                    </span>
                </p>
                {data.tickers && data.tickers.length > 0 && (
                    <p className="text-slate-300 mt-2">
                        Tickers:{" "}
                        <span className="font-mono text-white text-xs">
                            {data.tickers.join(", ")}
                        </span>
                    </p>
                )}
            </div>
        );
    }
    return null;
};

const createCustomizedContent = (totalCount: number) => {
    return (props: any) => {
        const { x, y, width, height, index, name, percentage } = props;

        const reverseSelect = false;
        const selectId =
            totalCount > 0
                ? Math.min(
                      Math.floor((index / totalCount) * COLORS.length),
                      COLORS.length - 1
                  )
                : 0;
        const reversedSelectId = COLORS.length - 1 - selectId;
        const fill = COLORS[reverseSelect ? reversedSelectId : selectId];
        const textColor = "#ffffff";

        if (width < 30 || height < 30) return null;

        return (
            <g>
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    style={{
                        fill: fill,
                        stroke: "#0f172a",
                        strokeWidth: 1,
                        strokeOpacity: 0.5,
                    }}
                    rx={6}
                    ry={6}
                />
                {width > 60 && height > 40 && (
                    <>
                        <text
                            x={x + width / 2}
                            y={y + height / 2 - 8}
                            textAnchor="middle"
                            fill={textColor}
                            fontSize={Math.min(width / 4, 18)}
                            fontWeight="bold"
                            fontFamily='"Inter", sans-serif'
                            style={{
                                pointerEvents: "none",
                                textRendering: "optimizeLegibility",
                                WebkitFontSmoothing: "antialiased",
                                MozOsxFontSmoothing: "grayscale",
                            }}
                        >
                            {name}
                        </text>
                        <text
                            x={x + width / 2}
                            y={y + height / 2 + 10}
                            textAnchor="middle"
                            fill={textColor}
                            fillOpacity={0.9}
                            fontSize={Math.min(width / 6, 12)}
                            fontFamily='"Inter", sans-serif'
                            style={{
                                pointerEvents: "none",
                                textRendering: "optimizeLegibility",
                                WebkitFontSmoothing: "antialiased",
                                MozOsxFontSmoothing: "grayscale",
                            }}
                        >
                            {formatPercentageOfPortfolio(percentage)}
                        </text>
                    </>
                )}
            </g>
        );
    };
};

const GroupChart: React.FC<GroupChartProps> = ({ data, emptyMessage }) => {
    if (!data || data.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                {emptyMessage ||
                    "No data available for this group. Please add tickers to the group."}
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <Treemap
                data={data}
                dataKey="size"
                aspectRatio={4 / 3}
                animationDuration={0}
                content={createCustomizedContent(data.length)}
            >
                <Tooltip content={<CustomTooltip />} />
            </Treemap>
        </ResponsiveContainer>
    );
};

export default GroupChart;
