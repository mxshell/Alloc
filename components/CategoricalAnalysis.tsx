import React, { useState, useEffect } from "react";
import { PositionData, CategoricalGroup } from "../types";
import {
    getAvailableTickers,
    validateTickers,
    extractTicker,
} from "../utils/dataParser";
import GroupChart from "./GroupChart";
import {
    Plus,
    Edit2,
    Trash2,
    X,
    Check,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

interface CategoricalAnalysisProps {
    positions: PositionData[];
}

const STORAGE_KEY = "Alloc_categorical_groups";

const CategoricalAnalysis: React.FC<CategoricalAnalysisProps> = ({
    positions,
}) => {
    const [groups, setGroups] = useState<CategoricalGroup[]>([]);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set()
    );
    const [hasLoaded, setHasLoaded] = useState(false);

    // Load groups from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setGroups(parsed);
                    // Expand all groups by default
                    setExpandedGroups(new Set(parsed.map((g) => g.id)));
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

    // Save groups to localStorage whenever they change (but only after initial load)
    useEffect(() => {
        if (!hasLoaded) return; // Don't save until we've loaded from localStorage

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
        } catch (e) {
            console.error(
                "Failed to save categorical groups to localStorage",
                e
            );
        }
    }, [groups, hasLoaded]);

    const availableTickers = getAvailableTickers(positions);

    const handleCreateGroup = () => {
        setIsCreatingNew(true);
        setEditingGroupId(null);
    };

    const handleSaveGroup = (groupData: {
        name: string;
        tickers: string[];
        subGroups: Record<string, string>;
    }) => {
        if (editingGroupId) {
            // Update existing group
            setGroups((prev) =>
                prev.map((g) =>
                    g.id === editingGroupId ? { ...g, ...groupData } : g
                )
            );
            setEditingGroupId(null);
        } else {
            // Create new group
            const newGroup: CategoricalGroup = {
                id: Date.now().toString(),
                ...groupData,
            };
            setGroups((prev) => [...prev, newGroup]);
            setExpandedGroups((prev) => new Set([...prev, newGroup.id]));
            setIsCreatingNew(false);
        }
    };

    const handleDeleteGroup = (id: string) => {
        if (confirm("Are you sure you want to delete this group?")) {
            setGroups((prev) => prev.filter((g) => g.id !== id));
            setExpandedGroups((prev) => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        }
    };

    const handleCancelEdit = () => {
        setEditingGroupId(null);
        setIsCreatingNew(false);
    };

    const toggleGroupExpanded = (id: string) => {
        setExpandedGroups((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-sm mb-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white">
                        Categorical Analysis
                    </h2>
                    <p className="text-sm text-slate-400">
                        Create custom groupings to analyze asset allocation
                        within specific categories.
                    </p>
                </div>
                <button
                    onClick={handleCreateGroup}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus className="h-4 w-4" />
                    Add Group
                </button>
            </div>

            {isCreatingNew && (
                <GroupEditor
                    positions={positions}
                    availableTickers={availableTickers}
                    onSave={handleSaveGroup}
                    onCancel={handleCancelEdit}
                />
            )}

            {groups.length === 0 && !isCreatingNew && (
                <div className="text-center py-8 text-slate-400">
                    <p className="mb-2">No categorical groups defined yet.</p>
                    <p className="text-sm">
                        Click "Add Group" to create your first analysis group.
                    </p>
                </div>
            )}

            <div className="space-y-4">
                {groups.map((group) => (
                    <GroupCard
                        key={group.id}
                        group={group}
                        positions={positions}
                        availableTickers={availableTickers}
                        isEditing={editingGroupId === group.id}
                        isExpanded={expandedGroups.has(group.id)}
                        onEdit={() => setEditingGroupId(group.id)}
                        onSave={handleSaveGroup}
                        onCancel={handleCancelEdit}
                        onDelete={() => handleDeleteGroup(group.id)}
                        onToggleExpanded={() => toggleGroupExpanded(group.id)}
                    />
                ))}
            </div>
        </div>
    );
};

interface GroupCardProps {
    group: CategoricalGroup;
    positions: PositionData[];
    availableTickers: string[];
    isEditing: boolean;
    isExpanded: boolean;
    onEdit: () => void;
    onSave: (data: {
        name: string;
        tickers: string[];
        subGroups: Record<string, string>;
    }) => void;
    onCancel: () => void;
    onDelete: () => void;
    onToggleExpanded: () => void;
}

const GroupCard: React.FC<GroupCardProps> = ({
    group,
    positions,
    availableTickers,
    isEditing,
    isExpanded,
    onEdit,
    onSave,
    onCancel,
    onDelete,
    onToggleExpanded,
}) => {
    if (isEditing) {
        return (
            <div className="bg-slate-750 border border-slate-600 rounded-lg p-4">
                <GroupEditor
                    positions={positions}
                    availableTickers={availableTickers}
                    initialData={group}
                    onSave={onSave}
                    onCancel={onCancel}
                />
            </div>
        );
    }

    return (
        <div className="bg-slate-750 border border-slate-600 rounded-lg overflow-hidden">
            <div className="p-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onToggleExpanded}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            {isExpanded ? (
                                <ChevronUp className="h-5 w-5" />
                            ) : (
                                <ChevronDown className="h-5 w-5" />
                            )}
                        </button>
                        <h3 className="text-base font-semibold text-white">
                            {group.name}
                        </h3>
                        <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
                            {group.tickers.length} ticker
                            {group.tickers.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onEdit}
                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                            title="Edit Group"
                        >
                            <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                            title="Delete Group"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4">
                    <GroupChart positions={positions} group={group} />
                </div>
            )}
        </div>
    );
};

interface GroupEditorProps {
    positions: PositionData[];
    availableTickers: string[];
    initialData?: CategoricalGroup;
    onSave: (data: {
        name: string;
        tickers: string[];
        subGroups: Record<string, string>;
    }) => void;
    onCancel: () => void;
}

const GroupEditor: React.FC<GroupEditorProps> = ({
    positions,
    availableTickers,
    initialData,
    onSave,
    onCancel,
}) => {
    const [name, setName] = useState(initialData?.name || "");
    const [tickers, setTickers] = useState<string[]>(
        initialData?.tickers || []
    );
    const [subGroups, setSubGroups] = useState<Record<string, string>>(
        initialData?.subGroups || {}
    );
    const [tickerInput, setTickerInput] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [manualInputMode, setManualInputMode] = useState(false);

    // Initialize sub-groups when tickers change (if not already set)
    useEffect(() => {
        const newSubGroups: Record<string, string> = { ...subGroups };
        tickers.forEach((ticker) => {
            if (!newSubGroups[ticker]) {
                newSubGroups[ticker] = ticker; // Default: ticker is its own sub-group
            }
        });
        // Remove sub-groups for tickers that are no longer in the list
        Object.keys(newSubGroups).forEach((key) => {
            if (!tickers.includes(key)) {
                delete newSubGroups[key];
            }
        });
        setSubGroups(newSubGroups);
    }, [tickers]);

    const handleAddTicker = (ticker: string) => {
        const upperTicker = ticker.toUpperCase().trim();
        if (upperTicker && !tickers.includes(upperTicker)) {
            setTickers([...tickers, upperTicker]);
            setTickerInput("");
            setShowDropdown(false);
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && tickerInput.trim()) {
            e.preventDefault();
            if (manualInputMode) {
                handleManualInput();
            } else {
                // In dropdown mode, add the first filtered ticker or the typed value
                const upperTicker = tickerInput.trim().toUpperCase();
                if (filteredTickers.length > 0) {
                    handleAddTicker(filteredTickers[0]);
                } else if (upperTicker && !tickers.includes(upperTicker)) {
                    handleAddTicker(upperTicker);
                }
            }
        }
    };

    const handleRemoveTicker = (ticker: string) => {
        setTickers(tickers.filter((t) => t !== ticker));
    };

    const handleManualInput = () => {
        const inputTickers = tickerInput
            .split(/[,\n]/)
            .map((t) => t.trim().toUpperCase())
            .filter((t) => t); // Allow any ticker, not just those in portfolio

        inputTickers.forEach((ticker) => {
            if (!tickers.includes(ticker)) {
                setTickers([...tickers, ticker]);
            }
        });
        setTickerInput("");
        setManualInputMode(false);
    };

    const filteredTickers = availableTickers.filter(
        (t) =>
            t.toLowerCase().includes(tickerInput.toLowerCase()) &&
            !tickers.includes(t)
    );

    const handleSave = () => {
        if (!name.trim()) {
            alert("Please enter a group name");
            return;
        }
        if (tickers.length === 0) {
            alert("Please add at least one ticker");
            return;
        }
        onSave({ name: name.trim(), tickers, subGroups });
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
                    placeholder="e.g., Mag-7 Positions"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                    Tickers
                </label>
                <p className="text-xs text-slate-400 mb-2">
                    You can add any ticker, even if it's not currently in your
                    portfolio. Tickers not in your portfolio will show 0%
                    allocation.
                </p>
                <div className="flex gap-2 mb-2">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={tickerInput}
                            onChange={(e) => {
                                setTickerInput(e.target.value);
                                setShowDropdown(true);
                            }}
                            onFocus={() => setShowDropdown(true)}
                            onKeyDown={handleInputKeyDown}
                            placeholder={
                                manualInputMode
                                    ? "Enter tickers (comma or line separated, any ticker allowed)"
                                    : "Type to search, select from dropdown, or press Enter to add any ticker"
                            }
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {showDropdown &&
                            !manualInputMode &&
                            filteredTickers.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {filteredTickers.map((ticker) => (
                                        <button
                                            key={ticker}
                                            onClick={() =>
                                                handleAddTicker(ticker)
                                            }
                                            className="w-full text-left px-3 py-2 text-white hover:bg-slate-600 transition-colors"
                                        >
                                            {ticker}
                                        </button>
                                    ))}
                                </div>
                            )}
                    </div>
                    <button
                        onClick={() => {
                            setManualInputMode(!manualInputMode);
                            setShowDropdown(false);
                        }}
                        className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-colors"
                    >
                        {manualInputMode ? "Dropdown" : "Manual"}
                    </button>
                    {manualInputMode && (
                        <button
                            onClick={handleManualInput}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                        >
                            Add
                        </button>
                    )}
                </div>

                {tickers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {tickers.map((ticker) => (
                            <span
                                key={ticker}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-600 text-white rounded text-sm"
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

            {tickers.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Sub-group Mapping
                    </label>
                    <p className="text-xs text-slate-400 mb-2">
                        Assign each ticker to a sub-group. Multiple tickers can
                        share the same sub-group name.
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
