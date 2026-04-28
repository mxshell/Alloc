import type { CategoricalGroup, PositionData } from "../types";
import {
    formatCompactCurrency,
    formatPercentageOfPortfolio,
} from "./formatters";
import {
    extractTicker,
    getPositionMarketValue,
    isOptionCode,
    normalizeTicker,
} from "./portfolio";

export interface CategoryRowStats {
    marketValue: number;
    percentageOfPortfolio: number;
}

export const uniqueTickers = (tickers: string[]) => {
    const seen = new Set<string>();
    const result: string[] = [];

    tickers.forEach((ticker) => {
        const normalized = normalizeTicker(ticker);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        result.push(normalized);
    });

    return result;
};

export const buildTickerValueMap = (positions: PositionData[]) => {
    const map = new Map<string, number>();

    positions.forEach((position) => {
        if (isOptionCode(position.code)) return;

        const ticker = normalizeTicker(extractTicker(position.code));
        if (!ticker) return;

        const value = getPositionMarketValue(position);
        map.set(ticker, (map.get(ticker) || 0) + value);
    });

    return map;
};

export const formatTickerRelativeText = (
    value: number,
    rowTotalValue: number,
) => {
    const categoryPercentage =
        rowTotalValue > 0 ? (value / rowTotalValue) * 100 : 0;

    return `${formatCompactCurrency(value)} - Cat. ${formatPercentageOfPortfolio(
        categoryPercentage,
    )}`;
};

export const areIdListsEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id, index) => id === b[index]);

export const sanitizeGroups = (input: unknown[]): CategoricalGroup[] => {
    const seen = new Set<string>();

    return input
        .filter(
            (
                entry,
            ): entry is { id?: unknown; name: string; tickers?: unknown[] } =>
                Boolean(entry) &&
                typeof entry === "object" &&
                typeof (entry as { name?: unknown }).name === "string",
        )
        .map((entry, index) => {
            const cleanTickers = uniqueTickers(
                Array.isArray(entry.tickers)
                    ? entry.tickers.map((ticker) => String(ticker))
                    : [],
            ).filter((ticker) => {
                if (seen.has(ticker)) return false;
                seen.add(ticker);
                return true;
            });

            return {
                id: String(entry.id || `category_${Date.now()}_${index}`),
                name: String(entry.name || `Category ${index + 1}`).trim(),
                tickers: cleanTickers,
            };
        })
        .filter((group) => group.name.length > 0);
};
