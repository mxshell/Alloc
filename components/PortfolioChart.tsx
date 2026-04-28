import React, { useMemo } from "react";
import { PositionData } from "../types";
import TreemapChart, { TreemapDatum } from "./TreemapChart";
import {
    formatCurrency,
    formatPercentageOfPortfolio,
} from "../utils/formatters";
import {
    extractTicker,
    getPositionMarketValue,
    isOptionCode,
} from "../utils/portfolio";

interface PortfolioChartProps {
    positions: PositionData[];
}

const MIN_CHART_VALUE = 10;

const PortfolioChart: React.FC<PortfolioChartProps> = ({ positions }) => {
    const data = useMemo<TreemapDatum[]>(() => {
        return positions
            .filter(
                (position) =>
                    !isOptionCode(position.code) &&
                    getPositionMarketValue(position) > MIN_CHART_VALUE,
            )
            .map((position) => {
                const ticker = extractTicker(position.code);

                return {
                    name: ticker,
                    size: getPositionMarketValue(position),
                    percentage: position.percentage_of_portfolio,
                    tooltipTitle: `${position.stock_name} (${ticker})`,
                    tooltipRows: [
                        {
                            label: "Market Value",
                            value: formatCurrency(position.market_val),
                        },
                        {
                            label: "Portfolio",
                            value: formatPercentageOfPortfolio(
                                position.percentage_of_portfolio,
                            ),
                        },
                        { label: "Shares", value: position.qty },
                    ],
                };
            })
            .sort((a, b) => b.size - a.size);
    }, [positions]);

    return (
        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-sm">
            <div className="mb-6">
                <h2 className="text-lg font-bold text-white">
                    Portfolio Allocation
                </h2>
                <p className="text-sm text-slate-400">
                    Stock positions by current market value. Options are
                    excluded.
                </p>
            </div>

            <TreemapChart
                data={data}
                emptyMessage="No stock positions available for the allocation chart."
            />
        </div>
    );
};

export default PortfolioChart;
