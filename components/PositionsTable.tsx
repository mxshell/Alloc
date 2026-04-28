import React, { useEffect, useMemo, useState } from "react";
import {
    ArrowUpDown,
    Box,
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff,
    FileText,
    Layers,
    Search,
    Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PositionData, SortConfig } from "../types";
import {
    formatCurrency,
    formatPercent,
    formatPercentageOfPortfolio,
    truncateString,
} from "../utils/formatters";
import { isOptionCode, stripMarketPrefix } from "../utils/portfolio";

interface PositionsTableProps {
    positions: PositionData[];
}

type FilterType = "ALL" | "STOCK" | "OPTION";
type ColumnKey = keyof PositionData;
type ColumnVisibility = Partial<Record<ColumnKey, boolean>>;

interface ColumnConfig {
    key: ColumnKey;
    label: string;
    align?: "left" | "right";
    defaultVisible: boolean;
}

interface AssetFilterConfig {
    icon: LucideIcon;
    label: string;
    value: FilterType;
}

const STORAGE_KEY = "positions_table_column_visibility";

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

const ASSET_FILTERS: AssetFilterConfig[] = [
    { value: "ALL", label: "All", icon: Layers },
    { value: "STOCK", label: "Stocks", icon: Box },
    { value: "OPTION", label: "Options", icon: FileText },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const getDefaultColumnVisibility = () =>
    COLUMNS.reduce<ColumnVisibility>((visibility, column) => {
        visibility[column.key] = column.defaultVisible;
        return visibility;
    }, {});

const loadColumnVisibility = () => {
    const defaults = getDefaultColumnVisibility();

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return defaults;

        const parsed: unknown = JSON.parse(saved);
        if (!isRecord(parsed)) return defaults;

        return COLUMNS.reduce<ColumnVisibility>((visibility, column) => {
            const savedValue = parsed[column.key];
            visibility[column.key] =
                typeof savedValue === "boolean"
                    ? savedValue
                    : column.defaultVisible;
            return visibility;
        }, defaults);
    } catch (error) {
        console.error("Failed to load column visibility preferences", error);
        return defaults;
    }
};

const isColumnVisible = (column: ColumnConfig, visibility: ColumnVisibility) =>
    visibility[column.key] ?? column.defaultVisible;

const getComparableValue = (position: PositionData, key: ColumnKey) => {
    const value = position[key];

    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value === null || value === undefined) return "";

    return String(value).toLowerCase();
};

const comparePositions = (
    a: PositionData,
    b: PositionData,
    sortConfig: SortConfig,
) => {
    const aValue = getComparableValue(a, sortConfig.key);
    const bValue = getComparableValue(b, sortConfig.key);

    const comparison =
        typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue), undefined, {
                  numeric: true,
              });

    return sortConfig.direction === "asc" ? comparison : -comparison;
};

const signedValueClass = (value: number) =>
    value >= 0 ? "text-emerald-400" : "text-rose-400";

const SegmentButton: React.FC<{
    active: boolean;
    filter: AssetFilterConfig;
    onClick: (value: FilterType) => void;
}> = ({ active, filter, onClick }) => {
    const Icon = filter.icon;

    return (
        <button
            type="button"
            onClick={() => onClick(filter.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all sm:flex-none ${
                active
                    ? "bg-slate-700 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
            }`}
        >
            <Icon className="h-3.5 w-3.5" />
            {filter.label}
        </button>
    );
};

const HeaderCell: React.FC<{
    column: ColumnConfig;
    isVisible: boolean;
    onSort: (key: ColumnKey) => void;
    sortConfig: SortConfig;
}> = ({ column, isVisible, onSort, sortConfig }) => {
    if (!isVisible) return null;

    const align = column.align ?? "right";
    const alignClass = align === "right" ? "text-right" : "text-left";
    const isSorted = sortConfig.key === column.key;
    const SortIcon = isSorted
        ? sortConfig.direction === "asc"
            ? ChevronUp
            : ChevronDown
        : ArrowUpDown;

    return (
        <th
            className={`px-4 py-3 ${alignClass} text-xs font-semibold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-200`}
        >
            <button
                type="button"
                onClick={() => onSort(column.key)}
                className={`inline-flex items-center gap-1 ${
                    align === "right" ? "justify-end" : "justify-start"
                }`}
            >
                {column.label}
                <SortIcon
                    className={`h-3 w-3 ${isSorted ? "" : "opacity-30"}`}
                />
            </button>
        </th>
    );
};

const ColumnVisibilityMenu: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onToggleColumn: (key: ColumnKey) => void;
    onToggleMenu: () => void;
    visibility: ColumnVisibility;
}> = ({ isOpen, onClose, onToggleColumn, onToggleMenu, visibility }) => (
    <div className="relative">
        <button
            type="button"
            onClick={onToggleMenu}
            className="flex items-center justify-center rounded-lg border border-slate-600 bg-slate-900 p-2 text-slate-400 transition-all hover:border-slate-500 hover:text-slate-200"
            title="Column visibility"
            aria-label="Column visibility"
        >
            <Settings className="h-4 w-4" />
        </button>
        {isOpen && (
            <>
                <div className="fixed inset-0 z-10" onClick={onClose} />
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                    <div className="border-b border-slate-700 p-3">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
                            <Eye className="h-3.5 w-3.5" />
                            Column Visibility
                        </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {COLUMNS.map((column) => {
                            const visible = isColumnVisible(
                                column,
                                visibility,
                            );

                            return (
                                <button
                                    type="button"
                                    key={column.key}
                                    onClick={() => onToggleColumn(column.key)}
                                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-800"
                                >
                                    <span className="flex-1 text-sm text-slate-300">
                                        {column.label}
                                    </span>
                                    {visible ? (
                                        <Eye className="h-4 w-4 text-blue-400" />
                                    ) : (
                                        <EyeOff className="h-4 w-4 text-slate-600" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </>
        )}
    </div>
);

const SymbolCell: React.FC<{ position: PositionData }> = ({ position }) => {
    const isOption = isOptionCode(position.code);
    const Icon = isOption ? FileText : Box;

    return (
        <div className="flex items-center gap-2">
            <Icon
                className={`h-4 w-4 transition-colors ${
                    isOption
                        ? "text-purple-400/50 group-hover:text-purple-400"
                        : "text-blue-400/50 group-hover:text-blue-400"
                }`}
            />
            {isOption ? (
                <div className="text-sm font-medium text-white">
                    {position.stock_name}
                </div>
            ) : (
                <div>
                    <div className="text-sm font-medium text-white">
                        {stripMarketPrefix(position.code)}
                    </div>
                    <div className="text-xs text-slate-500">
                        {truncateString(position.stock_name)}
                    </div>
                </div>
            )}
        </div>
    );
};

const renderCell = (position: PositionData, column: ColumnConfig) => {
    switch (column.key) {
        case "code":
            return <SymbolCell position={position} />;
        case "position_side":
            return (
                <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                        position.position_side === "LONG"
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-purple-500/10 text-purple-400"
                    }`}
                >
                    {position.position_side}
                </span>
            );
        case "qty":
            return (
                <span className="text-sm text-slate-300">
                    {position.qty.toLocaleString()}
                </span>
            );
        case "average_cost":
            return (
                <span className="text-sm text-slate-300">
                    {formatCurrency(position.average_cost)}
                </span>
            );
        case "diluted_cost":
            return (
                <span className="text-sm text-slate-300">
                    {formatCurrency(position.diluted_cost)}
                </span>
            );
        case "nominal_price":
            return (
                <span className="text-sm text-slate-300">
                    {formatCurrency(position.nominal_price)}
                </span>
            );
        case "market_val":
            return (
                <span className="text-sm font-bold text-slate-100">
                    {formatCurrency(position.market_val)}
                </span>
            );
        case "percentage_of_portfolio":
            return (
                <span className="text-sm font-medium text-slate-300">
                    {formatPercentageOfPortfolio(
                        position.percentage_of_portfolio,
                    )}
                </span>
            );
        case "realized_pl":
            return (
                <span
                    className={`text-sm font-medium ${signedValueClass(position.realized_pl)}`}
                >
                    {formatCurrency(position.realized_pl)}
                </span>
            );
        case "unrealized_pl":
            return (
                <span
                    className={`text-sm font-medium ${signedValueClass(position.unrealized_pl)}`}
                >
                    {formatCurrency(position.unrealized_pl)}
                </span>
            );
        case "pl_ratio":
            return (
                <span
                    className={`text-sm font-medium ${signedValueClass(position.pl_ratio)}`}
                >
                    {formatPercent(position.pl_ratio)}
                </span>
            );
        default:
            return String(position[column.key] ?? "");
    }
};

const PositionsTable: React.FC<PositionsTableProps> = ({ positions }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>({
        key: "market_val",
        direction: "desc",
    });
    const [filterText, setFilterText] = useState("");
    const [assetFilter, setAssetFilter] = useState<FilterType>("ALL");
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [columnVisibility, setColumnVisibility] =
        useState<ColumnVisibility>(loadColumnVisibility);

    useEffect(() => {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(columnVisibility),
            );
        } catch (error) {
            console.error("Failed to save column visibility preferences", error);
        }
    }, [columnVisibility]);

    const visibleColumns = useMemo(
        () =>
            COLUMNS.filter((column) =>
                isColumnVisible(column, columnVisibility),
            ),
        [columnVisibility],
    );

    const filteredPositions = useMemo(() => {
        const searchTerm = filterText.trim().toLowerCase();

        return positions
            .filter((position) => {
                const matchesSearch =
                    !searchTerm ||
                    position.code.toLowerCase().includes(searchTerm) ||
                    position.stock_name.toLowerCase().includes(searchTerm);

                if (!matchesSearch) return false;
                if (assetFilter === "ALL") return true;

                const option = isOptionCode(position.code);
                return assetFilter === "OPTION" ? option : !option;
            })
            .sort((a, b) => comparePositions(a, b, sortConfig));
    }, [assetFilter, filterText, positions, sortConfig]);

    const handleSort = (key: ColumnKey) => {
        setSortConfig((current) => ({
            key,
            direction:
                current.key === key && current.direction === "desc"
                    ? "asc"
                    : "desc",
        }));
    };

    const toggleColumnVisibility = (key: ColumnKey) => {
        const column = COLUMNS.find((entry) => entry.key === key);
        setColumnVisibility((current) => ({
            ...current,
            [key]: !(current[key] ?? column?.defaultVisible ?? true),
        }));
    };

    return (
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-sm">
            <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-700 p-5 lg:flex-row">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                    Holdings
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-normal text-slate-500">
                        {filteredPositions.length}
                    </span>
                </h2>

                <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                    <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1">
                        {ASSET_FILTERS.map((filter) => (
                            <SegmentButton
                                key={filter.value}
                                active={assetFilter === filter.value}
                                filter={filter}
                                onClick={setAssetFilter}
                            />
                        ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <Search className="h-4 w-4 text-slate-500" />
                        </div>
                        <input
                            type="text"
                            className="block w-full rounded-lg border border-slate-600 bg-slate-900 p-2 pl-10 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Search symbol..."
                            value={filterText}
                            onChange={(event) =>
                                setFilterText(event.target.value)
                            }
                        />
                    </div>

                    <ColumnVisibilityMenu
                        isOpen={showColumnMenu}
                        onClose={() => setShowColumnMenu(false)}
                        onToggleColumn={toggleColumnVisibility}
                        onToggleMenu={() =>
                            setShowColumnMenu((current) => !current)
                        }
                        visibility={columnVisibility}
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-900/80">
                        <tr>
                            {COLUMNS.map((column) => (
                                <HeaderCell
                                    key={column.key}
                                    column={column}
                                    isVisible={isColumnVisible(
                                        column,
                                        columnVisibility,
                                    )}
                                    onSort={handleSort}
                                    sortConfig={sortConfig}
                                />
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700 bg-slate-800">
                        {filteredPositions.length > 0 ? (
                            filteredPositions.map((position, index) => (
                                <tr
                                    key={`${position.code}-${index}`}
                                    className="group transition-colors hover:bg-slate-700/50"
                                >
                                    {visibleColumns.map((column) => {
                                        const align =
                                            column.align === "left"
                                                ? "text-left"
                                                : "text-right";

                                        return (
                                            <td
                                                key={column.key}
                                                className={`whitespace-nowrap px-4 py-3 font-mono ${align}`}
                                            >
                                                {renderCell(position, column)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={Math.max(visibleColumns.length, 1)}
                                    className="px-4 py-12 text-center text-slate-500"
                                >
                                    No positions found matching your filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PositionsTable;
