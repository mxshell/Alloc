const currencyFormatters = new Map<string, Intl.NumberFormat>();
const compactCurrencyFormatters = new Map<string, Intl.NumberFormat>();

type NumericLike = number | string | null | undefined;

const toFiniteNumber = (value: NumericLike): number | null => {
    if (value === null || value === undefined || value === "N/A") return null;

    const numericValue =
        typeof value === "number" ? value : Number.parseFloat(value);

    return Number.isFinite(numericValue) ? numericValue : null;
};

const getCurrencyFormatter = (currency: string) => {
    const key = currency || "USD";
    const cached = currencyFormatters.get(key);
    if (cached) return cached;

    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: key,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    currencyFormatters.set(key, formatter);
    return formatter;
};

const getCompactCurrencyFormatter = (currency: string) => {
    const key = currency || "USD";
    const cached = compactCurrencyFormatters.get(key);
    if (cached) return cached;

    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: key,
        notation: "compact",
        maximumFractionDigits: 1,
    });

    compactCurrencyFormatters.set(key, formatter);
    return formatter;
};

export const formatCurrency = (amount: NumericLike, currency = "USD") => {
    const value = toFiniteNumber(amount);
    return value === null ? "N/A" : getCurrencyFormatter(currency).format(value);
};

export const formatCompactCurrency = (
    amount: NumericLike,
    currency = "USD",
) => {
    const value = toFiniteNumber(amount);
    return value === null || value === 0
        ? "$0"
        : getCompactCurrencyFormatter(currency).format(value);
};

export const formatPercent = (value: number | null | undefined) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
        return "0.00%";
    }

    return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
};

export const formatPercentageOfPortfolio = (
    value: number | null | undefined,
) => {
    if (value === undefined || value === null || Number.isNaN(value)) {
        return "0.0%";
    }

    return `${value.toFixed(1)}%`;
};

export const truncateString = (value: string, maxLength = 25) => {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}...`;
};
