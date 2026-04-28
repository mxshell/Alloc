import type { AccountData, PositionData } from "../types";
import {
    extractTicker,
    getPositionMarketValue,
    isOptionCode,
    normalizeTicker,
} from "./portfolio";

export type TargetAllocationBasis = "NET_TOTAL_ASSETS" | "LONG_POSITIONS_TOTAL";

export interface TargetAllocationEntry {
    priceOverride: number | null;
    targetPercent: number | null;
}

export interface TargetAllocationState {
    basis: TargetAllocationBasis;
    entries: Record<string, TargetAllocationEntry>;
}

export interface LongStockHolding {
    currency: string;
    marketValue: number;
    price: number;
    qty: number;
    stockName: string;
    ticker: string;
}

export interface TargetAllocationRow {
    currentPercent: number;
    currentValue: number;
    driftPercent: number | null;
    holding: LongStockHolding | null;
    price: number | null;
    targetPercent: number | null;
    targetValue: number | null;
    ticker: string;
    tradeShares: number | null;
    tradeValue: number | null;
}

export const DEFAULT_TARGET_ALLOCATION_STATE: TargetAllocationState = {
    basis: "LONG_POSITIONS_TOTAL",
    entries: {},
};

export const isLongStockPosition = (position: PositionData) =>
    !isOptionCode(position.code) &&
    String(position.position_side).toUpperCase() === "LONG";

export const buildLongStockHoldings = (positions: PositionData[]) => {
    const holdingsByTicker = new Map<string, LongStockHolding>();

    positions.filter(isLongStockPosition).forEach((position) => {
        const ticker = normalizeTicker(extractTicker(position.code));
        if (!ticker) return;

        const marketValue = getPositionMarketValue(position);
        const existing = holdingsByTicker.get(ticker);

        if (!existing) {
            holdingsByTicker.set(ticker, {
                currency: position.currency || "USD",
                marketValue,
                price: position.nominal_price,
                qty: position.qty,
                stockName: position.stock_name || ticker,
                ticker,
            });
            return;
        }

        existing.marketValue += marketValue;
        existing.qty += position.qty;
        existing.price =
            existing.qty > 0
                ? existing.marketValue / existing.qty
                : position.nominal_price;
    });

    return Array.from(holdingsByTicker.values()).sort(
        (a, b) =>
            b.marketValue - a.marketValue || a.ticker.localeCompare(b.ticker),
    );
};

export const getLongStockTotal = (holdings: LongStockHolding[]) =>
    holdings.reduce((total, holding) => total + holding.marketValue, 0);

export const getTargetBasisTotal = (
    basis: TargetAllocationBasis,
    account: AccountData,
    longStockTotal: number,
) => (basis === "NET_TOTAL_ASSETS" ? account.total_assets : longStockTotal);

export const buildTargetAllocationRows = ({
    basisTotal,
    entries,
    holdings,
}: {
    basisTotal: number;
    entries: Record<string, TargetAllocationEntry>;
    holdings: LongStockHolding[];
}) => {
    const holdingsByTicker = new Map(
        holdings.map((holding) => [holding.ticker, holding]),
    );
    const tickers = Array.from(
        new Set([...holdingsByTicker.keys(), ...Object.keys(entries)]),
    ).sort((a, b) => {
        const aHolding = holdingsByTicker.get(a);
        const bHolding = holdingsByTicker.get(b);
        const valueDiff =
            (bHolding?.marketValue || 0) - (aHolding?.marketValue || 0);
        return valueDiff || a.localeCompare(b);
    });

    return tickers.map<TargetAllocationRow>((ticker) => {
        const holding = holdingsByTicker.get(ticker) ?? null;
        const entry = entries[ticker];
        const currentValue = holding?.marketValue ?? 0;
        const currentPercent =
            basisTotal > 0 ? (currentValue / basisTotal) * 100 : 0;
        const targetPercent = entry?.targetPercent ?? null;
        const targetValue =
            targetPercent === null ? null : (basisTotal * targetPercent) / 100;
        const tradeValue =
            targetValue === null ? null : targetValue - currentValue;
        const price = holding?.price || entry?.priceOverride || null;

        return {
            currentPercent,
            currentValue,
            driftPercent:
                targetPercent === null ? null : targetPercent - currentPercent,
            holding,
            price,
            targetPercent,
            targetValue,
            ticker,
            tradeShares:
                tradeValue !== null && price && price > 0
                    ? tradeValue / price
                    : null,
            tradeValue,
        };
    });
};

export const summarizeTargetRows = (rows: TargetAllocationRow[]) => {
    return rows.reduce(
        (summary, row) => {
            if (row.targetPercent !== null) {
                summary.targetPercent += row.targetPercent;
            }

            if (row.tradeValue !== null) {
                if (row.tradeValue > 0) {
                    summary.buyValue += row.tradeValue;
                } else if (row.tradeValue < 0) {
                    summary.sellValue += Math.abs(row.tradeValue);
                }
            }

            return summary;
        },
        { buyValue: 0, sellValue: 0, targetPercent: 0 },
    );
};

export const normalizeTargetTicker = (ticker: string) =>
    normalizeTicker(ticker).replace(/[^A-Z0-9.-]/g, "");
