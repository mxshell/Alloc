import React, { useState, useMemo, useEffect } from "react";
import {
    ArrowUpDown,
    ChevronUp,
    ChevronDown,
    Search,
    Layers,
    Box,
    FileText,
    Settings,
    Eye,
    EyeOff,
} from "lucide-react";
import { PositionData, SortConfig } from "../types";
import {
    formatCurrency,
    formatPercent,
    formatPercentageOfPortfolio,
    truncateString,
} from "../utils/dataParser";

interface PositionsTableProps {
    positions: PositionData[];
}

type FilterType = "ALL" | "STOCK" | "OPTION";

interface ColumnConfig {
    key: keyof PositionData;
    label: string;
    align?: "left" | "right";
    defaultVisible: boolean;
}

const COLUMNS: ColumnConfig[] = [
    { key: "code", label: "Symbol", align: "left", defaultVisible: true },
    {
        key: "position_side",
        label: "Side",
        align: "left",
        defaultVisible: true,
    },
    { key: "qty", label: "Qty", align: "right", defaultVisible: true },
    {
        key: "average_cost",
        label: "Avg Cost",
        align: "right",
        defaultVisible: false,
    },
    {
        key: "diluted_cost",
        label: "Diluted Cost",
        align: "right",
        defaultVisible: true,
    },
    {
        key: "nominal_price",
        label: "Price",
        align: "right",
        defaultVisible: true,
    },
    {
        key: "market_val",
        label: "Market Val",
        align: "right",
        defaultVisible: true,
    },
    {
        key: "percentage_of_portfolio",
        label: "% of Portfolio",
        align: "right",
        defaultVisible: true,
    },
    {
        key: "realized_pl",
        label: "Realized P/L",
        align: "right",
        defaultVisible: true,
    },
    {
        key: "unrealized_pl",
        label: "Unrealized P/L",
        align: "right",
        defaultVisible: true,
    },
    {
        key: "pl_ratio",
        label: "Total P/L %",
        align: "right",
        defaultVisible: true,
    },
];

const STORAGE_KEY = "positions_table_column_visibility";

const PositionsTable: React.FC<PositionsTableProps> = ({ positions }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        key: "market_val",
        direction: "desc",
    });
    const [filterText, setFilterText] = useState("");
    const [assetFilter, setAssetFilter] = useState<FilterType>("ALL");
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    // Initialize column visibility from localStorage or defaults
    const [columnVisibility, setColumnVisibility] = useState<
        Record<string, boolean>
    >(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to handle new columns
                const defaults = COLUMNS.reduce((acc, col) => {
                    acc[col.key] = col.defaultVisible;
                    return acc;
                }, {} as Record<string, boolean>);
                return { ...defaults, ...parsed };
            }
        } catch (e) {
            console.error("Failed to load column visibility preferences", e);
        }
        return COLUMNS.reduce((acc, col) => {
            acc[col.key] = col.defaultVisible;
            return acc;
        }, {} as Record<string, boolean>);
    });

    // Save to localStorage whenever visibility changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility));
        } catch (e) {
            console.error("Failed to save column visibility preferences", e);
        }
    }, [columnVisibility]);

    const toggleColumnVisibility = (key: string) => {
        setColumnVisibility((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleSort = (key: keyof PositionData) => {
        let direction: "asc" | "desc" = "desc";
        if (sortConfig.key === key && sortConfig.direction === "desc") {
            direction = "asc";
        }
        setSortConfig({ key, direction });
    };

    // Helper to determine if a position is an option based on the code format
    // Dataset format ex: US.TSLA280121P380000 (Symbol + Date + P/C + Strike)
    const isOption = (code: string) => /[0-9]{6}[CP][0-9]+/.test(code);

    const stripMarketPrefix = (code: string) => {
        if (code.startsWith("US.")) {
            return code.slice(3);
        }
        return code;
    };

    const sortedData = useMemo(() => {
        let filtered = positions;

        // 1. Text Search Filter
        if (filterText) {
            const lower = filterText.toLowerCase();
            filtered = filtered.filter(
                (p) =>
                    p.code.toLowerCase().includes(lower) ||
                    p.stock_name.toLowerCase().includes(lower)
            );
        }

        // 2. Asset Type Filter
        if (assetFilter !== "ALL") {
            filtered = filtered.filter((p) => {
                const isOpt = isOption(p.code);
                return assetFilter === "OPTION" ? isOpt : !isOpt;
            });
        }

        // 3. Sorting
        return [...filtered].sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue === bValue) return 0;

            const comparison = aValue > bValue ? 1 : -1;
            return sortConfig.direction === "asc" ? comparison : -comparison;
        });
    }, [positions, sortConfig, filterText, assetFilter]);

    const Th: React.FC<{
        label: string;
        sortKey: keyof PositionData;
        align?: "left" | "right";
    }> = ({ label, sortKey, align = "right" }) => {
        if (!columnVisibility[sortKey]) return null;
        return (
            <th
                className={`px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200 transition-colors text-${align}`}
                onClick={() => handleSort(sortKey)}
            >
                <div
                    className={`flex items-center gap-1 ${
                        align === "right" ? "justify-end" : "justify-start"
                    }`}
                >
                    {label}
                    {sortConfig.key === sortKey &&
                        (sortConfig.direction === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                        ) : (
                            <ChevronDown className="w-3 h-3" />
                        ))}
                    {sortConfig.key !== sortKey && (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                </div>
            </th>
        );
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-700 flex flex-col lg:flex-row justify-between items-center gap-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Holdings
                    <span className="text-xs font-normal text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-700">
                        {sortedData.length}
                    </span>
                </h2>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    {/* Asset Type Toggle */}
                    <div className="bg-slate-900 p-1 rounded-lg flex border border-slate-700">
                        <button
                            onClick={() => setAssetFilter("ALL")}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                                assetFilter === "ALL"
                                    ? "bg-slate-700 text-white shadow-sm"
                                    : "text-slate-400 hover:text-slate-200"
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            All
                        </button>
                        <button
                            onClick={() => setAssetFilter("STOCK")}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                                assetFilter === "STOCK"
                                    ? "bg-slate-700 text-white shadow-sm"
                                    : "text-slate-400 hover:text-slate-200"
                            }`}
                        >
                            <Box className="w-3.5 h-3.5" />
                            Stocks
                        </button>
                        <button
                            onClick={() => setAssetFilter("OPTION")}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                                assetFilter === "OPTION"
                                    ? "bg-slate-700 text-white shadow-sm"
                                    : "text-slate-400 hover:text-slate-200"
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Options
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-500" />
                        </div>
                        <input
                            type="text"
                            className="bg-slate-900 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2 placeholder-slate-500"
                            placeholder="Search symbol..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                        />
                    </div>

                    {/* Column Visibility Toggle */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColumnMenu(!showColumnMenu)}
                            className="bg-slate-900 border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 rounded-lg p-2 transition-all flex items-center justify-center"
                            title="Column visibility"
                        >
                            <Settings className="h-4 w-4" />
                        </button>
                        {showColumnMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowColumnMenu(false)}
                                />
                                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                                    <div className="p-3 border-b border-slate-700">
                                        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                            <Eye className="w-3.5 h-3.5" />
                                            Column Visibility
                                        </div>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {COLUMNS.map((column) => {
                                            const isVisible =
                                                columnVisibility[column.key] ??
                                                column.defaultVisible;
                                            return (
                                                <button
                                                    key={column.key}
                                                    onClick={() =>
                                                        toggleColumnVisibility(
                                                            column.key
                                                        )
                                                    }
                                                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 cursor-pointer transition-colors w-full text-left"
                                                >
                                                    <span className="text-sm text-slate-300 flex-1">
                                                        {column.label}
                                                    </span>
                                                    {isVisible ? (
                                                        <Eye className="w-4 h-4 text-blue-400" />
                                                    ) : (
                                                        <EyeOff className="w-4 h-4 text-slate-600" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-750">
                        <tr>
                            {COLUMNS.map((column) => (
                                <Th
                                    key={column.key}
                                    label={column.label}
                                    sortKey={column.key}
                                    align={column.align}
                                />
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700 bg-slate-800">
                        {sortedData.length > 0 ? (
                            sortedData.map((pos) => (
                                <tr
                                    key={pos.code}
                                    className="hover:bg-slate-700/50 transition-colors group"
                                >
                                    {COLUMNS.map((column) => {
                                        if (!columnVisibility[column.key])
                                            return null;

                                        const alignClass =
                                            column.align === "left"
                                                ? "text-left"
                                                : "text-right";

                                        // Render cell content based on column key
                                        let cellContent: React.ReactNode;
                                        let cellClassName = `px-4 py-3 whitespace-nowrap font-mono ${alignClass}`;

                                        switch (column.key) {
                                            case "code":
                                                cellContent = (
                                                    <div className="flex items-center gap-2">
                                                        {isOption(pos.code) ? (
                                                            <FileText className="w-4 h-4 text-purple-400/50 group-hover:text-purple-400 transition-colors" />
                                                        ) : (
                                                            <Box className="w-4 h-4 text-blue-400/50 group-hover:text-blue-400 transition-colors" />
                                                        )}
                                                        {isOption(pos.code) ? (
                                                            <div>
                                                                <div className="text-sm font-medium text-white">
                                                                    {
                                                                        pos.stock_name
                                                                    }
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <div className="text-sm font-medium text-white">
                                                                    {stripMarketPrefix(
                                                                        pos.code
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-slate-500">
                                                                    {truncateString(
                                                                        pos.stock_name
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                                cellClassName += " text-left";
                                                break;

                                            case "position_side":
                                                cellContent = (
                                                    <span
                                                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                            pos.position_side ===
                                                            "LONG"
                                                                ? "bg-blue-500/10 text-blue-400"
                                                                : "bg-purple-500/10 text-purple-400"
                                                        }`}
                                                    >
                                                        {pos.position_side}
                                                    </span>
                                                );
                                                cellClassName += " text-left";
                                                break;

                                            case "qty":
                                                cellContent = (
                                                    <span className="text-sm text-slate-300">
                                                        {pos.qty}
                                                    </span>
                                                );
                                                break;

                                            case "average_cost":
                                                cellContent = (
                                                    <span className="text-sm text-slate-300">
                                                        {formatCurrency(
                                                            pos.average_cost
                                                        )}
                                                    </span>
                                                );
                                                break;

                                            case "diluted_cost":
                                                cellContent = (
                                                    <span className="text-sm text-slate-300">
                                                        {formatCurrency(
                                                            pos.diluted_cost
                                                        )}
                                                    </span>
                                                );
                                                break;

                                            case "nominal_price":
                                                cellContent = (
                                                    <span className="text-sm text-slate-300">
                                                        {formatCurrency(
                                                            pos.nominal_price
                                                        )}
                                                    </span>
                                                );
                                                break;

                                            case "market_val":
                                                cellContent = (
                                                    <span className="text-sm font-bold text-slate-100">
                                                        {formatCurrency(
                                                            pos.market_val
                                                        )}
                                                    </span>
                                                );
                                                break;

                                            case "percentage_of_portfolio":
                                                cellContent = (
                                                    <span className="text-sm font-medium text-slate-300">
                                                        {formatPercentageOfPortfolio(
                                                            pos.percentage_of_portfolio
                                                        )}
                                                    </span>
                                                );
                                                break;

                                            case "realized_pl":
                                                cellContent = (
                                                    <span
                                                        className={`text-sm font-medium ${
                                                            pos.realized_pl >= 0
                                                                ? "text-emerald-400"
                                                                : "text-rose-400"
                                                        }`}
                                                    >
                                                        {formatCurrency(
                                                            pos.realized_pl
                                                        )}
                                                    </span>
                                                );
                                                break;

                                            case "unrealized_pl":
                                                cellContent = (
                                                    <span
                                                        className={`text-sm font-medium ${
                                                            pos.unrealized_pl >=
                                                            0
                                                                ? "text-emerald-400"
                                                                : "text-rose-400"
                                                        }`}
                                                    >
                                                        {formatCurrency(
                                                            pos.unrealized_pl
                                                        )}
                                                    </span>
                                                );
                                                break;

                                            case "pl_ratio":
                                                cellContent = (
                                                    <span
                                                        className={`text-sm font-medium ${
                                                            pos.pl_ratio >= 0
                                                                ? "text-emerald-400"
                                                                : "text-rose-400"
                                                        }`}
                                                    >
                                                        {formatPercent(
                                                            pos.pl_ratio
                                                        )}
                                                    </span>
                                                );
                                                break;

                                            default:
                                                cellContent = String(
                                                    pos[column.key] ?? ""
                                                );
                                        }

                                        return (
                                            <td
                                                key={column.key}
                                                className={cellClassName}
                                            >
                                                {cellContent}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={
                                        COLUMNS.filter(
                                            (col) => columnVisibility[col.key]
                                        ).length
                                    }
                                    className="px-4 py-12 text-center text-slate-500"
                                >
                                    No positions found matching your filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-700 bg-slate-800 text-xs text-slate-500 flex justify-between">
                {/* <span>Values in {positions[0]?.currency || "USD"}</span> */}
            </div>
        </div>
    );
};

export default PositionsTable;
