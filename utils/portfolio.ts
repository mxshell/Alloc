import { AccountData, PositionData } from "../types";

const OPTION_CODE_PATTERN = /^[A-Z]+[0-9]{6}[CP][0-9]+$/i;

export interface PortfolioTotals {
    totalPlPotential: number;
    totalRealizedPlStocks: number;
    totalUnrealizedPlOptions: number;
    totalUnrealizedPlStocks: number;
}

export const stripMarketPrefix = (code: string) => {
    const dotIndex = code.indexOf(".");
    return dotIndex === -1 ? code : code.slice(dotIndex + 1);
};

export const extractTicker = (code: string) => stripMarketPrefix(code);

export const normalizeTicker = (ticker: string) =>
    ticker.toUpperCase().trim();

export const normalizeCodeForOptionCheck = (code: string) =>
    stripMarketPrefix(code).trim();

export const isOptionCode = (code: string) =>
    OPTION_CODE_PATTERN.test(normalizeCodeForOptionCheck(code));

export const getPositionMarketValue = (position: PositionData) => {
    const value = Math.abs(position.market_val);
    return Number.isFinite(value) ? value : 0;
};

export const calculatePortfolioTotals = (
    positions: PositionData[],
): PortfolioTotals => {
    return positions.reduce<PortfolioTotals>(
        (totals, position) => {
            if (isOptionCode(position.code)) {
                totals.totalUnrealizedPlOptions += position.unrealized_pl;
            } else {
                totals.totalUnrealizedPlStocks += position.unrealized_pl;
                totals.totalRealizedPlStocks += position.realized_pl;
            }

            totals.totalPlPotential =
                totals.totalUnrealizedPlOptions +
                totals.totalUnrealizedPlStocks +
                totals.totalRealizedPlStocks;

            return totals;
        },
        {
            totalPlPotential: 0,
            totalRealizedPlStocks: 0,
            totalUnrealizedPlOptions: 0,
            totalUnrealizedPlStocks: 0,
        },
    );
};

export const withPortfolioPercentages = (
    positions: PositionData[],
    totalAssets: number,
) =>
    positions.map((position) => ({
        ...position,
        percentage_of_portfolio:
            totalAssets > 0 ? (position.market_val / totalAssets) * 100 : 0,
    }));

export const applyPortfolioTotals = (
    account: AccountData,
    positions: PositionData[],
): AccountData => {
    const totals = calculatePortfolioTotals(positions);

    return {
        ...account,
        total_pl_potential: totals.totalPlPotential,
        total_pl_realized_stocks: totals.totalRealizedPlStocks,
        total_pl_unrealized_options: totals.totalUnrealizedPlOptions,
        total_pl_unrealized_stocks: totals.totalUnrealizedPlStocks,
    };
};

export const getAvailableTickers = (positions: PositionData[]) => {
    const tickers = new Set<string>();

    positions.forEach((position) => {
        const ticker = extractTicker(position.code);
        if (ticker) tickers.add(normalizeTicker(ticker));
    });

    return Array.from(tickers).sort();
};

export const findPositionsByTicker = (
    positions: PositionData[],
    ticker: string,
) => {
    const targetTicker = normalizeTicker(ticker);

    return positions.filter((position) => {
        const extractedTicker = normalizeTicker(extractTicker(position.code));
        const fullCode = normalizeTicker(position.code);
        return extractedTicker === targetTicker || fullCode === targetTicker;
    });
};

export const validateTickers = (
    positions: PositionData[],
    tickers: string[],
) => {
    const availableTickers = new Set(getAvailableTickers(positions));

    return tickers
        .map(normalizeTicker)
        .filter((ticker) => ticker && availableTickers.has(ticker));
};
