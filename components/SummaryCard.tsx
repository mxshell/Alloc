import React from "react";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Wallet,
    Activity,
} from "lucide-react";
import { AccountData } from "../types";
import { formatCurrency } from "../utils/dataParser";

interface SummaryCardProps {
    account: AccountData;
}

const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
};

const Card = ({
    title,
    value,
    subValue,
    icon: Icon,
    trend,
    numericValue,
    valueColor,
}: {
    title: string;
    value: string;
    subValue?: string;
    icon: any;
    trend?: "up" | "down" | "neutral";
    numericValue?: number;
    valueColor?: "red" | "green" | string;
}) => {
    // Determine the color for the value
    let colorClass = "text-slate-100"; // default

    if (valueColor) {
        if (valueColor === "red") {
            colorClass = "text-rose-400";
        } else if (valueColor === "green") {
            colorClass = "text-emerald-400";
        } else {
            // Custom color - use inline style for arbitrary colors
            // For Tailwind classes, you could also use arbitrary values like text-[#ff0000]
            colorClass = "";
        }
    } else if (numericValue !== undefined) {
        // Auto-determine color based on sign
        colorClass = numericValue >= 0 ? "text-emerald-400" : "text-rose-400";
    }

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-slate-700/50 rounded-lg">
                    <Icon className="w-5 h-5 text-slate-400" />
                </div>
                {trend && (
                    <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                            trend === "up"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : trend === "down"
                                ? "bg-rose-500/10 text-rose-400"
                                : "bg-slate-700 text-slate-400"
                        }`}
                    >
                        {trend === "up"
                            ? "Long"
                            : trend === "down"
                            ? "Short"
                            : "Neutral"}
                    </span>
                )}
            </div>
            <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
            <div
                className={`text-2xl font-bold ${colorClass}`}
                style={
                    valueColor && valueColor !== "red" && valueColor !== "green"
                        ? { color: valueColor }
                        : undefined
                }
            >
                {value}
            </div>
            {subValue && (
                <div className="text-sm text-slate-500 mt-1">{subValue}</div>
            )}
        </div>
    );
};

const SummaryCard: React.FC<SummaryCardProps> = ({ account }) => {
    // Calculate a mock Daily P/L roughly based on unrealized for demo if not explicitly separate
    // The CSV has 'unrealized_pl' as "N/A" in the account file, but we can sum it from positions if needed.
    // However, let's use what we have.

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card
                title="Total Assets"
                value={formatCurrency(account.total_assets)}
                subValue="Net Liquidation Value"
                icon={Wallet}
            />

            <Card
                title="Market Value (Long Positions)"
                value={formatCurrency(account.long_mv)}
                subValue={
                    formatPercentage(account.long_mv / account.total_assets) +
                    " of Total Assets"
                }
                icon={TrendingUp}
                trend="up"
            />

            <Card
                title="Market Value (Short Positions)"
                value={formatCurrency(account.short_mv)}
                subValue={
                    formatPercentage(account.short_mv / account.total_assets) +
                    " of Total Assets"
                }
                icon={TrendingDown}
                trend="down"
            />

            <Card
                title="Total Fund Assets"
                value={formatCurrency(account.fund_assets)}
                subValue={
                    formatPercentage(
                        account.fund_assets / account.total_assets
                    ) + " of Total Assets"
                }
                icon={DollarSign}
            />

            <Card
                title="Total Bond Assets"
                value={formatCurrency(account.bond_assets)}
                subValue={
                    formatPercentage(
                        account.bond_assets / account.total_assets
                    ) + " of Total Assets"
                }
                icon={DollarSign}
            />

            <Card
                title="Total Cash Assets"
                value={formatCurrency(account.cash)}
                subValue={
                    formatPercentage(account.cash / account.total_assets) +
                    " of Total Assets"
                }
                icon={DollarSign}
            />

            <Card
                title="Maintenance Margin"
                value={formatCurrency(account.maintenance_margin)}
                subValue={`Initial Margin: ${formatCurrency(
                    account.initial_margin
                )}`}
                icon={Activity}
            />

            <Card
                title="Max Buying Power"
                value={formatCurrency(account.power)}
                subValue={`Max Shorting Power: ${formatCurrency(
                    account.max_power_short
                )}`}
                icon={Activity}
            />

            <Card
                title="Realized PL (Stocks)"
                value={formatCurrency(account.total_pl_realized_stocks)}
                numericValue={account.total_pl_realized_stocks}
                icon={DollarSign}
            />

            <Card
                title="Unrealized PL (Stocks)"
                value={formatCurrency(account.total_pl_unrealized_stocks)}
                numericValue={account.total_pl_unrealized_stocks}
                icon={DollarSign}
            />

            <Card
                title="Unrealized PL (Options)"
                value={formatCurrency(account.total_pl_unrealized_options)}
                numericValue={account.total_pl_unrealized_options}
                icon={DollarSign}
            />

            <Card
                title="Total PL"
                value={formatCurrency(account.total_pl_potential)}
                numericValue={account.total_pl_potential}
                subValue="Realized + Unrealized"
                icon={DollarSign}
            />
        </div>
    );
};

export default SummaryCard;
