import React, { useMemo } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { PositionData } from "../types";
import {
    formatCurrency,
    formatPercentageOfPortfolio,
} from "../utils/dataParser";

interface PortfolioChartProps {
    positions: PositionData[];
}

// Helper to identify options (same regex logic as Table)
const isOption = (code: string) => /[0-9]{6}[CP][0-9]+/.test(code);

// Coastal Blues gradient palette
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

// Green Harmony gradient palette
// const COLORS = [
//     "#10451d",
//     "#155d27",
//     "#1a7431",
//     "#208b3a",
//     "#25a244",
//     "#2dc653",
//     "#4ad66d",
//     "#6ede8a",
//     "#92e6a7",
//     "#b7efc5",
// ];

// Vivid Nightfall gradient palette
// const COLORS = [
//     "#7400b8",
//     "#6930c3",
//     "#5e60ce",
//     "#5390d9",
//     "#4ea8de",
//     "#48bfe3",
//     "#56cfe1",
//     "#64dfdf",
//     "#72efdd",
//     "#80ffdb",
// ];

// Deep Sea Blue gradient palette
// const COLORS = [
//     "#0466c8",
//     "#0353a4",
//     "#023e7d",
//     "#002855",
//     "#001845",
//     "#001233",
//     "#33415c",
//     "#5c677d",
//     "#7d8597",
//     "#979dac",
// ];

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
                <p className="font-bold text-white mb-1">
                    {data.full_name} ({data.name})
                </p>
                <p className="text-slate-300">
                    Market Value:{" "}
                    <span className="font-mono text-white">
                        {formatCurrency(data.size)}
                    </span>
                </p>
                <p className="text-slate-300">
                    Shares:{" "}
                    <span className="font-mono text-white">{data.qty}</span>
                </p>
            </div>
        );
    }
    return null;
};

const createCustomizedContent = (totalCount: number) => {
    return (props: any) => {
        const { x, y, width, height, index, name, qty, percentage } = props;

        // select color based on relative position
        // Clamp selectId to ensure it's always within bounds [0, COLORS.length - 1]
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

        // Don't render text for tiny boxes
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

const PortfolioChart: React.FC<PortfolioChartProps> = ({ positions }) => {
    // Filter out options and trivial amounts
    const data = useMemo(() => {
        return positions
            .filter((p) => !isOption(p.code) && Math.abs(p.market_val) > 10)
            .map((p) => {
                // Extract symbol (e.g. US.TSLA -> TSLA)
                const symbol = p.code.includes(".")
                    ? p.code.split(".")[1]
                    : p.code;
                return {
                    name: symbol,
                    size: Math.abs(p.market_val), // Size must be positive
                    qty: p.qty,
                    full_name: p.stock_name,
                    percentage: p.percentage_of_portfolio,
                };
            })
            .sort((a, b) => b.size - a.size);
    }, [positions]);

    return (
        <div
            className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm mb-8"
            style={{
                fontFamily: '"Inter", sans-serif',
                WebkitFontSmoothing: "antialiased",
                MozOsxFontSmoothing: "grayscale",
            }}
        >
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white">
                        Portfolio Allocation
                    </h2>
                    <p className="text-sm text-slate-400">
                        Visualizing all stock (options excluded) positions'
                        current Market Value w.r.t. Total Assets value.
                    </p>
                </div>
            </div>

            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={data}
                        dataKey="size"
                        aspectRatio={1}
                        content={createCustomizedContent(data.length)}
                    >
                        <Tooltip content={<CustomTooltip />} />
                    </Treemap>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default PortfolioChart;
