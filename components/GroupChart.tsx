import React, { useMemo } from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { PositionData, CategoricalGroup, SubGroupData } from "../types";
import {
    formatCurrency,
    formatPercentageOfPortfolio,
    extractTicker,
    findPositionsByTicker,
} from "../utils/dataParser";

interface GroupChartProps {
    positions: PositionData[];
    group: CategoricalGroup;
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

        // Select color based on relative position
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

const GroupChart: React.FC<GroupChartProps> = ({ positions, group }) => {
    const data = useMemo(() => {
        // Calculate sub-group totals
        const subGroupMap = new Map<string, SubGroupData>();

        // Process each ticker in the group
        group.tickers.forEach((ticker) => {
            const subGroupName = group.subGroups[ticker] || ticker;
            const matchingPositions = findPositionsByTicker(positions, ticker);

            // Sum market values for this ticker
            const tickerValue = matchingPositions.reduce(
                (sum, pos) => sum + Math.abs(pos.market_val),
                0
            );

            // Add to sub-group
            if (subGroupMap.has(subGroupName)) {
                const existing = subGroupMap.get(subGroupName)!;
                existing.value += tickerValue;
                existing.tickers.push(ticker);
            } else {
                subGroupMap.set(subGroupName, {
                    name: subGroupName,
                    value: tickerValue,
                    percentage: 0, // Will calculate after
                    tickers: [ticker],
                });
            }
        });

        // Calculate total group value
        const groupTotal = Array.from(subGroupMap.values()).reduce(
            (sum, sg) => sum + sg.value,
            0
        );

        // Calculate percentages relative to group total
        const subGroups: SubGroupData[] = Array.from(subGroupMap.values()).map(
            (sg) => ({
                ...sg,
                percentage: groupTotal > 0 ? (sg.value / groupTotal) * 100 : 0,
            })
        );

        // Convert to chart data format and sort by value
        return subGroups
            .map((sg) => ({
                name: sg.name,
                size: sg.value,
                percentage: sg.percentage,
                tickers: sg.tickers,
            }))
            .sort((a, b) => b.size - a.size);
    }, [positions, group]);

    if (data.length === 0) {
        return (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm">
                <p className="text-slate-400 text-sm">
                    No data available for this group. Please add tickers to the
                    group.
                </p>
            </div>
        );
    }

    return (
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
    );
};

export default GroupChart;
