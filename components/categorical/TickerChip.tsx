import React from "react";
import { X } from "lucide-react";
import { formatTickerRelativeText } from "../../utils/categorical";

export const TICKER_CHIP_WIDTH = 124;
export const TICKER_CHIP_HEIGHT = 48;

interface TickerChipProps {
    hasPosition: boolean;
    isDragging: boolean;
    onPointerDown: (
        event: React.PointerEvent<HTMLButtonElement>,
        ticker: string,
    ) => void;
    onRemove?: (ticker: string) => void;
    removeTitle?: string;
    rowMarketValue: number;
    ticker: string;
    tickerValue: number;
}

const BASE_CLASS =
    "group relative inline-flex h-12 w-[124px] cursor-grab select-none items-center rounded-lg border px-2.5 pr-3 text-left shadow-sm transition-all active:cursor-grabbing";
const ACTIVE_CLASS =
    "border-slate-600 bg-slate-700/90 text-slate-100 hover:border-slate-500 hover:bg-slate-600";
const INACTIVE_CLASS =
    "border-slate-700/70 bg-slate-800/65 text-slate-400 hover:border-slate-600/80 hover:bg-slate-800/85";

const TickerChip: React.FC<TickerChipProps> = ({
    hasPosition,
    isDragging,
    onPointerDown,
    onRemove,
    removeTitle,
    rowMarketValue,
    ticker,
    tickerValue,
}) => {
    const isZeroPosition = tickerValue <= 0;

    return (
        <button
            type="button"
            onPointerDown={(event) => onPointerDown(event, ticker)}
            className={`${BASE_CLASS} ${
                isZeroPosition ? INACTIVE_CLASS : ACTIVE_CLASS
            } ${isDragging ? "opacity-20" : ""}`}
            title={
                hasPosition
                    ? "Ticker with position"
                    : "Ticker without current position"
            }
        >
            <span className="block w-full">
                <span className="block text-[13px] font-semibold leading-none tracking-wide">
                    {ticker}
                </span>
                <span
                    className={`mt-1 block text-[10px] leading-none ${
                        hasPosition ? "text-slate-400" : "text-slate-500"
                    }`}
                    title="Weight within this category"
                >
                    {formatTickerRelativeText(tickerValue, rowMarketValue)}
                </span>
            </span>
            {onRemove && (
                <span
                    onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemove(ticker);
                    }}
                    className="pointer-events-none absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded text-slate-300 opacity-0 transition-all hover:bg-slate-500/70 hover:text-white group-hover:pointer-events-auto group-hover:opacity-100 group-focus:pointer-events-auto group-focus:opacity-100"
                    title={removeTitle}
                >
                    <X className="h-3 w-3" />
                </span>
            )}
        </button>
    );
};

export default TickerChip;
