import { AccountData, PositionData } from '../types';

// Sample stock names and codes for realistic demo data
const SAMPLE_STOCKS = [
  { code: 'US.AAPL', name: 'Apple Inc.' },
  { code: 'US.MSFT', name: 'Microsoft Corporation' },
  { code: 'US.GOOGL', name: 'Alphabet Inc.' },
  { code: 'US.AMZN', name: 'Amazon.com Inc.' },
  { code: 'US.TSLA', name: 'Tesla Inc.' },
  { code: 'US.NVDA', name: 'NVIDIA Corporation' },
  { code: 'US.META', name: 'Meta Platforms Inc.' },
  { code: 'US.NFLX', name: 'Netflix Inc.' },
  { code: 'US.BRK.B', name: 'Berkshire Hathaway Inc.' },
  { code: 'US.JPM', name: 'JPMorgan Chase & Co.' },
  { code: 'US.V', name: 'Visa Inc.' },
  { code: 'US.JNJ', name: 'Johnson & Johnson' },
  { code: 'US.WMT', name: 'Walmart Inc.' },
  { code: 'US.MA', name: 'Mastercard Incorporated' },
  { code: 'US.PG', name: 'Procter & Gamble Co.' },
];

const SAMPLE_ETFS = [
  { code: 'US.SPY', name: 'SPDR S&P 500 ETF Trust' },
  { code: 'US.QQQ', name: 'Invesco QQQ Trust' },
  { code: 'US.VOO', name: 'Vanguard S&P 500 ETF' },
  { code: 'US.VTI', name: 'Vanguard Total Stock Market ETF' },
  { code: 'US.IWM', name: 'iShares Russell 2000 ETF' },
];

const OPTION_CODES = [
  'US.AAPL240119C150000',
  'US.TSLA240119P250000',
  'US.MSFT240119C400000',
  'US.NVDA240119C500000',
];

/**
 * Generates a random number between min and max (inclusive)
 */
const random = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Generates a random float between min and max
 */
const randomFloat = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

/**
 * Generates random demo account data
 */
export const generateDemoAccountData = (): AccountData => {
  const totalAssets = randomFloat(500000, 2000000);
  const cash = randomFloat(50000, 200000);
  const securitiesAssets = totalAssets - cash;
  const marketVal = randomFloat(securitiesAssets * 0.8, securitiesAssets * 1.2);
  const longMv = marketVal * randomFloat(0.7, 0.95);
  const shortMv = marketVal - longMv;
  
  const unrealizedPl = randomFloat(-50000, 100000);
  const realizedPl = randomFloat(-20000, 50000);
  
  return {
    power: randomFloat(100000, 500000),
    max_power_short: randomFloat(50000, 200000),
    net_cash_power: randomFloat(80000, 400000),
    total_assets: totalAssets,
    securities_assets: securitiesAssets,
    fund_assets: randomFloat(100000, 500000),
    bond_assets: randomFloat(50000, 200000),
    cash: cash,
    market_val: marketVal,
    long_mv: longMv,
    short_mv: shortMv,
    pending_asset: randomFloat(0, 10000),
    interest_charged_amount: randomFloat(0, 5000),
    frozen_cash: randomFloat(0, 10000),
    avl_withdrawal_cash: cash * randomFloat(0.7, 0.95),
    currency: 'USD',
    unrealized_pl: unrealizedPl,
    realized_pl: realizedPl,
    risk_status: ['NORMAL', 'WARNING', 'RISKY'][random(0, 2)],
    initial_margin: randomFloat(50000, 200000),
    maintenance_margin: randomFloat(30000, 150000),
    total_pl_unrealized_options: 0,
    total_pl_unrealized_stocks: 0,
    total_pl_realized_stocks: 0,
    total_pl_potential: 0,
  };
};

/**
 * Generates random demo positions data
 */
export const generateDemoPositionsData = (accountData: AccountData): PositionData[] => {
  const positions: PositionData[] = [];
  const numPositions = random(8, 15);
  const allStocks = [...SAMPLE_STOCKS, ...SAMPLE_ETFS];
  
  // Generate stock positions
  const stockCount = Math.floor(numPositions * 0.7);
  const usedStocks = new Set<string>();
  
  for (let i = 0; i < stockCount; i++) {
    let stock;
    do {
      stock = allStocks[random(0, allStocks.length - 1)];
    } while (usedStocks.has(stock.code));
    usedStocks.add(stock.code);
    
    const qty = random(10, 500);
    const costPrice = randomFloat(50, 500);
    const currentPrice = costPrice * randomFloat(0.7, 1.5);
    const marketVal = qty * currentPrice;
    const plVal = (currentPrice - costPrice) * qty;
    const plRatio = ((currentPrice - costPrice) / costPrice) * 100;
    const positionSide = random(0, 9) < 8 ? 'LONG' : 'SHORT';
    
    positions.push({
      code: stock.code,
      stock_name: stock.name,
      position_market: 'US',
      qty: qty,
      can_sell_qty: qty * randomFloat(0.8, 1.0),
      cost_price: costPrice,
      cost_price_valid: true,
      average_cost: costPrice,
      diluted_cost: costPrice * randomFloat(0.95, 1.05),
      market_val: marketVal,
      nominal_price: currentPrice,
      pl_ratio: plRatio,
      pl_ratio_valid: true,
      pl_val: plVal,
      pl_val_valid: true,
      today_pl_val: plVal * randomFloat(0.1, 0.3),
      position_side: positionSide,
      unrealized_pl: plVal,
      realized_pl: randomFloat(-5000, 10000),
      currency: 'USD',
      percentage_of_portfolio: null,
    });
  }
  
  // Generate option positions
  const optionCount = numPositions - stockCount;
  for (let i = 0; i < optionCount; i++) {
    const optionCode = OPTION_CODES[random(0, OPTION_CODES.length - 1)];
    const qty = random(1, 20) * 100; // Options are typically in lots of 100
    const costPrice = randomFloat(1, 50);
    const currentPrice = costPrice * randomFloat(0.5, 2.0);
    const marketVal = qty * currentPrice;
    const plVal = (currentPrice - costPrice) * qty;
    const plRatio = ((currentPrice - costPrice) / costPrice) * 100;
    
    positions.push({
      code: optionCode,
      stock_name: optionCode,
      position_market: 'US',
      qty: qty,
      can_sell_qty: qty * randomFloat(0.7, 1.0),
      cost_price: costPrice,
      cost_price_valid: true,
      average_cost: costPrice,
      diluted_cost: costPrice,
      market_val: marketVal,
      nominal_price: currentPrice,
      pl_ratio: plRatio,
      pl_ratio_valid: true,
      pl_val: plVal,
      pl_val_valid: true,
      today_pl_val: plVal * randomFloat(0.2, 0.5),
      position_side: 'LONG',
      unrealized_pl: plVal,
      realized_pl: 0,
      currency: 'USD',
      percentage_of_portfolio: null,
    });
  }
  
  return positions;
};

/**
 * Generates complete demo data (account + positions) as JSON string
 */
export const generateDemoData = (): string => {
  const account = generateDemoAccountData();
  const positions = generateDemoPositionsData(account);
  
  // Calculate portfolio percentages
  const totalAssets = account.total_assets;
  positions.forEach(position => {
    position.percentage_of_portfolio = (position.market_val / totalAssets) * 100;
  });
  
  // Calculate PL totals
  const isOption = (code: string) => /[0-9]{6}[CP][0-9]+/.test(code);
  const totalUnrealizedPlOptions = positions
    .filter(position => isOption(position.code))
    .reduce((acc, position) => acc + position.unrealized_pl, 0);
  const totalUnrealizedPlStocks = positions
    .filter(position => !isOption(position.code))
    .reduce((acc, position) => acc + position.unrealized_pl, 0);
  const totalRealizedPlStocks = positions
    .filter(position => !isOption(position.code))
    .reduce((acc, position) => acc + position.realized_pl, 0);
  const totalPlPotential = totalUnrealizedPlOptions + totalUnrealizedPlStocks + totalRealizedPlStocks;
  
  account.total_pl_potential = totalPlPotential;
  account.total_pl_unrealized_options = totalUnrealizedPlOptions;
  account.total_pl_unrealized_stocks = totalUnrealizedPlStocks;
  account.total_pl_realized_stocks = totalRealizedPlStocks;
  
  return JSON.stringify({
    account,
    positions,
  }, null, 2);
};

