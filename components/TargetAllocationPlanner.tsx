import React, { useEffect, useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import type { AccountData, PositionData } from "../types";
import {
    formatCurrency,
    formatPercent,
    formatPercentageOfPortfolio,
} from "../utils/formatters";
import {
    buildLongStockHoldings,
    buildTargetAllocationRows,
    DEFAULT_TARGET_ALLOCATION_STATE,
    getLongStockTotal,
    getTargetBasisTotal,
    normalizeTargetTicker,
    summarizeTargetRows,
} from "../utils/targetAllocation";
import type {
    TargetAllocationBasis,
    TargetAllocationEntry,
    TargetAllocationState,
} from "../utils/targetAllocation";

interface TargetAllocationPlannerProps {
    account: AccountData;
    positions: PositionData[];
}

const STORAGE_KEY = "Alloc_target_allocation_planner";
const BASIS_OPTIONS: Array<{ label: string; value: TargetAllocationBasis }> = [
    { label: "Long Positions Total", value: "LONG_POSITIONS_TOTAL" },
    { label: "Net Total Assets", value: "NET_TOTAL_ASSETS" },
];
const TABLE_HEADERS = [
    { align: "left", label: "Ticker" },
    { align: "right", label: "Current" },
    { align: "right", label: "Target %" },
    { align: "right", label: "Drift" },
    { align: "right", label: "Trade Value" },
    { align: "right", label: "Shares" },
    { align: "right", label: "Price" },
    { align: "right", label: "Action" },
] as const;
const HEADER_CELL_CLASS =
    "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400";

const numberFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const parseStoredEntry = (value: unknown): TargetAllocationEntry | null => {
    if (!isRecord(value)) return null;

    const targetPercent =
        typeof value.targetPercent === "number" &&
        Number.isFinite(value.targetPercent)
            ? value.targetPercent
            : null;
    const priceOverride =
        typeof value.priceOverride === "number" &&
        Number.isFinite(value.priceOverride)
            ? value.priceOverride
            : null;

    return { priceOverride, targetPercent };
};

const loadState = (): TargetAllocationState => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_TARGET_ALLOCATION_STATE;

        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return DEFAULT_TARGET_ALLOCATION_STATE;

        const basis =
            parsed.basis === "NET_TOTAL_ASSETS" ||
            parsed.basis === "LONG_POSITIONS_TOTAL"
                ? parsed.basis
                : DEFAULT_TARGET_ALLOCATION_STATE.basis;
        const entries: Record<string, TargetAllocationEntry> = {};

        if (isRecord(parsed.entries)) {
            Object.entries(parsed.entries).forEach(([ticker, entry]) => {
                const normalizedTicker = normalizeTargetTicker(ticker);
                const parsedEntry = parseStoredEntry(entry);
                if (!normalizedTicker || !parsedEntry) return;
                entries[normalizedTicker] = parsedEntry;
            });
        }

        return { basis, entries };
    } catch (error) {
        console.error("Failed to load target allocation state", error);
        return DEFAULT_TARGET_ALLOCATION_STATE;
    }
};

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

const parsePositiveNumberInput = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const targetInputValue = (value: number | null) =>
    value === null ? "" : String(Number(value.toFixed(2)));

const getDriftLabel = (driftPercent: number | null) => {
    if (driftPercent === null) return "No target";
    if (Math.abs(driftPercent) < 0.01) return "On target";
    return driftPercent > 0 ? "Under target" : "Over target";
};

const getActionLabel = (tradeValue: number | null) => {
    if (tradeValue === null) return "No target";
    if (Math.abs(tradeValue) < 1) return "Hold";
    return tradeValue > 0 ? "Buy" : "Sell";
};

const getActionClass = (tradeValue: number | null) => {
    if (tradeValue === null || Math.abs(tradeValue) < 1) {
        return "border-slate-600 bg-slate-700/70 text-slate-300";
    }

    return tradeValue > 0
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
        : "border-rose-500/30 bg-rose-500/10 text-rose-300";
};

const TargetAllocationPlanner: React.FC<TargetAllocationPlannerProps> = ({
    account,
    positions,
}) => {
    const [plannerState, setPlannerState] =
        useState<TargetAllocationState>(loadState);
    const [newTicker, setNewTicker] = useState("");

    const holdings = useMemo(
        () => buildLongStockHoldings(positions),
        [positions],
    );
    const longStockTotal = useMemo(() => getLongStockTotal(holdings), [holdings]);
    const basisTotal = getTargetBasisTotal(
        plannerState.basis,
        account,
        longStockTotal,
    );
    const rows = useMemo(
        () =>
            buildTargetAllocationRows({
                basisTotal,
                entries: plannerState.entries,
                holdings,
            }).sort((a, b) => {
                const aHasTarget = a.targetPercent !== null;
                const bHasTarget = b.targetPercent !== null;
                if (aHasTarget !== bHasTarget) return bHasTarget ? 1 : -1;

                const driftDiff =
                    Math.abs(b.tradeValue ?? 0) - Math.abs(a.tradeValue ?? 0);
                if (driftDiff !== 0) return driftDiff;

                return (
                    b.currentValue - a.currentValue ||
                    a.ticker.localeCompare(b.ticker)
                );
            }),
        [basisTotal, holdings, plannerState.entries],
    );
    const summary = useMemo(() => summarizeTargetRows(rows), [rows]);
    const holdingTickerSet = useMemo(
        () => new Set(holdings.map((holding) => holding.ticker)),
        [holdings],
    );

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(plannerState));
        } catch (error) {
            console.error("Failed to save target allocation state", error);
        }
    }, [plannerState]);

    const updateEntry = (
        ticker: string,
        updater: (entry: TargetAllocationEntry) => TargetAllocationEntry,
    ) => {
        setPlannerState((current) => {
            const normalizedTicker = normalizeTargetTicker(ticker);
            if (!normalizedTicker) return current;

            return {
                ...current,
                entries: {
                    ...current.entries,
                    [normalizedTicker]: updater(
                        current.entries[normalizedTicker] ?? {
                            priceOverride: null,
                            targetPercent: null,
                        },
                    ),
                },
            };
        });
    };

    const setBasis = (basis: TargetAllocationBasis) => {
        setPlannerState((current) => ({ ...current, basis }));
    };

    const setTargetPercent = (ticker: string, value: string) => {
        const parsed = parsePositiveNumberInput(value);
        updateEntry(ticker, (entry) => ({
            ...entry,
            targetPercent: parsed === null ? null : clampPercent(parsed),
        }));
    };

    const setManualPrice = (ticker: string, value: string) => {
        const parsed = parsePositiveNumberInput(value);
        updateEntry(ticker, (entry) => ({
            ...entry,
            priceOverride: parsed,
        }));
    };

    const clearTicker = (ticker: string) => {
        const normalizedTicker = normalizeTargetTicker(ticker);
        if (!normalizedTicker) return;

        setPlannerState((current) => {
            const { [normalizedTicker]: _removed, ...entries } =
                current.entries;
            return { ...current, entries };
        });
    };

    const addTicker = () => {
        const ticker = normalizeTargetTicker(newTicker);
        if (!ticker) return;

        updateEntry(ticker, (entry) => entry);
        setNewTicker("");
    };

    return (
        <div className="mb-8 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-sm">
            <div className="border-b border-slate-700 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">
                            Target Allocation Planner
                        </h2>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-slate-600 bg-slate-900 px-2.5 py-1 text-slate-300">
                                Basis: {formatCurrency(basisTotal)}
                            </span>
                            <span
                                className={`rounded-full border px-2.5 py-1 ${
                                    summary.targetPercent > 100
                                        ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                        : "border-blue-500/30 bg-blue-500/10 text-blue-200"
                                }`}
                            >
                                Target total:{" "}
                                {formatPercentageOfPortfolio(
                                    summary.targetPercent,
                                )}
                            </span>
                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                                Buy: {formatCurrency(summary.buyValue)}
                            </span>
                            <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-rose-200">
                                Sell: {formatCurrency(summary.sellValue)}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1">
                            {BASIS_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setBasis(option.value)}
                                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                                        plannerState.basis === option.value
                                            ? "bg-slate-700 text-white shadow-sm"
                                            : "text-slate-400 hover:text-slate-200"
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input
                                value={newTicker}
                                onChange={(event) =>
                                    setNewTicker(
                                        normalizeTargetTicker(
                                            event.target.value,
                                        ),
                                    )
                                }
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        addTicker();
                                    }
                                }}
                                placeholder="Add ticker"
                                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 sm:w-40"
                            />
                            <button
                                type="button"
                                onClick={addTicker}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                                title="Add ticker"
                            >
                                <Plus className="h-4 w-4" />
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-900/80">
                        <tr>
                            {TABLE_HEADERS.map((header) => (
                                <th
                                    key={header.label}
                                    className={`${HEADER_CELL_CLASS} ${
                                        header.align === "right"
                                            ? "text-right"
                                            : "text-left"
                                    }`}
                                >
                                    {header.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {rows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={8}
                                    className="px-4 py-10 text-center text-sm text-slate-500"
                                >
                                    No long stock positions available.
                                </td>
                            </tr>
                        )}
                        {rows.map((row) => {
                            const hasHolding = Boolean(row.holding);
                            const entry = plannerState.entries[row.ticker];
                            const action = getActionLabel(row.tradeValue);
                            const priceInputValue =
                                entry?.priceOverride === null ||
                                entry?.priceOverride === undefined
                                    ? ""
                                    : String(entry.priceOverride);

                            return (
                                <tr
                                    key={row.ticker}
                                    className="transition-colors hover:bg-slate-700/35"
                                >
                                    <td className="px-4 py-3 align-top">
                                        <div className="font-mono text-sm font-semibold text-white">
                                            {row.ticker}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            {row.holding?.stockName ?? "Not held"}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right align-top font-mono">
                                        <div className="text-sm font-medium text-slate-200">
                                            {formatPercentageOfPortfolio(
                                                row.currentPercent,
                                            )}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            {formatCurrency(row.currentValue)}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            {numberFormatter.format(
                                                row.holding?.qty ?? 0,
                                            )}{" "}
                                            sh
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right align-top">
                                        <div className="relative inline-flex w-28 items-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.1"
                                                value={targetInputValue(
                                                    row.targetPercent,
                                                )}
                                                onChange={(event) =>
                                                    setTargetPercent(
                                                        row.ticker,
                                                        event.target.value,
                                                    )
                                                }
                                                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 pr-7 text-right font-mono text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                                            />
                                            <span className="pointer-events-none absolute right-2 text-xs text-slate-500">
                                                %
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right align-top font-mono">
                                        <div
                                            className={`text-sm font-semibold ${
                                                row.driftPercent === null ||
                                                Math.abs(row.driftPercent) < 0.01
                                                    ? "text-slate-400"
                                                    : row.driftPercent > 0
                                                      ? "text-emerald-300"
                                                      : "text-rose-300"
                                            }`}
                                        >
                                            {row.driftPercent === null
                                                ? "--"
                                                : formatPercent(row.driftPercent)}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            {getDriftLabel(row.driftPercent)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right align-top font-mono">
                                        <div
                                            className={`text-sm font-semibold ${
                                                row.tradeValue === null ||
                                                Math.abs(row.tradeValue) < 1
                                                    ? "text-slate-300"
                                                    : row.tradeValue > 0
                                                      ? "text-emerald-300"
                                                      : "text-rose-300"
                                            }`}
                                        >
                                            {row.tradeValue === null
                                                ? "--"
                                                : formatCurrency(
                                                      Math.abs(row.tradeValue),
                                                  )}
                                        </div>
                                        {row.targetValue !== null && (
                                            <div className="mt-1 text-xs text-slate-500">
                                                Target{" "}
                                                {formatCurrency(row.targetValue)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right align-top font-mono">
                                        <div className="text-sm font-semibold text-slate-200">
                                            {row.tradeShares === null
                                                ? row.tradeValue === null
                                                    ? "--"
                                                    : "Set price"
                                                : `${action} ${numberFormatter.format(
                                                      Math.abs(row.tradeShares),
                                                  )}`}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right align-top">
                                        {hasHolding ? (
                                            <div className="font-mono text-sm text-slate-300">
                                                {formatCurrency(row.price)}
                                            </div>
                                        ) : (
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={priceInputValue}
                                                onChange={(event) =>
                                                    setManualPrice(
                                                        row.ticker,
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Price"
                                                className="w-28 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-right font-mono text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                                            />
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right align-top">
                                        <div className="flex justify-end gap-2">
                                            <span
                                                className={`inline-flex min-w-16 justify-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getActionClass(
                                                    row.tradeValue,
                                                )}`}
                                            >
                                                {action}
                                            </span>
                                            {(entry ||
                                                !holdingTickerSet.has(
                                                    row.ticker,
                                                )) && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        clearTicker(row.ticker)
                                                    }
                                                    className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-700 hover:text-slate-200"
                                                    title={
                                                        hasHolding
                                                            ? "Clear target"
                                                            : "Remove ticker"
                                                    }
                                                >
                                                    {hasHolding ? (
                                                        <RotateCcw className="h-4 w-4" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TargetAllocationPlanner;
