// Enum for Position Side
export enum PositionSide {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

// Interface matching all_accounts.csv
export interface AccountData {
  power: number;
  max_power_short: number;
  net_cash_power: number;
  total_assets: number;
  securities_assets: number;
  fund_assets: number;
  bond_assets: number;
  cash: number;
  market_val: number;
  long_mv: number;
  short_mv: number;
  pending_asset: number;
  interest_charged_amount: number;
  frozen_cash: number;
  avl_withdrawal_cash: number | string; // Can be N/A
  currency: string;
  unrealized_pl: number | string; // Can be N/A
  realized_pl: number | string; // Can be N/A
  risk_status: string;
  initial_margin: number;
  maintenance_margin: number;
  total_pl_unrealized_options: number;
  total_pl_unrealized_stocks: number;
  total_pl_realized_stocks: number;
  total_pl_potential: number;
}

// Interface matching all_positions.csv
export interface PositionData {
  code: string;
  stock_name: string;
  position_market: string;
  qty: number;
  can_sell_qty: number;
  cost_price: number;
  cost_price_valid: boolean;
  average_cost: number;
  diluted_cost: number;
  market_val: number;
  nominal_price: number; // Current Price
  pl_ratio: number;
  pl_ratio_valid: boolean;
  pl_val: number;
  pl_val_valid: boolean;
  today_pl_val: number;
  position_side: PositionSide | string;
  unrealized_pl: number;
  realized_pl: number;
  currency: string;
  percentage_of_portfolio: number | null;
}

export interface SortConfig {
  key: keyof PositionData;
  direction: 'asc' | 'desc';
}