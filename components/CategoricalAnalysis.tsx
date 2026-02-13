import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PositionData, CategoricalGroup } from "../types";
import { extractTicker, formatCurrency, formatPercentageOfPortfolio } from "../utils/dataParser";
import { Plus, Trash2, Pencil, X } from "lucide-react";

interface CategoricalAnalysisProps {
    positions: PositionData[];
}

interface CategoryRowStats {
    marketValue: number;
    percentageOfPortfolio: number;
}

const STORAGE_KEY = "Alloc_categorical_groups";
const MANUAL_TICKER_STORAGE_KEY = "Alloc_categorical_manual_tickers";
const UNASSIGNED_ROW_ID = "__unassigned__";

const normalizeTicker = (ticker: string) => ticker.toUpperCase().trim();
const normalizeCodeForOptionCheck = (code: string) =>
    code.includes(".") ? code.split(".")[1] : code;
const isOptionCode = (code: string) =>
    /^[A-Z]+[0-9]{6}[CP][0-9]+$/i.test(normalizeCodeForOptionCheck(code));

const uniqueTickers = (tickers: string[]) => {
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

const buildTickerValueMap = (positions: PositionData[]) => {
    const map = new Map<string, number>();

    positions.forEach((position) => {
        if (isOptionCode(position.code)) return;

        const ticker = normalizeTicker(extractTicker(position.code));
        if (!ticker) return;

        const value = Math.abs(position.market_val);
        if (Number.isNaN(value)) return;

        map.set(ticker, (map.get(ticker) || 0) + value);
    });

    return map;
};

const formatCompactCurrency = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return "$0";

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);
};

const formatTickerRelativeText = (value: number, rowTotalValue: number) => {
    const percentage =
        rowTotalValue > 0 ? (value / rowTotalValue) * 100 : 0;
    return `${formatCompactCurrency(value)} · ${formatPercentageOfPortfolio(
        percentage
    )}`;
};

const areIdListsEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((id, index) => id === b[index]);

const scrambleBoardText = (target: string, progress: number) => {
    const normalizedProgress = Math.min(Math.max(progress, 0), 1);
    const lockCount = Math.floor(target.length * normalizedProgress);

    return target
        .split("")
        .map((char, index) => {
            const shouldLock = index < lockCount || !/[0-9]/.test(char);
            if (shouldLock) return char;
            return String(Math.floor(Math.random() * 10));
        })
        .join("");
};

interface AirportBoardValueProps {
    value: number;
    formatter: (value: number) => string;
    animateToken: number;
    shouldAnimate: boolean;
    className: string;
}

const AirportBoardValue: React.FC<AirportBoardValueProps> = ({
    value,
    formatter,
    animateToken,
    shouldAnimate,
    className,
}) => {
    const targetText = formatter(value);
    const [displayText, setDisplayText] = useState(targetText);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        if (!shouldAnimate) {
            setDisplayText(targetText);
            setIsAnimating(false);
            return;
        }

        const durationMs = 680;
        const start = performance.now();
        let frameId = 0;

        setIsAnimating(true);

        const tick = (now: number) => {
            const progress = Math.min((now - start) / durationMs, 1);
            setDisplayText(scrambleBoardText(targetText, progress));

            if (progress < 1) {
                frameId = window.requestAnimationFrame(tick);
                return;
            }

            setDisplayText(targetText);
            setIsAnimating(false);
        };

        frameId = window.requestAnimationFrame(tick);

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [animateToken, shouldAnimate, targetText]);

    return (
        <span className={`${className} ${isAnimating ? "text-blue-100" : ""}`}>
            <span className={isAnimating ? "inline-block animate-pulse" : "inline-block"}>
                {displayText}
            </span>
        </span>
    );
};

const sanitizeGroups = (input: any[]): CategoricalGroup[] => {
    const seen = new Set<string>();

    return input
        .filter((entry) => entry && typeof entry.name === "string")
        .map((entry, index) => {
            const cleanTickers = uniqueTickers(
                Array.isArray(entry.tickers) ? entry.tickers.map((ticker: any) => String(ticker)) : []
            ).filter((ticker) => {
                if (seen.has(ticker)) return false;
                seen.add(ticker);
                return true;
            });

            return {
                id: String(entry.id || `category_${Date.now()}_${index}`),
                name: String(entry.name || `Category ${index + 1}`).trim(),
                tickers: cleanTickers,
                subGroups: {},
            } as CategoricalGroup;
        })
        .filter((group) => group.name.length > 0);
};

const CategoricalAnalysis: React.FC<CategoricalAnalysisProps> = ({ positions }) => {
    const [groups, setGroups] = useState<CategoricalGroup[]>([]);
    const [manualTickers, setManualTickers] = useState<string[]>([]);
    const groupsRef = useRef<CategoricalGroup[]>([]);

    const [newCategoryName, setNewCategoryName] = useState("");
    const [newTickerInput, setNewTickerInput] = useState("");

    const [draggedTicker, setDraggedTicker] = useState<string | null>(null);
    const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
    const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
    const dragOverRowIdRef = useRef<string | null>(null);
    const dragPointerOffsetRef = useRef<{ x: number; y: number }>({ x: 12, y: 12 });
    const pointerDraggedTickerRef = useRef<string | null>(null);
    const pointerIdRef = useRef<number | null>(null);
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    const [displayOrderIds, setDisplayOrderIds] = useState<string[]>([]);
    const displayOrderIdsRef = useRef<string[]>([]);
    const sortedGroupIdsRef = useRef<string[]>([]);
    const holdRowReorderRef = useRef(false);
    const valueAnimationTimerRef = useRef<number | null>(null);
    const [marketValueAnimateToken, setMarketValueAnimateToken] = useState(0);
    const [marketValueFlashRowIds, setMarketValueFlashRowIds] = useState<string[]>([]);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState("");

    const [hasLoaded, setHasLoaded] = useState(false);

    useEffect(() => {
        try {
            const storedGroups = localStorage.getItem(STORAGE_KEY);
            if (storedGroups) {
                const parsed = JSON.parse(storedGroups);
                if (Array.isArray(parsed)) {
                    setGroups(sanitizeGroups(parsed));
                }
            }
        } catch (error) {
            console.error("Failed to load categorical groups", error);
        }

        try {
            const storedManualTickers = localStorage.getItem(MANUAL_TICKER_STORAGE_KEY);
            if (storedManualTickers) {
                const parsed = JSON.parse(storedManualTickers);
                if (Array.isArray(parsed)) {
                    setManualTickers(uniqueTickers(parsed.map((entry) => String(entry))));
                }
            }
        } catch (error) {
            console.error("Failed to load manual ticker pool", error);
        }

        setHasLoaded(true);
    }, []);

    useEffect(() => {
        if (!hasLoaded) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
        } catch (error) {
            console.error("Failed to save categorical groups", error);
        }
    }, [groups, hasLoaded]);

    useEffect(() => {
        groupsRef.current = groups;
    }, [groups]);

    useEffect(() => {
        if (!hasLoaded) return;
        try {
            localStorage.setItem(
                MANUAL_TICKER_STORAGE_KEY,
                JSON.stringify(uniqueTickers(manualTickers))
            );
        } catch (error) {
            console.error("Failed to save manual ticker pool", error);
        }
    }, [manualTickers, hasLoaded]);

    const tickerValues = useMemo(() => buildTickerValueMap(positions), [positions]);

    const portfolioTotal = useMemo(() => {
        let total = 0;
        tickerValues.forEach((value) => {
            total += value;
        });
        return total;
    }, [tickerValues]);

    const assignedTickers = useMemo(() => {
        const set = new Set<string>();
        groups.forEach((group) => {
            group.tickers.forEach((ticker) => set.add(normalizeTicker(ticker)));
        });
        return set;
    }, [groups]);

    const allKnownTickers = useMemo(() => {
        const known = new Set<string>();

        tickerValues.forEach((_value, ticker) => known.add(ticker));
        manualTickers.forEach((ticker) => known.add(normalizeTicker(ticker)));
        groups.forEach((group) => {
            group.tickers.forEach((ticker) => known.add(normalizeTicker(ticker)));
        });

        return Array.from(known).sort((a, b) => {
            const valueDiff = (tickerValues.get(b) || 0) - (tickerValues.get(a) || 0);
            if (valueDiff !== 0) return valueDiff;
            return a.localeCompare(b);
        });
    }, [groups, manualTickers, tickerValues]);

    const unassignedTickers = useMemo(
        () => allKnownTickers.filter((ticker) => !assignedTickers.has(ticker)),
        [allKnownTickers, assignedTickers]
    );

    const sortTickersByPositionValue = useCallback(
        (tickers: string[]) =>
            uniqueTickers(tickers).sort((a, b) => {
                const valueDiff = (tickerValues.get(b) || 0) - (tickerValues.get(a) || 0);
                if (valueDiff !== 0) return valueDiff;
                return a.localeCompare(b);
            }),
        [tickerValues]
    );

    const computeRowStats = useCallback(
        (tickers: string[]): CategoryRowStats => {
            const marketValue = tickers.reduce(
                (sum, ticker) => sum + (tickerValues.get(ticker) || 0),
                0
            );

            return {
                marketValue,
                percentageOfPortfolio:
                    portfolioTotal > 0 ? (marketValue / portfolioTotal) * 100 : 0,
            };
        },
        [portfolioTotal, tickerValues]
    );

    const getGroupMarketValue = useCallback(
        (group: CategoricalGroup) =>
            group.tickers.reduce(
                (sum, ticker) => sum + (tickerValues.get(normalizeTicker(ticker)) || 0),
                0
            ),
        [tickerValues]
    );

    const sortedGroups = useMemo(
        () =>
            [...groups].sort((a, b) => {
                const valueDiff = getGroupMarketValue(b) - getGroupMarketValue(a);
                if (valueDiff !== 0) return valueDiff;
                return a.name.localeCompare(b.name);
            }),
        [getGroupMarketValue, groups]
    );

    const sortedGroupIds = useMemo(
        () => sortedGroups.map((group) => group.id),
        [sortedGroups]
    );

    const groupsById = useMemo(() => {
        const map = new Map<string, CategoricalGroup>();
        groups.forEach((group) => map.set(group.id, group));
        return map;
    }, [groups]);

    const displayedGroups = useMemo(() => {
        const ordered: CategoricalGroup[] = [];
        const seen = new Set<string>();
        const baseOrder = displayOrderIds.length > 0 ? displayOrderIds : sortedGroupIds;

        baseOrder.forEach((id) => {
            const group = groupsById.get(id);
            if (!group) return;
            ordered.push(group);
            seen.add(id);
        });

        sortedGroupIds.forEach((id) => {
            if (seen.has(id)) return;
            const group = groupsById.get(id);
            if (!group) return;
            ordered.push(group);
        });

        return ordered;
    }, [displayOrderIds, groupsById, sortedGroupIds]);

    const animateRowsToOrder = useCallback((nextOrderIds: string[]) => {
        const currentOrder = displayOrderIdsRef.current;
        if (areIdListsEqual(currentOrder, nextOrderIds)) {
            setDisplayOrderIds(nextOrderIds);
            return;
        }

        const previousTopById = new Map<string, number>();
        currentOrder.forEach((id) => {
            const rowElement = rowRefs.current[id];
            if (!rowElement) return;
            previousTopById.set(id, rowElement.getBoundingClientRect().top);
        });

        setDisplayOrderIds(nextOrderIds);

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                nextOrderIds.forEach((id) => {
                    const rowElement = rowRefs.current[id];
                    const previousTop = previousTopById.get(id);
                    if (!rowElement || previousTop === undefined) return;

                    const deltaY =
                        previousTop - rowElement.getBoundingClientRect().top;
                    if (Math.abs(deltaY) < 0.5) return;

                    rowElement.style.transition = "none";
                    rowElement.style.transform = `translateY(${deltaY}px)`;
                    rowElement.style.willChange = "transform";

                    window.requestAnimationFrame(() => {
                        rowElement.style.transition =
                            "transform 560ms cubic-bezier(0.22, 1, 0.36, 1)";
                        rowElement.style.transform = "translateY(0)";
                    });

                    window.setTimeout(() => {
                        rowElement.style.transition = "";
                        rowElement.style.transform = "";
                        rowElement.style.willChange = "";
                    }, 620);
                });
            });
        });
    }, []);

    const queueRelocationAnimation = useCallback(
        (affectedRowIds: string[]) => {
            if (valueAnimationTimerRef.current) {
                window.clearTimeout(valueAnimationTimerRef.current);
                valueAnimationTimerRef.current = null;
            }

            holdRowReorderRef.current = true;
            setMarketValueFlashRowIds(Array.from(new Set(affectedRowIds)));
            setMarketValueAnimateToken((prev) => prev + 1);

            valueAnimationTimerRef.current = window.setTimeout(() => {
                animateRowsToOrder(sortedGroupIdsRef.current);
                holdRowReorderRef.current = false;
                setMarketValueFlashRowIds([]);
                valueAnimationTimerRef.current = null;
            }, 700);
        },
        [animateRowsToOrder]
    );

    const moveTickerToRow = useCallback((tickerInput: string, targetGroupId: string | null) => {
        const ticker = normalizeTicker(tickerInput);
        if (!ticker) return;

        const sourceGroupId =
            groupsRef.current.find((group) =>
                group.tickers.some((entry) => normalizeTicker(entry) === ticker)
            )?.id || null;
        const didMove = sourceGroupId !== targetGroupId;
        const affectedRowIds = Array.from(
            new Set([
                sourceGroupId || UNASSIGNED_ROW_ID,
                targetGroupId || UNASSIGNED_ROW_ID,
            ])
        );

        setGroups((prev) => {
            const withoutTicker = prev.map((group) => ({
                ...group,
                tickers: sortTickersByPositionValue(
                    group.tickers.filter(
                        (entry) => normalizeTicker(entry) !== ticker
                    )
                ),
                subGroups: {},
            }));

            if (!targetGroupId) {
                return withoutTicker;
            }

            return withoutTicker.map((group) => {
                if (group.id !== targetGroupId) return group;
                return {
                    ...group,
                    tickers: sortTickersByPositionValue([...group.tickers, ticker]),
                    subGroups: {},
                };
            });
        });

        setManualTickers((prev) => uniqueTickers([...prev, ticker]));

        if (didMove) {
            queueRelocationAnimation(affectedRowIds);
        }
    }, [queueRelocationAnimation, sortTickersByPositionValue]);

    const removeManualTickerEverywhere = useCallback((tickerInput: string) => {
        const ticker = normalizeTicker(tickerInput);
        if (!ticker) return;

        setManualTickers((prev) => prev.filter((entry) => normalizeTicker(entry) !== ticker));
        setGroups((prev) =>
            prev.map((group) => ({
                ...group,
                tickers: group.tickers.filter((entry) => normalizeTicker(entry) !== ticker),
                subGroups: {},
            }))
        );
    }, []);

    const handleAddCategory = () => {
        const name = newCategoryName.trim();
        if (!name) return;

        const id = `category_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setGroups((prev) => [...prev, { id, name, tickers: [], subGroups: {} }]);
        setNewCategoryName("");
    };

    const handleStartInlineRename = (group: CategoricalGroup) => {
        setEditingCategoryId(group.id);
        setEditingCategoryName(group.name);
    };

    const handleCancelInlineRename = () => {
        setEditingCategoryId(null);
        setEditingCategoryName("");
    };

    const handleCommitInlineRename = () => {
        if (!editingCategoryId) return;
        const cleaned = editingCategoryName.trim();
        if (!cleaned) {
            handleCancelInlineRename();
            return;
        }

        setGroups((prev) =>
            prev.map((entry) =>
                entry.id === editingCategoryId ? { ...entry, name: cleaned } : entry
            )
        );
        handleCancelInlineRename();
    };

    const handleDeleteCategory = (groupId: string) => {
        const targetGroup = groups.find((group) => group.id === groupId);
        if (!targetGroup) return;

        if (
            targetGroup.tickers.length > 0 &&
            !confirm("Delete this category? Tickers will move to Unassigned.")
        ) {
            return;
        }

        setGroups((prev) => prev.filter((group) => group.id !== groupId));
        if (editingCategoryId === groupId) {
            handleCancelInlineRename();
        }
    };

    const handleAddTicker = () => {
        const ticker = normalizeTicker(newTickerInput);
        if (!ticker) return;

        moveTickerToRow(ticker, null);

        setNewTickerInput("");
    };

    const clearPointerDrag = useCallback(() => {
        pointerDraggedTickerRef.current = null;
        pointerIdRef.current = null;
        dragOverRowIdRef.current = null;
        setDraggedTicker(null);
        setDragOverRowId(null);
        setDragPointer(null);
    }, []);

    const getDropRowIdAtPoint = useCallback((x: number, y: number) => {
        const target = document.elementFromPoint(x, y) as HTMLElement | null;
        if (!target) return null;

        const zone = target.closest<HTMLElement>("[data-drop-row-id]");
        return zone?.getAttribute("data-drop-row-id") || null;
    }, []);

    const handleChipPointerDown = (
        event: React.PointerEvent,
        tickerInput: string
    ) => {
        if (event.button !== 0) return;
        const ticker = normalizeTicker(tickerInput);
        if (!ticker) return;

        const chipRect = (
            event.currentTarget as HTMLElement
        ).getBoundingClientRect();
        dragPointerOffsetRef.current = {
            x: Math.min(
                Math.max(event.clientX - chipRect.left, 0),
                chipRect.width || 124
            ),
            y: Math.min(
                Math.max(event.clientY - chipRect.top, 0),
                chipRect.height || 48
            ),
        };

        pointerIdRef.current = event.pointerId;
        pointerDraggedTickerRef.current = ticker;
        setDraggedTicker(ticker);
        setDragPointer({ x: event.clientX, y: event.clientY });
        setDragOverRowId(null);
        dragOverRowIdRef.current = null;
        event.preventDefault();
        event.stopPropagation();
    };

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            if (!pointerDraggedTickerRef.current) return;
            if (
                pointerIdRef.current !== null &&
                event.pointerId !== pointerIdRef.current
            ) {
                return;
            }

            setDragPointer({ x: event.clientX, y: event.clientY });

            const rowId = getDropRowIdAtPoint(event.clientX, event.clientY);
            dragOverRowIdRef.current = rowId;
            setDragOverRowId((prev) => (prev === rowId ? prev : rowId));
        };

        const handlePointerUp = (event: PointerEvent) => {
            const pointerTicker = pointerDraggedTickerRef.current;
            if (!pointerTicker) return;
            if (
                pointerIdRef.current !== null &&
                event.pointerId !== pointerIdRef.current
            ) {
                return;
            }

            const rowId = getDropRowIdAtPoint(event.clientX, event.clientY);

            if (rowId) {
                moveTickerToRow(
                    pointerTicker,
                    rowId === UNASSIGNED_ROW_ID ? null : rowId
                );
            }

            clearPointerDrag();
        };

        const handlePointerCancel = (event: PointerEvent) => {
            if (!pointerDraggedTickerRef.current) return;
            if (
                pointerIdRef.current !== null &&
                event.pointerId !== pointerIdRef.current
            ) {
                return;
            }
            clearPointerDrag();
        };

        const handleWindowBlur = () => {
            if (!pointerDraggedTickerRef.current) return;
            clearPointerDrag();
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerCancel);
        window.addEventListener("blur", handleWindowBlur);

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerCancel);
            window.removeEventListener("blur", handleWindowBlur);
        };
    }, [clearPointerDrag, getDropRowIdAtPoint, moveTickerToRow]);

    useEffect(() => {
        dragOverRowIdRef.current = dragOverRowId;
    }, [dragOverRowId]);

    useEffect(() => {
        displayOrderIdsRef.current = displayOrderIds;
    }, [displayOrderIds]);

    useEffect(() => {
        sortedGroupIdsRef.current = sortedGroupIds;
        if (holdRowReorderRef.current) return;
        setDisplayOrderIds((prev) =>
            areIdListsEqual(prev, sortedGroupIds) ? prev : sortedGroupIds
        );
    }, [sortedGroupIds]);

    useEffect(() => {
        return () => {
            if (valueAnimationTimerRef.current) {
                window.clearTimeout(valueAnimationTimerRef.current);
                valueAnimationTimerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!hasLoaded) return;

        setGroups((prev) => {
            let changed = false;

            const normalized = prev.map((group) => {
                const sortedTickers = sortTickersByPositionValue(group.tickers);
                const sameOrder =
                    sortedTickers.length === group.tickers.length &&
                    sortedTickers.every((ticker, index) => ticker === group.tickers[index]);

                if (sameOrder) return group;

                changed = true;
                return {
                    ...group,
                    tickers: sortedTickers,
                    subGroups: {},
                };
            });

            return changed ? normalized : prev;
        });
    }, [hasLoaded, sortTickersByPositionValue]);

    useEffect(() => {
        if (!editingCategoryId) return;
        const exists = groups.some((group) => group.id === editingCategoryId);
        if (!exists) {
            handleCancelInlineRename();
        }
    }, [editingCategoryId, groups]);

    const draggedTickerValue =
        draggedTicker !== null ? tickerValues.get(draggedTicker) || 0 : 0;
    const marketValueFlashSet = useMemo(
        () => new Set(marketValueFlashRowIds),
        [marketValueFlashRowIds]
    );
    const tickerChipBaseClass =
        "group relative inline-flex w-[124px] h-12 items-center rounded-lg border px-2.5 pr-7 text-left shadow-sm transition-all select-none cursor-grab active:cursor-grabbing";
    const tickerChipActiveClass =
        "bg-slate-700/90 border-slate-600 text-slate-100 hover:bg-slate-600 hover:border-slate-500";
    const tickerChipInactiveClass =
        "bg-slate-800/65 border-slate-700/70 text-slate-400 hover:bg-slate-800/85 hover:border-slate-600/80";
    const tickerChipDraggingClass = "opacity-20";

    return (
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-800/95 p-5 shadow-[0_18px_45px_rgba(2,6,23,0.35)] md:p-6 mb-8">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-600/25 via-slate-700/10 to-transparent" />
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-44 w-44 rounded-full bg-cyan-500/5 blur-3xl" />

            <div className="relative mb-5 flex flex-col gap-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300/80">
                            Ticker Categorization
                        </p>
                        <h2 className="text-xl font-semibold text-white md:text-2xl">
                            Common Stock Category Analysis
                        </h2>
                        <p className="text-sm text-slate-300/80 max-w-3xl">
                            Single-layer, Excel-style categorization for common stock holdings only. Drag ticker chips between rows to reassign.
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-600/80 bg-slate-900/75 p-2 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                                value={newTickerInput}
                                onChange={(event) => setNewTickerInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        handleAddTicker();
                                    }
                                }}
                                placeholder="Add ticker (e.g. SMCI)"
                                className="w-full sm:w-72 px-3 py-2.5 bg-slate-700/90 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70 focus:border-blue-400"
                            />
                            <button
                                onClick={handleAddTicker}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap"
                            >
                                <Plus className="h-4 w-4" />
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {draggedTicker && dragPointer && (
                <div
                    className="pointer-events-none fixed z-[60]"
                    style={{
                        left: dragPointer.x - dragPointerOffsetRef.current.x,
                        top: dragPointer.y - dragPointerOffsetRef.current.y,
                    }}
                >
                    <div className="inline-flex h-12 w-[124px] items-center rounded-lg border border-blue-400/80 bg-slate-600/95 px-2.5 text-left text-slate-50 shadow-xl">
                        <span className="block w-full">
                            <span className="block text-[13px] font-semibold leading-none tracking-wide">
                                {draggedTicker}
                            </span>
                            <span className="mt-1 block text-[10px] leading-none text-slate-300">
                                {formatCompactCurrency(draggedTickerValue)}
                            </span>
                        </span>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-900/50 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
                    <table className="min-w-full text-sm">
                        <thead className="border-b border-slate-700 bg-slate-900/95 backdrop-blur">
                        <tr>
                            <th className="w-64 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Category</th>
                            <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Tickers (Drag & Drop)</th>
                            <th className="w-44 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Market Value</th>
                            <th className="w-28 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Portfolio %</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/80">
                        {unassignedTickers.length > 0 &&
                            (() => {
                                const stats = computeRowStats(unassignedTickers);

                                return (
                                    <tr
                                        key={UNASSIGNED_ROW_ID}
                                        data-drop-row-id={UNASSIGNED_ROW_ID}
                                    className={`align-top ${
                                        dragOverRowId === UNASSIGNED_ROW_ID
                                            ? "bg-amber-500/12 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.45)]"
                                            : "bg-slate-800/75 transition-colors hover:bg-slate-800/95"
                                    }`}
                                >
                                    <td className="px-4 py-3.5">
                                        <div className="font-semibold text-amber-200">Unassigned</div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            Drop tickers here to remove category assignment
                                        </div>
                                    </td>
                                        <td className="px-4 py-3.5">
                                            <div className="min-h-12 flex flex-wrap gap-2.5">
                                                {unassignedTickers.map((ticker) => {
                                                    const hasPosition = tickerValues.has(ticker);
                                                    const tickerValue = tickerValues.get(ticker) || 0;
                                                    const isZeroPosition = tickerValue <= 0;

                                                    return (
                                                        <button
                                                            key={`unassigned_${ticker}`}
                                                            onPointerDown={(event) =>
                                                                handleChipPointerDown(
                                                                    event,
                                                                    ticker
                                                                )
                                                            }
                                                            className={`${tickerChipBaseClass} ${
                                                                isZeroPosition
                                                                    ? tickerChipInactiveClass
                                                                    : tickerChipActiveClass
                                                            } ${
                                                                draggedTicker === ticker
                                                                    ? tickerChipDraggingClass
                                                                    : ""
                                                            }`}
                                                            title={hasPosition ? "Ticker with position" : "Ticker without current position"}
                                                        >
                                                            <span className="block w-full">
                                                                <span className="block text-[13px] font-semibold leading-none tracking-wide">
                                                                    {ticker}
                                                                </span>
                                                                <span
                                                                    className={`mt-1 block text-[10px] leading-none ${
                                                                        hasPosition
                                                                            ? "text-slate-400"
                                                                            : "text-slate-500"
                                                                    }`}
                                                                >
                                                                    {formatTickerRelativeText(
                                                                        tickerValue,
                                                                        stats.marketValue
                                                                    )}
                                                                </span>
                                                            </span>
                                                            {!hasPosition && (
                                                                <span
                                                                    onPointerDown={(event) => {
                                                                        event.preventDefault();
                                                                        event.stopPropagation();
                                                                    }}
                                                                    onClick={(event) => {
                                                                        event.preventDefault();
                                                                        event.stopPropagation();
                                                                        removeManualTickerEverywhere(ticker);
                                                                    }}
                                                                    className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded text-slate-300 transition-colors hover:bg-slate-500/70 hover:text-white"
                                                                    title="Remove ticker from workspace"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <AirportBoardValue
                                            value={stats.marketValue}
                                            formatter={formatCurrency}
                                            animateToken={marketValueAnimateToken}
                                            shouldAnimate={marketValueFlashSet.has(
                                                UNASSIGNED_ROW_ID
                                            )}
                                            className="font-mono text-base tracking-tight text-slate-200"
                                        />
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-mono text-base tracking-tight text-slate-300">{formatPercentageOfPortfolio(stats.percentageOfPortfolio)}</td>
                                </tr>
                            );
                        })()}

                        {displayedGroups.map((group) => {
                            const rowTickers = sortTickersByPositionValue(group.tickers);
                            const stats = computeRowStats(group.tickers);

                            return (
                                <tr
                                    key={group.id}
                                    ref={(node) => {
                                        rowRefs.current[group.id] = node;
                                    }}
                                    data-drop-row-id={group.id}
                                    className={`align-top ${
                                        dragOverRowId === group.id
                                            ? "bg-blue-500/10 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.45)]"
                                            : "bg-slate-800/75 transition-colors hover:bg-slate-800/95"
                                    }`}
                                >
                                    <td className="px-4 py-3.5">
                                        {editingCategoryId === group.id ? (
                                            <input
                                                autoFocus
                                                value={editingCategoryName}
                                                onChange={(event) =>
                                                    setEditingCategoryName(
                                                        event.target.value
                                                    )
                                                }
                                                onBlur={handleCommitInlineRename}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        handleCommitInlineRename();
                                                    } else if (event.key === "Escape") {
                                                        event.preventDefault();
                                                        handleCancelInlineRename();
                                                    }
                                                }}
                                                className="w-full rounded bg-slate-700 px-2.5 py-1.5 text-sm font-semibold text-white outline-none border border-blue-500/60 focus:ring-2 focus:ring-blue-500/70"
                                            />
                                        ) : (
                                            <div className="break-words text-[18px] font-semibold text-white">
                                                {group.name}
                                            </div>
                                        )}
                                        <div className="mt-2.5 flex items-center gap-1.5">
                                            <button
                                                onClick={() =>
                                                    handleStartInlineRename(group)
                                                }
                                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-blue-300"
                                                title="Rename category"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCategory(group.id)}
                                                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-rose-300"
                                                title="Delete category"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="min-h-12 flex flex-wrap gap-2.5">
                                            {rowTickers.map((ticker) => {
                                                const hasPosition = tickerValues.has(ticker);
                                                const tickerValue = tickerValues.get(ticker) || 0;
                                                const isZeroPosition = tickerValue <= 0;

                                                return (
                                                    <button
                                                        key={`${group.id}_${ticker}`}
                                                        onPointerDown={(event) =>
                                                            handleChipPointerDown(
                                                                event,
                                                                ticker
                                                            )
                                                        }
                                                        className={`${tickerChipBaseClass} ${
                                                            isZeroPosition
                                                                ? tickerChipInactiveClass
                                                                : tickerChipActiveClass
                                                        } ${
                                                            draggedTicker === ticker
                                                                ? tickerChipDraggingClass
                                                                : ""
                                                        }`}
                                                    >
                                                        <span className="block w-full">
                                                            <span className="block text-[13px] font-semibold leading-none tracking-wide">
                                                                {ticker}
                                                            </span>
                                                            <span
                                                                className={`mt-1 block text-[10px] leading-none ${
                                                                    hasPosition
                                                                        ? "text-slate-400"
                                                                        : "text-slate-500"
                                                                }`}
                                                            >
                                                                {formatTickerRelativeText(
                                                                    tickerValue,
                                                                    stats.marketValue
                                                                )}
                                                            </span>
                                                        </span>
                                                        <span
                                                            onPointerDown={(event) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                            }}
                                                            onClick={(event) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                moveTickerToRow(ticker, null);
                                                            }}
                                                            className="absolute right-1 top-1 inline-flex h-4 w-4 items-center justify-center rounded text-slate-300 transition-colors hover:bg-slate-500/70 hover:text-white"
                                                            title="Move to unassigned"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                            {rowTickers.length === 0 && (
                                                <span className="text-xs italic text-slate-500">No tickers in this category</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        <AirportBoardValue
                                            value={stats.marketValue}
                                            formatter={formatCurrency}
                                            animateToken={marketValueAnimateToken}
                                            shouldAnimate={marketValueFlashSet.has(group.id)}
                                            className="font-mono text-base tracking-tight text-slate-200"
                                        />
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-mono text-base tracking-tight text-slate-300">{formatPercentageOfPortfolio(stats.percentageOfPortfolio)}</td>
                                </tr>
                            );
                        })}

                        <tr className="align-top border-t border-slate-700 bg-slate-900/55">
                            <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleAddCategory}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-600 bg-slate-700 text-slate-200 transition-colors hover:border-blue-500 hover:bg-blue-600"
                                        title="Add category"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                    <input
                                        value={newCategoryName}
                                        onChange={(event) =>
                                            setNewCategoryName(event.target.value)
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                handleAddCategory();
                                            }
                                        }}
                                        placeholder="Add new category..."
                                        className="w-full rounded border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                                    />
                                </div>
                            </td>
                            <td
                                colSpan={3}
                                className="px-4 py-3.5 text-xs text-slate-500"
                            >
                                Press Enter or click + to create a new category row
                            </td>
                        </tr>
                        </tbody>
                    </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-slate-600 bg-slate-700/70 px-2.5 py-1 text-slate-300">
                    Total tracked: {allKnownTickers.length}
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                    Assigned: {assignedTickers.size}
                </span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
                    Unassigned: {unassignedTickers.length}
                </span>
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-blue-200">
                    Portfolio total: {formatCurrency(portfolioTotal)}
                </span>
            </div>
        </div>
    );
};

export default CategoricalAnalysis;
