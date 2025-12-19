import { AccountData, PositionData } from '../types';

/**
 * Parses a single line of CSV into an object.
 * Handles simple comma separation. Does not handle complex quoted strings containing commas for simplicity,
 * but sufficient for the provided dataset format.
 */
const parseLine = (line: string, headers: string[]): Record<string, string> => {
  const values = line.split(',');
  const entry: Record<string, string> = {};
  
  headers.forEach((header, index) => {
    let value = values[index]?.trim();
    if (value === undefined) value = '';
    entry[header.trim()] = value;
  });
  
  return entry;
};

export const parseAccountData = (csvContent: string): AccountData | null => {
  try {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return null;

    const headers = lines[0].split(',');
    const dataLine = lines[1];
    const rawData = parseLine(dataLine, headers);

    // Map raw strings to typed object
    return {
      power: parseFloat(rawData.power),
      max_power_short: parseFloat(rawData.max_power_short),
      net_cash_power: parseFloat(rawData.net_cash_power),
      total_assets: parseFloat(rawData.total_assets),
      securities_assets: parseFloat(rawData.securities_assets),
      fund_assets: parseFloat(rawData.fund_assets),
      bond_assets: parseFloat(rawData.bond_assets),
      cash: parseFloat(rawData.cash),
      market_val: parseFloat(rawData.market_val),
      long_mv: parseFloat(rawData.long_mv),
      short_mv: parseFloat(rawData.short_mv),
      pending_asset: parseFloat(rawData.pending_asset),
      interest_charged_amount: parseFloat(rawData.interest_charged_amount),
      frozen_cash: parseFloat(rawData.frozen_cash),
      avl_withdrawal_cash: rawData.avl_withdrawal_cash,
      currency: rawData.currency,
      unrealized_pl: rawData.unrealized_pl,
      realized_pl: rawData.realized_pl,
      risk_status: rawData.risk_status,
      initial_margin: parseFloat(rawData.initial_margin),
      maintenance_margin: parseFloat(rawData.maintenance_margin),
      total_pl_unrealized_options: 0.0,
      total_pl_unrealized_stocks: 0.0,
      total_pl_realized_stocks: 0.0,
      total_pl_potential: 0.0,
    };
  } catch (error) {
    console.error("Error parsing account data:", error);
    return null;
  }
};

export const parsePositionsData = (csvContent: string): PositionData[] => {
  try {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const positions: PositionData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Special handling for the CSV provided: Some stock names might contain commas?
      // Looking at the data: "Vanguard S&P 500 ETF" - no commas.
      // "Schwab Strategic Tr Us Large-Cap Growth Etf" - no commas.
      // "Alphabet-A" - no commas.
      // The provided data seems safe for simple split by comma.
      
      // However, looking at line 1: US.TSLA280121P380000,TSLA 280121 380.00P...
      // Standard split is fine.
      
      const raw = parseLine(line, headers);

      positions.push({
        code: raw.code,
        stock_name: raw.stock_name,
        position_market: raw.position_market,
        qty: parseFloat(raw.qty),
        can_sell_qty: parseFloat(raw.can_sell_qty),
        cost_price: parseFloat(raw.cost_price),
        cost_price_valid: raw.cost_price_valid === 'True',
        average_cost: parseFloat(raw.average_cost),
        diluted_cost: parseFloat(raw.diluted_cost),
        market_val: parseFloat(raw.market_val),
        nominal_price: parseFloat(raw.nominal_price),
        pl_ratio: parseFloat(raw.pl_ratio),
        pl_ratio_valid: raw.pl_ratio_valid === 'True',
        pl_val: parseFloat(raw.pl_val),
        pl_val_valid: raw.pl_val_valid === 'True',
        today_pl_val: parseFloat(raw.today_pl_val),
        position_side: raw.position_side,
        unrealized_pl: parseFloat(raw.unrealized_pl),
        realized_pl: parseFloat(raw.realized_pl),
        currency: raw.currency,
        percentage_of_portfolio: null
      });
    }

    return positions;
  } catch (error) {
    console.error("Error parsing positions data:", error);
    return [];
  }
};

/**
 * Parses account data from JSON format.
 * The JSON structure has an "account" property containing account data.
 */
export const parseAccountDataFromJSON = (jsonData: any): AccountData | null => {
  try {
    if (!jsonData || !jsonData.account) {
      return null;
    }

    const account = jsonData.account;

    // Helper function to parse numeric values, handling "N/A" strings
    const parseNumber = (value: any): number => {
      if (value === 'N/A' || value === null || value === undefined) return 0;
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
      }
      return typeof value === 'number' ? value : 0;
    };

    // Helper function to handle string or number values that can be "N/A"
    const parseStringOrNumber = (value: any): number | string => {
      if (value === 'N/A' || value === null || value === undefined) return 'N/A';
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? value : parsed;
      }
      return typeof value === 'number' ? value : 'N/A';
    };

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
      interest_charged_amount: parseNumber(account.interest_charged_amount),
      frozen_cash: parseNumber(account.frozen_cash),
      avl_withdrawal_cash: parseStringOrNumber(account.avl_withdrawal_cash),
      currency: account.currency || 'USD',
      unrealized_pl: parseStringOrNumber(account.unrealized_pl),
      realized_pl: parseStringOrNumber(account.realized_pl),
      risk_status: account.risk_status || '',
      initial_margin: parseNumber(account.initial_margin),
      maintenance_margin: parseNumber(account.maintenance_margin),
      total_pl_unrealized_options: 0.0,
      total_pl_unrealized_stocks: 0.0,
      total_pl_realized_stocks: 0.0,
      total_pl_potential: 0.0,
    };
  } catch (error) {
    console.error("Error parsing account data from JSON:", error);
    return null;
  }
};

/**
 * Parses positions data from JSON format.
 * The JSON structure has a "positions" property containing an array of positions.
 */
export const parsePositionsDataFromJSON = (jsonData: any): PositionData[] => {
  try {
    if (!jsonData || !jsonData.positions || !Array.isArray(jsonData.positions)) {
      return [];
    }

    const positions: PositionData[] = [];

    for (const pos of jsonData.positions) {
      if (!pos) continue;

      positions.push({
        code: pos.code || '',
        stock_name: pos.stock_name || '',
        position_market: pos.position_market || '',
        qty: typeof pos.qty === 'number' ? pos.qty : parseFloat(pos.qty) || 0,
        can_sell_qty: typeof pos.can_sell_qty === 'number' ? pos.can_sell_qty : parseFloat(pos.can_sell_qty) || 0,
        cost_price: typeof pos.cost_price === 'number' ? pos.cost_price : parseFloat(pos.cost_price) || 0,
        cost_price_valid: typeof pos.cost_price_valid === 'boolean' ? pos.cost_price_valid : pos.cost_price_valid === true || pos.cost_price_valid === 'True',
        average_cost: typeof pos.average_cost === 'number' ? pos.average_cost : parseFloat(pos.average_cost) || 0,
        diluted_cost: typeof pos.diluted_cost === 'number' ? pos.diluted_cost : parseFloat(pos.diluted_cost) || 0,
        market_val: typeof pos.market_val === 'number' ? pos.market_val : parseFloat(pos.market_val) || 0,
        nominal_price: typeof pos.nominal_price === 'number' ? pos.nominal_price : parseFloat(pos.nominal_price) || 0,
        pl_ratio: typeof pos.pl_ratio === 'number' ? pos.pl_ratio : parseFloat(pos.pl_ratio) || 0,
        pl_ratio_valid: typeof pos.pl_ratio_valid === 'boolean' ? pos.pl_ratio_valid : pos.pl_ratio_valid === true || pos.pl_ratio_valid === 'True',
        pl_val: typeof pos.pl_val === 'number' ? pos.pl_val : parseFloat(pos.pl_val) || 0,
        pl_val_valid: typeof pos.pl_val_valid === 'boolean' ? pos.pl_val_valid : pos.pl_val_valid === true || pos.pl_val_valid === 'True',
        today_pl_val: typeof pos.today_pl_val === 'number' ? pos.today_pl_val : parseFloat(pos.today_pl_val) || 0,
        position_side: pos.position_side || '',
        unrealized_pl: typeof pos.unrealized_pl === 'number' ? pos.unrealized_pl : parseFloat(pos.unrealized_pl) || 0,
        realized_pl: typeof pos.realized_pl === 'number' ? pos.realized_pl : parseFloat(pos.realized_pl) || 0,
        currency: pos.currency || 'USD',
        percentage_of_portfolio: null
      });
    }

    return positions;
  } catch (error) {
    console.error("Error parsing positions data from JSON:", error);
    return [];
  }
};

/**
 * Parses a JSON string containing both account and positions data.
 * Returns an object with account and positions, or null if parsing fails.
 */
export const parseJSONData = (jsonContent: string): { account: AccountData | null; positions: PositionData[] } => {
  try {
    const jsonData = JSON.parse(jsonContent);
    const account = parseAccountDataFromJSON(jsonData);
    const positions = parsePositionsDataFromJSON(jsonData);
    const isOption = (code: string) => /[0-9]{6}[CP][0-9]+/.test(code);

    const totalAssets = account?.total_assets || 0;
    // calculate the percentage of the portfolio for each position
    positions.forEach(position => {
      position.percentage_of_portfolio = (position.market_val / totalAssets) * 100;
    });

    // calculate the total unrealized pl of all option positions
    const totalUnrealizedPlOptions = positions.filter(position => isOption(position.code)).reduce((acc, position) => acc + position.unrealized_pl, 0);
    // calculate the total unrealized pl of all stocks positions
    const totalUnrealizedPlStocks = positions.filter(position => !isOption(position.code)).reduce((acc, position) => acc + position.unrealized_pl, 0);
    // calculate the total realized pl of all stocks positions
    const totalRealizedPlStocks = positions.filter(position => !isOption(position.code)).reduce((acc, position) => acc + position.realized_pl, 0);
    // calculate total PL potential (unrealized + realized)
    const totalPlPotential = totalUnrealizedPlOptions + totalUnrealizedPlStocks + totalRealizedPlStocks;

    // store these values in the account object
    account.total_pl_potential = totalPlPotential;
    account.total_pl_unrealized_options = totalUnrealizedPlOptions;
    account.total_pl_unrealized_stocks = totalUnrealizedPlStocks;
    account.total_pl_realized_stocks = totalRealizedPlStocks;

    return { account, positions };
  } catch (error) {
    console.error("Error parsing JSON data:", error);
    return { account: null, positions: [] };
  }
};

export const formatCurrency = (amount: number | string, currency = 'USD') => {
  if (amount === 'N/A') return 'N/A';
  const val = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(val)) return 'N/A';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export const formatPercent = (val: number | undefined) => {
  if (val === undefined || val === null || isNaN(val)) return '0.00%';
  return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
};

export const formatPercentageOfPortfolio = (val: number | undefined) => {
  if (val === undefined || val === null || isNaN(val)) return '0.00%';
  return `${val.toFixed(1)}%`;
};

export const truncateString = (str: string, maxLength: number = 25) => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
};

/**
 * Extracts ticker symbol from position code.
 * Handles formats like "US.TSLA" -> "TSLA" or "TSLA" -> "TSLA"
 */
export const extractTicker = (code: string): string => {
  if (code.includes('.')) {
    return code.split('.')[1];
  }
  return code;
};

/**
 * Gets all unique tickers from positions array.
 */
export const getAvailableTickers = (positions: PositionData[]): string[] => {
  const tickers = new Set<string>();
  positions.forEach((pos) => {
    const ticker = extractTicker(pos.code);
    if (ticker) {
      tickers.add(ticker.toUpperCase());
    }
  });
  return Array.from(tickers).sort();
};

/**
 * Finds positions matching a ticker (case-insensitive).
 * Handles both full code and extracted ticker matching.
 */
export const findPositionsByTicker = (
  positions: PositionData[],
  ticker: string
): PositionData[] => {
  const upperTicker = ticker.toUpperCase();
  return positions.filter((pos) => {
    const extractedTicker = extractTicker(pos.code).toUpperCase();
    const fullCode = pos.code.toUpperCase();
    return extractedTicker === upperTicker || fullCode === upperTicker;
  });
};

/**
 * Validates that tickers exist in the positions array.
 * Returns array of valid tickers.
 */
export const validateTickers = (
  positions: PositionData[],
  tickers: string[]
): string[] => {
  const availableTickers = getAvailableTickers(positions);
  const availableSet = new Set(availableTickers);
  
  return tickers.filter((ticker) => {
    const upperTicker = ticker.toUpperCase().trim();
    return upperTicker && availableSet.has(upperTicker);
  });
};