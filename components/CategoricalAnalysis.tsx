import React, { useEffect, useMemo, useState } from "react";
import { PositionData, CategoricalGroup } from "../types";
import {
    extractTicker,
    formatCurrency,
    formatPercentageOfPortfolio,
} from "../utils/dataParser";
import GroupChart from "./GroupChart";
import {
    Plus,
    Edit2,
    Trash2,
    X,
    Check,
    AlertTriangle,
} from "lucide-react";

interface CategoricalAnalysisProps {
    positions: PositionData[];
}

interface GroupMemberRow {
    ticker: string;
    value: number;
    percentageOfGroup: number;
    percentageOfPortfolio: number;
    isMissing: boolean;
}

interface GroupDetails {
    id: string;
    name: string;
    tickers: string[];
    totalValue: number;
    percentageOfPortfolio: number;
    missingTickers: string[];
    members: GroupMemberRow[];
    chartData: {
        name: string;
        size: number;
        percentage: number;
        tickers: string[];
    }[];
}

const STORAGE_KEY = "Alloc_categorical_groups";
const OTHERS_SUBGROUP_NAME = "Others";
const UNASSIGNED_ID = "__unassigned__";

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

const normalizeSubGroupMap = (
    tickers: string[],
    subGroups: Record<string, string> | undefined
) => {
    const lookup = new Map<string, string>();
    Object.entries(subGroups || {}).forEach(([key, value]) => {
        lookup.set(normalizeTicker(key), value);
    });

    const normalized: Record<string, string> = {};
    tickers.forEach((ticker) => {
        const mapped = lookup.get(normalizeTicker(ticker));
        const cleaned = mapped ? mapped.trim() : "";
        normalized[ticker] = cleaned || ticker;
    });

    return normalized;
};

const buildTickerValueMap = (
    positions: PositionData[],
    includeOptions: boolean
) => {
    const map = new Map<string, number>();
    positions.forEach((position) => {
        if (!includeOptions && isOptionCode(position.code)) return;
        const ticker = normalizeTicker(extractTicker(position.code));
        if (!ticker) return;
        const value = Math.abs(position.market_val);
        if (Number.isNaN(value)) return;
        map.set(ticker, (map.get(ticker) || 0) + value);
    });
    return map;
};

const buildGroupDetails = (
    group: CategoricalGroup,
    tickerValues: Map<string, number>,
    portfolioTotal: number
): GroupDetails => {
    const tickers = uniqueTickers(group.tickers || []);
    const subGroups = normalizeSubGroupMap(tickers, group.subGroups);

    const members: GroupMemberRow[] = tickers.map((ticker) => {
        const value = tickerValues.get(ticker) || 0;
        return {
            ticker,
            value,
            percentageOfGroup: 0,
            percentageOfPortfolio:
                portfolioTotal > 0 ? (value / portfolioTotal) * 100 : 0,
            isMissing: !tickerValues.has(ticker),
        };
    });

    const totalValue = members.reduce((sum, row) => sum + row.value, 0);
    members.forEach((row) => {
        row.percentageOfGroup =
            totalValue > 0 ? (row.value / totalValue) * 100 : 0;
    });

    const subGroupMap = new Map<
        string,
        { name: string; value: number; tickers: string[] }
    >();

    members.forEach((row) => {
        const subGroupName = subGroups[row.ticker] || row.ticker;
        const existing = subGroupMap.get(subGroupName) || {
            name: subGroupName,
            value: 0,
            tickers: [],
        };
        existing.value += row.value;
        existing.tickers.push(row.ticker);
        subGroupMap.set(subGroupName, existing);
    });

    const chartData = Array.from(subGroupMap.values())
        .map((subGroup) => ({
            name: subGroup.name,
            size: subGroup.value,
            percentage:
                totalValue > 0 ? (subGroup.value / totalValue) * 100 : 0,
            tickers: subGroup.tickers,
        }))
        .filter((entry) => entry.size > 0)
        .sort((a, b) => b.size - a.size);

    return {
        id: group.id,
        name: group.name,
        tickers,
        totalValue,
        percentageOfPortfolio:
            portfolioTotal > 0 ? (totalValue / portfolioTotal) * 100 : 0,
        missingTickers: members.filter((row) => row.isMissing).map((row) => row.ticker),
        members: members.sort((a, b) => b.value - a.value),
        chartData,
    };
};

const buildUnassignedDetails = (
    tickers: string[],
    tickerValues: Map<string, number>,
    portfolioTotal: number
): GroupDetails => {
    const members: GroupMemberRow[] = tickers.map((ticker) => {
        const value = tickerValues.get(ticker) || 0;
        return {
            ticker,
            value,
            percentageOfGroup: 0,
            percentageOfPortfolio:
                portfolioTotal > 0 ? (value / portfolioTotal) * 100 : 0,
            isMissing: false,
        };
    });

    const totalValue = members.reduce((sum, row) => sum + row.value, 0);
    members.forEach((row) => {
        row.percentageOfGroup =
            totalValue > 0 ? (row.value / totalValue) * 100 : 0;
    });

    const chartData = members
        .filter((row) => row.value > 0)
        .map((row) => ({
            name: row.ticker,
            size: row.value,
            percentage: row.percentageOfGroup,
            tickers: [row.ticker],
        }))
        .sort((a, b) => b.size - a.size);

    return {
        id: UNASSIGNED_ID,
        name: "Unassigned",
        tickers,
        totalValue,
        percentageOfPortfolio:
            portfolioTotal > 0 ? (totalValue / portfolioTotal) * 100 : 0,
        missingTickers: [],
        members: members.sort((a, b) => b.value - a.value),
        chartData,
    };
};

const CategoricalAnalysis: React.FC<CategoricalAnalysisProps> = ({
    positions,
}) => {
    const [groups, setGroups] = useState<CategoricalGroup[]>([]);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [includeOptions, setIncludeOptions] = useState(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const sanitized = parsed
                        .filter((group) => group && group.name)
                        .map((group) => ({
                            id: String(group.id || Date.now()),
                            name: String(group.name || "Unnamed"),
                            tickers: Array.isArray(group.tickers)
                                ? group.tickers.map((ticker: string) =>
                                      normalizeTicker(String(ticker))
                                  )
                                : [],
                            subGroups:
                                group.subGroups && typeof group.subGroups === "object"
                                    ? group.subGroups
                                    : {},
                        }));
                    setGroups(sanitized);
                }
            }
        } catch (e) {
            console.error(
                "Failed to load categorical groups from localStorage",
                e
            );
        } finally {
            setHasLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!hasLoaded) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
        } catch (e) {
            console.error(
                "Failed to save categorical groups to localStorage",
                e
            );
        }
    }, [groups, hasLoaded]);

    const {
        tickerValues,
        portfolioTotal,
        unassignedTickers,
        groupDetails,
        assignedValue,
    } = useMemo(() => {
        const tickerValues = buildTickerValueMap(positions, includeOptions);
        const portfolioTotal = Array.from(tickerValues.values()).reduce(
            (sum, value) => sum + value,
            0
        );

        const assignedTickers = new Set<string>();
        const details = new Map<string, GroupDetails>();
        let assignedValue = 0;

        groups.forEach((group) => {
            const detail = buildGroupDetails(group, tickerValues, portfolioTotal);
            details.set(group.id, detail);
            detail.tickers.forEach((ticker) => assignedTickers.add(ticker));
            assignedValue += detail.totalValue;
        });

        const unassignedTickers = Array.from(tickerValues.keys())
            .filter((ticker) => !assignedTickers.has(ticker))
            .sort();

        return {
            tickerValues,
            portfolioTotal,
            unassignedTickers,
            groupDetails: details,
            assignedValue,
        };
    }, [positions, groups, includeOptions]);

    useEffect(() => {
        if (isCreatingNew || editingGroupId) return;
        if (selectedGroupId === UNASSIGNED_ID) return;
        if (selectedGroupId && groups.some((g) => g.id === selectedGroupId)) return;

        if (groups.length > 0) {
            setSelectedGroupId(groups[0].id);
        } else if (unassignedTickers.length > 0) {
            setSelectedGroupId(UNASSIGNED_ID);
        } else {
            setSelectedGroupId(null);
        }
    }, [
        groups,
        selectedGroupId,
        unassignedTickers.length,
        isCreatingNew,
        editingGroupId,
    ]);

    const portfolioTickers = useMemo(
        () => Array.from(tickerValues.keys()).sort(),
        [tickerValues]
    );

    const handleCreateGroup = () => {
        setIsCreatingNew(true);
        setEditingGroupId(null);
    };

    const handleResetGroups = () => {
        if (confirm("Clear all categorical groups and start fresh?")) {
            setGroups([]);
            setEditingGroupId(null);
            setIsCreatingNew(false);
            setSelectedGroupId(null);
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (e) {
                console.error("Failed to clear categorical groups", e);
            }
        }
    };

    const handleSaveGroup = (groupData: {
        name: string;
        tickers: string[];
        subGroups: Record<string, string>;
    }) => {
        const cleanedTickers = uniqueTickers(groupData.tickers);
        const subGroups = normalizeSubGroupMap(cleanedTickers, groupData.subGroups);
        let nextGroups = [...groups];
        let savedGroupId = editingGroupId;

        if (editingGroupId) {
            nextGroups = nextGroups.map((group) =>
                group.id === editingGroupId
                    ? {
                          ...group,
                          name: groupData.name.trim(),
                          tickers: cleanedTickers,
                          subGroups,
                      }
                    : group
            );
        } else {
            const newGroup: CategoricalGroup = {
                id: Date.now().toString(),
                name: groupData.name.trim(),
                tickers: cleanedTickers,
                subGroups,
            };
            savedGroupId = newGroup.id;
            nextGroups = [...nextGroups, newGroup];
        }

        if (savedGroupId) {
            const assignedSet = new Set(cleanedTickers);
            nextGroups = nextGroups.map((group) => {
                if (group.id === savedGroupId) return group;
                const filteredTickers = group.tickers.filter(
                    (ticker) => !assignedSet.has(normalizeTicker(ticker))
                );
                if (filteredTickers.length === group.tickers.length) return group;
                const filteredSubGroups = normalizeSubGroupMap(
                    filteredTickers,
                    group.subGroups
                );
                return {
                    ...group,
                    tickers: filteredTickers,
                    subGroups: filteredSubGroups,
                };
            });
        }

        setGroups(nextGroups);
        setEditingGroupId(null);
        setIsCreatingNew(false);
        if (savedGroupId) {
            setSelectedGroupId(savedGroupId);
        }
    };

    const handleDeleteGroup = (id: string) => {
        if (confirm("Are you sure you want to delete this group?")) {
            setGroups((prev) => prev.filter((g) => g.id !== id));
            if (selectedGroupId === id) {
                setSelectedGroupId(null);
            }
        }
    };

    const handleCancelEdit = () => {
        setEditingGroupId(null);
        setIsCreatingNew(false);
    };

    const selectedDetails = useMemo(() => {
        if (selectedGroupId === UNASSIGNED_ID) {
            return buildUnassignedDetails(
                unassignedTickers,
                tickerValues,
                portfolioTotal
            );
        }
        if (selectedGroupId) {
            return groupDetails.get(selectedGroupId) || null;
        }
        return null;
    }, [
        selectedGroupId,
        unassignedTickers,
        tickerValues,
        portfolioTotal,
        groupDetails,
    ]);

    const assignedCoverage =
        portfolioTotal > 0 ? (assignedValue / portfolioTotal) * 100 : 0;

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm mb-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white">
                        Categorical Analysis
                    </h2>
                    <p className="text-sm text-slate-400">
                        Build custom groups to compare allocation between
                        categories and drill into what makes up each group.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-700/60 px-3 py-2 rounded-lg">
                        <input
                            type="checkbox"
                            checked={includeOptions}
                            onChange={(e) => setIncludeOptions(e.target.checked)}
                            className="accent-blue-500"
                        />
                        Include options
                    </label>
                    <button
                        onClick={handleResetGroups}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-700/60 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors text-sm font-medium"
                    >
                        <Trash2 className="h-4 w-4" />
                        Reset Groups
                    </button>
                    <button
                        onClick={handleCreateGroup}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                        <Plus className="h-4 w-4" />
                        Add Group
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-4 lg:col-span-1">
                    <div className="bg-slate-750 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-white">
                                    Group Comparison
                                </h3>
                                <p className="text-xs text-slate-400">
                                    Assigned: {assignedCoverage.toFixed(1)}%
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-slate-400">
                                    Total
                                </div>
                                <div className="text-sm text-white font-semibold">
                                    {formatCurrency(portfolioTotal)}
                                </div>
                            </div>
                        </div>

                        {groups.length === 0 && unassignedTickers.length === 0 && (
                            <div className="text-sm text-slate-400 py-4">
                                No positions available for grouping.
                            </div>
                        )}

                        <div className="space-y-2">
                            {groups.map((group) => {
                                const details = groupDetails.get(group.id);
                                if (!details) return null;
                                const isSelected = selectedGroupId === group.id;
                                return (
                                    <div
                                        key={group.id}
                                        className={`border rounded-lg p-3 transition-colors ${
                                            isSelected
                                                ? "border-blue-500/70 bg-blue-500/10"
                                                : "border-slate-700 bg-slate-800/60 hover:bg-slate-700/60"
                                        }`}
                                        onClick={() => {
                                            setSelectedGroupId(group.id);
                                            setEditingGroupId(null);
                                            setIsCreatingNew(false);
                                        }}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="text-sm font-semibold text-white">
                                                    {details.name}
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {details.tickers.length} tickers
                                                    {details.missingTickers.length > 0
                                                        ? ` · ${details.missingTickers.length} missing`
                                                        : ""}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setEditingGroupId(group.id);
                                                        setIsCreatingNew(false);
                                                        setSelectedGroupId(group.id);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded"
                                                    title="Edit Group"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleDeleteGroup(group.id);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded"
                                                    title="Delete Group"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                                                <span>
                                                    {formatCurrency(details.totalValue)}
                                                </span>
                                                <span>
                                                    {formatPercentageOfPortfolio(
                                                        details.percentageOfPortfolio
                                                    )}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full"
                                                    style={{
                                                        width: `${Math.min(
                                                            details.percentageOfPortfolio,
                                                            100
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {unassignedTickers.length > 0 && (
                                <div
                                    className={`border rounded-lg p-3 transition-colors ${
                                        selectedGroupId === UNASSIGNED_ID
                                            ? "border-amber-400/70 bg-amber-500/10"
                                            : "border-slate-700 bg-slate-800/60 hover:bg-slate-700/60"
                                    }`}
                                    onClick={() => {
                                        setSelectedGroupId(UNASSIGNED_ID);
                                        setEditingGroupId(null);
                                        setIsCreatingNew(false);
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="text-sm font-semibold text-white">
                                                Unassigned
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {unassignedTickers.length} tickers
                                            </div>
                                        </div>
                                        <div className="text-xs text-amber-300">
                                            Needs grouping
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {groups.length === 0 && !isCreatingNew && (
                        <div className="text-sm text-slate-400 bg-slate-750 border border-slate-700 rounded-lg p-4">
                            <p className="mb-2">No groups yet.</p>
                            <p className="text-xs">
                                Add a group to start comparing allocation between
                                custom categories.
                            </p>
                        </div>
                    )}
                </div>

                <div className="space-y-4 lg:col-span-2">
                    {isCreatingNew && (
                        <div className="bg-slate-750 border border-slate-700 rounded-lg p-4">
                            <GroupEditor
                                portfolioTickers={portfolioTickers}
                                allGroups={groups}
                                currentGroupId={null}
                                onSave={handleSaveGroup}
                                onCancel={handleCancelEdit}
                            />
                        </div>
                    )}

                    {!isCreatingNew && editingGroupId && (
                        <div className="bg-slate-750 border border-slate-700 rounded-lg p-4">
                            <GroupEditor
                                portfolioTickers={portfolioTickers}
                                allGroups={groups}
                                currentGroupId={editingGroupId}
                                initialData={groups.find(
                                    (group) => group.id === editingGroupId
                                )}
                                onSave={handleSaveGroup}
                                onCancel={handleCancelEdit}
                            />
                        </div>
                    )}

                    {!isCreatingNew && !editingGroupId && selectedDetails && (
                        <GroupDetail
                            details={selectedDetails}
                            isUnassigned={selectedDetails.id === UNASSIGNED_ID}
                        />
                    )}

                    {!isCreatingNew && !editingGroupId && !selectedDetails && (
                        <div className="bg-slate-750 border border-slate-700 rounded-lg p-6 text-sm text-slate-400">
                            Select a group to see its breakdown, or create a new
                            group to start comparing allocations.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface GroupDetailProps {
    details: GroupDetails;
    isUnassigned: boolean;
}

const GroupDetail: React.FC<GroupDetailProps> = ({ details, isUnassigned }) => {
    return (
        <div className="bg-slate-750 border border-slate-700 rounded-lg p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h3 className="text-base font-semibold text-white">
                        {details.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                        {details.tickers.length} tickers ·{" "}
                        {formatCurrency(details.totalValue)} ·{" "}
                        {formatPercentageOfPortfolio(
                            details.percentageOfPortfolio
                        )}
                    </p>
                </div>
                {details.missingTickers.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/40 px-3 py-2 rounded-lg">
                        <AlertTriangle className="h-4 w-4" />
                        {details.missingTickers.length} ticker
                        {details.missingTickers.length !== 1 ? "s" : ""} not
                        in portfolio
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
                <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                    <div className="text-sm font-semibold text-white mb-3">
                        {isUnassigned ? "Unassigned Breakdown" : "Group Breakdown"}
                    </div>
                    <div className="h-[360px]">
                        <GroupChart
                            data={details.chartData}
                            emptyMessage={
                                isUnassigned
                                    ? "All unassigned tickers currently have 0 market value."
                                    : "No market value in this group yet."
                            }
                        />
                    </div>
                </div>

                <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                    <div className="text-sm font-semibold text-white mb-3">
                        Members
                    </div>
                    {details.members.length === 0 ? (
                        <div className="text-sm text-slate-400">
                            No tickers in this group yet.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                            {details.members.map((member) => (
                                <div
                                    key={member.ticker}
                                    className="flex items-center justify-between gap-3 border border-slate-700/70 rounded-lg px-3 py-2"
                                >
                                    <div>
                                        <div className="text-sm text-white font-semibold">
                                            {member.ticker}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {formatPercentageOfPortfolio(
                                                member.percentageOfGroup
                                            )} of group ·{" "}
                                            {formatPercentageOfPortfolio(
                                                member.percentageOfPortfolio
                                            )} of portfolio
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-white font-semibold">
                                            {formatCurrency(member.value)}
                                        </div>
                                        {member.isMissing && (
                                            <div className="text-xs text-amber-300">
                                                Missing
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface GroupEditorProps {
    portfolioTickers: string[];
    allGroups: CategoricalGroup[];
    currentGroupId: string | null;
    initialData?: CategoricalGroup;
    onSave: (data: {
        name: string;
        tickers: string[];
        subGroups: Record<string, string>;
    }) => void;
    onCancel: () => void;
}

const GroupEditor: React.FC<GroupEditorProps> = ({
    portfolioTickers,
    allGroups,
    currentGroupId,
    initialData,
    onSave,
    onCancel,
}) => {
    const initialTickers = uniqueTickers(initialData?.tickers || []);
    const [name, setName] = useState(initialData?.name || "");
    const [tickers, setTickers] = useState<string[]>(initialTickers);
    const [subGroups, setSubGroups] = useState<Record<string, string>>(
        normalizeSubGroupMap(initialTickers, initialData?.subGroups)
    );
    const [tickerInput, setTickerInput] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);

    const otherGroupTickers = useMemo(() => {
        const used = new Set<string>();
        allGroups.forEach((group) => {
            if (group.id === currentGroupId) return;
            group.tickers.forEach((ticker) => used.add(normalizeTicker(ticker)));
        });
        return used;
    }, [allGroups, currentGroupId]);

    const availableTickers = useMemo(
        () =>
            portfolioTickers.filter(
                (ticker) => !otherGroupTickers.has(normalizeTicker(ticker))
            ),
        [portfolioTickers, otherGroupTickers]
    );

    const selectedSet = useMemo(
        () => new Set(tickers.map((ticker) => normalizeTicker(ticker))),
        [tickers]
    );

    const filteredTickers = useMemo(() => {
        const query = tickerInput.trim().toLowerCase();
        if (!query) {
            return availableTickers.filter(
                (ticker) => !selectedSet.has(normalizeTicker(ticker))
            );
        }
        return availableTickers.filter(
            (ticker) =>
                ticker.toLowerCase().includes(query) &&
                !selectedSet.has(normalizeTicker(ticker))
        );
    }, [availableTickers, tickerInput, selectedSet]);

    const conflictingTickers = tickers.filter((ticker) =>
        otherGroupTickers.has(normalizeTicker(ticker))
    );

    useEffect(() => {
        setSubGroups((prev) => {
            const next = { ...prev };
            const tickerSet = new Set(tickers);
            tickers.forEach((ticker) => {
                if (!next[ticker]) {
                    next[ticker] = ticker;
                }
            });
            Object.keys(next).forEach((key) => {
                if (!tickerSet.has(key)) {
                    delete next[key];
                }
            });
            return next;
        });
    }, [tickers]);

    const handleAddTicker = (ticker: string) => {
        const normalized = normalizeTicker(ticker);
        if (!normalized || selectedSet.has(normalized)) return;
        setTickers((prev) => [...prev, normalized]);
        setTickerInput("");
    };

    const handleAddManualTickers = () => {
        if (!tickerInput.trim()) return;
        const inputTickers = tickerInput
            .split(/[\s,\n]+/)
            .map((entry) => normalizeTicker(entry))
            .filter(Boolean);

        if (inputTickers.length === 0) return;

        setTickers((prev) => {
            const next = new Set(prev.map(normalizeTicker));
            inputTickers.forEach((ticker) => next.add(ticker));
            return Array.from(next);
        });
        setTickerInput("");
    };

    const handleRemoveTicker = (ticker: string) => {
        setTickers((prev) => prev.filter((entry) => entry !== ticker));
        setSubGroups((prev) => {
            const next = { ...prev };
            delete next[ticker];
            return next;
        });
    };

    const handleAddRemainingAsOthers = () => {
        const remaining = availableTickers.filter(
            (ticker) => !selectedSet.has(normalizeTicker(ticker))
        );
        if (remaining.length === 0) return;

        setTickers((prev) => {
            const next = new Set(prev.map(normalizeTicker));
            remaining.forEach((ticker) => next.add(normalizeTicker(ticker)));
            return Array.from(next);
        });
        setSubGroups((prev) => {
            const next = { ...prev };
            remaining.forEach((ticker) => {
                next[normalizeTicker(ticker)] = OTHERS_SUBGROUP_NAME;
            });
            return next;
        });
    };

    const handleSave = () => {
        if (!name.trim()) {
            alert("Please enter a group name");
            return;
        }
        if (tickers.length === 0) {
            alert("Please add at least one ticker");
            return;
        }

        onSave({
            name: name.trim(),
            tickers,
            subGroups,
        });
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Group Name
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Core Tech"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Tickers
                </label>
                <p className="text-xs text-slate-400 mb-2">
                    Tick each position to this group. Tickers are kept unique
                    across groups for clean comparisons.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex-1">
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={tickerInput}
                                onChange={(e) => setTickerInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddManualTickers();
                                    }
                                }}
                                placeholder="Search portfolio tickers or paste custom tickers"
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleAddManualTickers}
                                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm"
                            >
                                Add
                            </button>
                        </div>

                        {filteredTickers.length > 0 && (
                            <div className="bg-slate-700/70 border border-slate-600 rounded-lg max-h-48 overflow-y-auto">
                                {filteredTickers.map((ticker) => (
                                    <button
                                        key={ticker}
                                        onClick={() => handleAddTicker(ticker)}
                                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-600 transition-colors"
                                    >
                                        {ticker}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-shrink-0">
                        <button
                            type="button"
                            onClick={handleAddRemainingAsOthers}
                            className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm w-full"
                        >
                            Add Unassigned as Others
                        </button>
                    </div>
                </div>

                {conflictingTickers.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/40 px-3 py-2 rounded-lg">
                        <AlertTriangle className="h-4 w-4 mt-0.5" />
                        These tickers are already in another group and will be
                        moved here on save: {conflictingTickers.join(", ")}
                    </div>
                )}

                {tickers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {tickers.map((ticker) => (
                            <span
                                key={ticker}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-600 text-white rounded text-sm"
                            >
                                {ticker}
                                <button
                                    onClick={() => handleRemoveTicker(ticker)}
                                    className="hover:text-red-400 transition-colors"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="text-xs text-slate-300 hover:text-white underline"
            >
                {showAdvanced ? "Hide" : "Show"} advanced sub-group mapping
            </button>

            {showAdvanced && tickers.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Sub-group Mapping
                    </label>
                    <p className="text-xs text-slate-400 mb-2">
                        Combine tickers under a shared label to see grouped
                        tiles in the breakdown.
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {tickers.map((ticker) => (
                            <div
                                key={ticker}
                                className="flex items-center gap-2 bg-slate-700 p-2 rounded"
                            >
                                <span className="text-white text-sm w-20 flex-shrink-0">
                                    {ticker}:
                                </span>
                                <input
                                    type="text"
                                    value={subGroups[ticker] || ticker}
                                    onChange={(e) =>
                                        setSubGroups({
                                            ...subGroups,
                                            [ticker]:
                                                e.target.value.trim() || ticker,
                                        })
                                    }
                                    className="flex-1 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder={ticker}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors text-sm"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                >
                    <Check className="h-4 w-4" />
                    Save
                </button>
            </div>
        </div>
    );
};

export default CategoricalAnalysis;
