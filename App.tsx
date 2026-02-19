import React, { useState, useEffect } from "react";
import { parseJSONData } from "./utils/dataParser";
import { AccountData, PositionData } from "./types";
import SummaryCard from "./components/SummaryCard";
import PositionsTable from "./components/PositionsTable";
import PortfolioChart from "./components/PortfolioChart";
import CategoricalAnalysis from "./components/CategoricalAnalysis";
import FileDropZone from "./components/FileDropZone";
import { Trash2, Maximize2, Minimize2 } from "lucide-react";

const APP_NAME = "Alloc";
const STORAGE_KEY = `${APP_NAME}_json_data`;
const FULL_WIDTH_STORAGE_KEY = `${APP_NAME}_full_width_preference`;
const FAVICON_PATH = `${import.meta.env.BASE_URL}android-chrome-512x512.png`;

const App: React.FC = () => {
    const [account, setAccount] = useState<AccountData | null>(null);
    const [positions, setPositions] = useState<PositionData[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);
    const [isLoadingFromStorage, setIsLoadingFromStorage] = useState(true);
    const [isFullWidth, setIsFullWidth] = useState<boolean>(false);

    // Load data from localStorage on mount
    useEffect(() => {
        const loadFromStorage = () => {
            try {
                const storedJSON = localStorage.getItem(STORAGE_KEY);

                if (storedJSON) {
                    // Try to parse the stored JSON data
                    const { account, positions } = parseJSONData(storedJSON);

                    if (account && positions && positions.length > 0) {
                        setAccount(account);
                        setPositions(positions);
                    } else {
                        // Stored data is invalid, clear it
                        localStorage.removeItem(STORAGE_KEY);
                    }
                }

                // Load full-width preference
                const fullWidthPreference = localStorage.getItem(
                    FULL_WIDTH_STORAGE_KEY,
                );
                if (fullWidthPreference !== null) {
                    setIsFullWidth(fullWidthPreference === "true");
                }
            } catch (e) {
                console.error("Failed to load data from localStorage", e);
                // Clear corrupted data
                localStorage.removeItem(STORAGE_KEY);
            } finally {
                setIsLoadingFromStorage(false);
            }
        };

        loadFromStorage();
    }, []);

    const handleFileLoaded = (jsonContent: string) => {
        try {
            setParseError(null);

            const { account, positions } = parseJSONData(jsonContent);

            if (!account) {
                throw new Error(
                    "Failed to parse account data. Please check the file format.",
                );
            }

            if (!positions || positions.length === 0) {
                throw new Error(
                    "Failed to parse positions data or file is empty. Please check the file format.",
                );
            }

            // Save to localStorage
            localStorage.setItem(STORAGE_KEY, jsonContent);

            setAccount(account);
            setPositions(positions);
        } catch (e) {
            const errorMessage =
                e instanceof Error
                    ? e.message
                    : "Failed to parse data. Please check your JSON file.";
            setParseError(errorMessage);
            console.error("Failed to parse data", e);
        }
    };

    const handleError = (error: string) => {
        setParseError(error);
    };

    const handleReset = () => {
        setAccount(null);
        setPositions([]);
        setParseError(null);
        // Clear localStorage
        localStorage.removeItem(STORAGE_KEY);
    };

    const handleToggleFullWidth = () => {
        const newValue = !isFullWidth;
        setIsFullWidth(newValue);
        localStorage.setItem(FULL_WIDTH_STORAGE_KEY, String(newValue));
    };

    // Show loading state while checking localStorage
    if (isLoadingFromStorage) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-blue-500 animate-pulse text-xl font-semibold">
                    Loading Portfolio Data...
                </div>
            </div>
        );
    }

    // Show drag and drop interface if no account data is loaded
    if (!account) {
        return (
            <FileDropZone
                onFileLoaded={handleFileLoaded}
                onError={handleError}
                parseError={parseError}
            />
        );
    }

    // Calculate some aggregate totals that might be missing or useful
    const totalDailyPL = positions.reduce(
        (acc, curr) => acc + curr.today_pl_val,
        0,
    );
    const totalUnrealizedPL = positions.reduce(
        (acc, curr) => acc + curr.unrealized_pl,
        0,
    );

    return (
        <div className="min-h-screen bg-slate-900 pb-12">
            {/* Header */}
            <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
                <div
                    className={`${
                        isFullWidth ? "max-w-full" : "max-w-7xl"
                    } mx-auto px-4 sm:px-6 lg:px-8`}
                >
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-2">
                            <img
                                src={FAVICON_PATH}
                                alt="Alloc logo"
                                className="h-7 w-7 rounded-sm"
                            />
                            <span className="font-bold text-xl text-white tracking-tight">
                                <span className="text-blue-500">Alloc</span>{" "}
                                Dashboard
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <button
                                onClick={handleToggleFullWidth}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                                title={
                                    isFullWidth
                                        ? "Use Constrained Width"
                                        : "Use Full Width"
                                }
                            >
                                {isFullWidth ? (
                                    <Minimize2 className="h-4 w-4" />
                                ) : (
                                    <Maximize2 className="h-4 w-4" />
                                )}
                                <span className="hidden sm:inline">
                                    {isFullWidth ? "Constrained" : "Full Width"}
                                </span>
                            </button>
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                                title="Clear Data"
                            >
                                <Trash2 className="h-4 w-4" />
                                <span className="hidden sm:inline">
                                    Clear Data
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main
                className={`${
                    isFullWidth ? "max-w-full" : "max-w-7xl"
                } mx-auto px-4 sm:px-6 lg:px-8 pt-8`}
            >
                {/* Account Summary */}
                <section className="mb-2">
                    {/* <div className="flex justify-between items-end mb-4">
                        <h1 className="text-2xl font-bold text-white">
                            Overview
                        </h1>
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                            Currency: {account.currency}
                        </span>
                    </div> */}
                    <SummaryCard account={account} />
                </section>

                {/* Charts Section */}
                <section className="mb-8">
                    <PortfolioChart positions={positions} />
                </section>

                {/* Positions Table */}
                <section className="mb-8">
                    <PositionsTable positions={positions} />
                </section>

                {/* Categorical Analysis */}
                <section>
                    <CategoricalAnalysis positions={positions} />
                </section>
            </main>
        </div>
    );
};

export default App;
