import { AccountData, PositionData } from "../types";
import { applyPortfolioTotals, withPortfolioPercentages } from "./portfolio";

export {
    extractTicker,
    findPositionsByTicker,
    getAvailableTickers,
    validateTickers,
} from "./portfolio";
export {
    formatCurrency,
    formatPercent,
    formatPercentageOfPortfolio,
    truncateString,
} from "./formatters";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const parseNumber = (value: unknown): number => {
    if (value === "N/A" || value === null || value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value !== "string") return 0;

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const parseString = (value: unknown, fallback = "") =>
    typeof value === "string" && value.trim() ? value : fallback;

const parseStringOrNumber = (value: unknown): number | string => {
    if (value === "N/A" || value === null || value === undefined) {
        return "N/A";
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : "N/A";
    }

    if (typeof value !== "string") return "N/A";

    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : value;
};

const parseBoolean = (value: unknown) =>
    value === true || value === "True" || value === "true";

const parseLine = (line: string, headers: string[]) => {
    const values = line.split(",");
    const entry: Record<string, string> = {};

    headers.forEach((header, index) => {
        entry[header.trim()] = values[index]?.trim() ?? "";
    });

    return entry;
};

export const parseAccountData = (csvContent: string): AccountData | null => {
    try {
        const lines = csvContent.trim().split("\n");
        if (lines.length < 2) return null;

        const headers = lines[0].split(",");
        const rawData = parseLine(lines[1], headers);

        return {
            power: parseNumber(rawData.power),
            max_power_short: parseNumber(rawData.max_power_short),
            net_cash_power: parseNumber(rawData.net_cash_power),
            total_assets: parseNumber(rawData.total_assets),
            securities_assets: parseNumber(rawData.securities_assets),
            fund_assets: parseNumber(rawData.fund_assets),
            bond_assets: parseNumber(rawData.bond_assets),
            cash: parseNumber(rawData.cash),
            market_val: parseNumber(rawData.market_val),
            long_mv: parseNumber(rawData.long_mv),
            short_mv: parseNumber(rawData.short_mv),
            pending_asset: parseNumber(rawData.pending_asset),
            interest_charged_amount: parseNumber(
                rawData.interest_charged_amount,
            ),
            frozen_cash: parseNumber(rawData.frozen_cash),
            avl_withdrawal_cash: rawData.avl_withdrawal_cash,
            currency: parseString(rawData.currency, "USD"),
            unrealized_pl: rawData.unrealized_pl,
            realized_pl: rawData.realized_pl,
            risk_status: rawData.risk_status,
            initial_margin: parseNumber(rawData.initial_margin),
            maintenance_margin: parseNumber(rawData.maintenance_margin),
            total_pl_unrealized_options: 0,
            total_pl_unrealized_stocks: 0,
            total_pl_realized_stocks: 0,
            total_pl_potential: 0,
        };
    } catch (error) {
        console.error("Error parsing account data:", error);
        return null;
    }
};

export const parsePositionsData = (csvContent: string): PositionData[] => {
    try {
        const lines = csvContent.trim().split("\n");
        if (lines.length < 2) return [];

        const headers = lines[0].split(",");

        return lines.slice(1).flatMap((line) => {
            if (!line.trim()) return [];

            const raw = parseLine(line, headers);

            return {
                code: raw.code,
                stock_name: raw.stock_name,
                position_market: raw.position_market,
                qty: parseNumber(raw.qty),
                can_sell_qty: parseNumber(raw.can_sell_qty),
                cost_price: parseNumber(raw.cost_price),
                cost_price_valid: parseBoolean(raw.cost_price_valid),
                average_cost: parseNumber(raw.average_cost),
                diluted_cost: parseNumber(raw.diluted_cost),
                market_val: parseNumber(raw.market_val),
                nominal_price: parseNumber(raw.nominal_price),
                pl_ratio: parseNumber(raw.pl_ratio),
                pl_ratio_valid: parseBoolean(raw.pl_ratio_valid),
                pl_val: parseNumber(raw.pl_val),
                pl_val_valid: parseBoolean(raw.pl_val_valid),
                today_pl_val: parseNumber(raw.today_pl_val),
                position_side: raw.position_side,
                unrealized_pl: parseNumber(raw.unrealized_pl),
                realized_pl: parseNumber(raw.realized_pl),
                currency: parseString(raw.currency, "USD"),
                percentage_of_portfolio: null,
            };
        });
    } catch (error) {
        console.error("Error parsing positions data:", error);
        return [];
    }
};

export const parseAccountDataFromJSON = (
    jsonData: unknown,
): AccountData | null => {
    try {
        if (!isRecord(jsonData) || !isRecord(jsonData.account)) return null;

        const account = jsonData.account;

        return {
            power: parseNumber(account.power),
            max_power_short: parseNumber(account.max_power_short),
            net_cash_power: parseNumber(account.net_cash_power),
            total_assets: parseNumber(account.total_assets),
            securities_assets: parseNumber(account.securities_assets),
            fund_assets: parseNumber(account.fund_assets),
            bond_assets: parseNumber(account.bond_assets),
            cash: parseNumber(account.cash),
            market_val: parseNumber(account.market_val),
            long_mv: parseNumber(account.long_mv),
            short_mv: parseNumber(account.short_mv),
            pending_asset: parseNumber(account.pending_asset),
            interest_charged_amount: parseNumber(
                account.interest_charged_amount,
            ),
            frozen_cash: parseNumber(account.frozen_cash),
            avl_withdrawal_cash: parseStringOrNumber(
                account.avl_withdrawal_cash,
            ),
            currency: parseString(account.currency, "USD"),
            unrealized_pl: parseStringOrNumber(account.unrealized_pl),
            realized_pl: parseStringOrNumber(account.realized_pl),
            risk_status: parseString(account.risk_status),
            initial_margin: parseNumber(account.initial_margin),
            maintenance_margin: parseNumber(account.maintenance_margin),
            total_pl_unrealized_options: 0,
            total_pl_unrealized_stocks: 0,
            total_pl_realized_stocks: 0,
            total_pl_potential: 0,
        };
    } catch (error) {
        console.error("Error parsing account data from JSON:", error);
        return null;
    }
};

export const parsePositionsDataFromJSON = (
    jsonData: unknown,
): PositionData[] => {
    try {
        if (!isRecord(jsonData) || !Array.isArray(jsonData.positions)) {
            return [];
        }

        return jsonData.positions.flatMap((position) => {
            if (!isRecord(position)) return [];

            return {
                code: parseString(position.code),
                stock_name: parseString(position.stock_name),
                position_market: parseString(position.position_market),
                qty: parseNumber(position.qty),
                can_sell_qty: parseNumber(position.can_sell_qty),
                cost_price: parseNumber(position.cost_price),
                cost_price_valid: parseBoolean(position.cost_price_valid),
                average_cost: parseNumber(position.average_cost),
                diluted_cost: parseNumber(position.diluted_cost),
                market_val: parseNumber(position.market_val),
                nominal_price: parseNumber(position.nominal_price),
                pl_ratio: parseNumber(position.pl_ratio),
                pl_ratio_valid: parseBoolean(position.pl_ratio_valid),
                pl_val: parseNumber(position.pl_val),
                pl_val_valid: parseBoolean(position.pl_val_valid),
                today_pl_val: parseNumber(position.today_pl_val),
                position_side: parseString(position.position_side),
                unrealized_pl: parseNumber(position.unrealized_pl),
                realized_pl: parseNumber(position.realized_pl),
                currency: parseString(position.currency, "USD"),
                percentage_of_portfolio: null,
            };
        });
    } catch (error) {
        console.error("Error parsing positions data from JSON:", error);
        return [];
    }
};

export const parseJSONData = (
    jsonContent: string,
): { account: AccountData | null; positions: PositionData[] } => {
    try {
        const jsonData: unknown = JSON.parse(jsonContent);
        const parsedAccount = parseAccountDataFromJSON(jsonData);
        const parsedPositions = parsePositionsDataFromJSON(jsonData);

        if (!parsedAccount) {
            return { account: null, positions: parsedPositions };
        }

        const positions = withPortfolioPercentages(
            parsedPositions,
            parsedAccount.total_assets,
        );
        const account = applyPortfolioTotals(parsedAccount, positions);

        return { account, positions };
    } catch (error) {
        console.error("Error parsing JSON data:", error);
        return { account: null, positions: [] };
    }
};
