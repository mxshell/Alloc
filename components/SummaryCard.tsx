import React from "react";
import {
    Activity,
    DollarSign,
    TrendingDown,
    TrendingUp,
    Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AccountData } from "../types";
import { formatCurrency } from "../utils/formatters";

interface SummaryCardProps {
    account: AccountData;
}

interface MetricCardProps {
    icon: LucideIcon;
    numericValue?: number;
    subValue?: string;
    title: string;
    trend?: "up" | "down" | "neutral";
    value: string;
}

const trendLabelClass: Record<NonNullable<MetricCardProps["trend"]>, string> =
    {
        up: "bg-emerald-500/10 text-emerald-400",
        down: "bg-rose-500/10 text-rose-400",
        neutral: "bg-slate-700 text-slate-400",
    };

const trendLabelText: Record<NonNullable<MetricCardProps["trend"]>, string> = {
    up: "Long",
    down: "Short",
    neutral: "Neutral",
};

const formatAllocation = (value: number, totalAssets: number) => {
    if (!Number.isFinite(totalAssets) || totalAssets <= 0) {
        return "0.00% of Total Assets";
    }

    return `${((value / totalAssets) * 100).toFixed(2)}% of Total Assets`;
};

const MetricCard: React.FC<MetricCardProps> = ({
    icon: Icon,
    numericValue,
    subValue,
    title,
    trend,
    value,
}) => {
    const valueClass =
        numericValue === undefined
            ? "text-slate-100"
            : numericValue >= 0
              ? "text-emerald-400"
              : "text-rose-400";

    return (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="mb-2 flex items-start justify-between">
                <div className="rounded-lg bg-slate-700/50 p-2">
                    <Icon className="h-5 w-5 text-slate-400" />
                </div>
                {trend && (
                    <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${trendLabelClass[trend]}`}
                    >
                        {trendLabelText[trend]}
                    </span>
                )}
            </div>
            <h3 className="mb-1 text-sm font-medium text-slate-400">
                {title}
            </h3>
            <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
            {subValue && (
                <div className="mt-1 text-sm text-slate-500">{subValue}</div>
            )}
        </div>
    );
};

const SummaryCard: React.FC<SummaryCardProps> = ({ account }) => {
    const totalAssets = account.total_assets;
    const metrics: MetricCardProps[] = [
        {
            title: "Total Assets",
            value: formatCurrency(totalAssets),
            subValue: "Net Liquidation Value",
            icon: Wallet,
        },
        {
            title: "Market Value (Long Positions)",
            value: formatCurrency(account.long_mv),
            subValue: formatAllocation(account.long_mv, totalAssets),
            icon: TrendingUp,
            trend: "up",
        },
        {
            title: "Market Value (Short Positions)",
            value: formatCurrency(account.short_mv),
            subValue: formatAllocation(account.short_mv, totalAssets),
            icon: TrendingDown,
            trend: "down",
        },
        {
            title: "Total Fund Assets",
            value: formatCurrency(account.fund_assets),
            subValue: formatAllocation(account.fund_assets, totalAssets),
            icon: DollarSign,
        },
        {
            title: "Total Bond Assets",
            value: formatCurrency(account.bond_assets),
            subValue: formatAllocation(account.bond_assets, totalAssets),
            icon: DollarSign,
        },
        {
            title: "Total Cash Assets",
            value: formatCurrency(account.cash),
            subValue: formatAllocation(account.cash, totalAssets),
            icon: DollarSign,
        },
        {
            title: "Maintenance Margin",
            value: formatCurrency(account.maintenance_margin),
            subValue: `Initial Margin: ${formatCurrency(account.initial_margin)}`,
            icon: Activity,
        },
        {
            title: "Max Buying Power",
            value: formatCurrency(account.power),
            subValue: `Max Shorting Power: ${formatCurrency(account.max_power_short)}`,
            icon: Activity,
        },
        {
            title: "Realized PL (Stocks)",
            value: formatCurrency(account.total_pl_realized_stocks),
            numericValue: account.total_pl_realized_stocks,
            icon: DollarSign,
        },
        {
            title: "Unrealized PL (Stocks)",
            value: formatCurrency(account.total_pl_unrealized_stocks),
            numericValue: account.total_pl_unrealized_stocks,
            icon: DollarSign,
        },
        {
            title: "Unrealized PL (Options)",
            value: formatCurrency(account.total_pl_unrealized_options),
            numericValue: account.total_pl_unrealized_options,
            icon: DollarSign,
        },
        {
            title: "Total PL",
            value: formatCurrency(account.total_pl_potential),
            numericValue: account.total_pl_potential,
            subValue: "Realized + Unrealized",
            icon: DollarSign,
        },
    ];

    return (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
                <MetricCard key={metric.title} {...metric} />
            ))}
        </div>
    );
};

export default SummaryCard;
