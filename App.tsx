import React, { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Maximize2, Minimize2, Trash2 } from "lucide-react";
import { parseJSONData } from "./utils/dataParser";
import { AccountData, PositionData } from "./types";
import SummaryCard from "./components/SummaryCard";
import FileDropZone from "./components/FileDropZone";

const PortfolioChart = lazy(() => import("./components/PortfolioChart"));
const TargetAllocationPlanner = lazy(
    () => import("./components/TargetAllocationPlanner"),
);
const PositionsTable = lazy(() => import("./components/PositionsTable"));
const CategoricalAnalysis = lazy(
    () => import("./components/CategoricalAnalysis"),
);

const APP_NAME = "Alloc";
const STORAGE_KEY = `${APP_NAME}_json_data`;
const FULL_WIDTH_STORAGE_KEY = `${APP_NAME}_full_width_preference`;
const FAVICON_PATH = `${import.meta.env.BASE_URL}android-chrome-512x512.png`;

interface ParsedPortfolioData {
    account: AccountData;
    positions: PositionData[];
}

const parsePortfolioData = (jsonContent: string): ParsedPortfolioData => {
    const { account, positions } = parseJSONData(jsonContent);

    if (!account) {
        throw new Error(
            "Failed to parse account data. Please check the file format.",
        );
    }

    if (positions.length === 0) {
        throw new Error(
            "Failed to parse positions data or file is empty. Please check the file format.",
        );
    }

    return { account, positions };
};

const DashboardFallback = () => (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-8 text-center text-sm text-slate-400">
        Loading dashboard sections...
    </div>
);

const LoadingScreen = () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="animate-pulse text-xl font-semibold text-blue-500">
            Loading portfolio data...
        </div>
    </div>
);

const App: React.FC = () => {
    const [account, setAccount] = useState<AccountData | null>(null);
    const [positions, setPositions] = useState<PositionData[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);
    const [isLoadingFromStorage, setIsLoadingFromStorage] = useState(true);
    const [isFullWidth, setIsFullWidth] = useState(false);

    useEffect(() => {
        try {
            const storedJSON = localStorage.getItem(STORAGE_KEY);
            if (storedJSON) {
                try {
                    const parsed = parsePortfolioData(storedJSON);
                    setAccount(parsed.account);
                    setPositions(parsed.positions);
                } catch (error) {
                    console.error("Stored portfolio data is invalid", error);
                    localStorage.removeItem(STORAGE_KEY);
                }
            }

            const fullWidthPreference = localStorage.getItem(
                FULL_WIDTH_STORAGE_KEY,
            );
            if (fullWidthPreference !== null) {
                setIsFullWidth(fullWidthPreference === "true");
            }
        } catch (error) {
            console.error("Failed to load data from localStorage", error);
            localStorage.removeItem(STORAGE_KEY);
        } finally {
            setIsLoadingFromStorage(false);
        }
    }, []);

    const handleFileLoaded = useCallback((jsonContent: string) => {
        try {
            setParseError(null);

            const parsed = parsePortfolioData(jsonContent);
            localStorage.setItem(STORAGE_KEY, jsonContent);
            setAccount(parsed.account);
            setPositions(parsed.positions);
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to parse data. Please check your JSON file.";

            setParseError(errorMessage);
            console.error("Failed to parse data", error);
        }
    }, []);

    const handleReset = useCallback(() => {
        setAccount(null);
        setPositions([]);
        setParseError(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    const handleToggleFullWidth = useCallback(() => {
        setIsFullWidth((current) => {
            const next = !current;
            localStorage.setItem(FULL_WIDTH_STORAGE_KEY, String(next));
            return next;
        });
    }, []);

    if (isLoadingFromStorage) {
        return <LoadingScreen />;
    }

    if (!account) {
        return (
            <FileDropZone
                onFileLoaded={handleFileLoaded}
                onError={setParseError}
                parseError={parseError}
            />
        );
    }

    const widthClass = isFullWidth ? "max-w-full" : "max-w-7xl";

    return (
        <div className="min-h-screen bg-slate-900 pb-12">
            <nav className="sticky top-0 z-50 border-b border-slate-700 bg-slate-800">
                <div
                    className={`${widthClass} mx-auto px-4 sm:px-6 lg:px-8`}
                >
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-2">
                            <img
                                src={FAVICON_PATH}
                                alt="Alloc logo"
                                className="h-7 w-7 rounded-sm"
                            />
                            <span className="text-xl font-bold tracking-tight text-white">
                                <span className="text-blue-500">Alloc</span>{" "}
                                Dashboard
                            </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <button
                                type="button"
                                onClick={handleToggleFullWidth}
                                className="flex items-center gap-2 rounded-lg bg-slate-700/50 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
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
                                type="button"
                                onClick={handleReset}
                                className="flex items-center gap-2 rounded-lg bg-slate-700/50 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
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
                className={`${widthClass} mx-auto px-4 pt-8 sm:px-6 lg:px-8`}
            >
                <section className="mb-2">
                    <SummaryCard account={account} />
                </section>

                <Suspense fallback={<DashboardFallback />}>
                    <section className="mb-8">
                        <PortfolioChart positions={positions} />
                    </section>

                    <section className="mb-8">
                        <TargetAllocationPlanner
                            account={account}
                            positions={positions}
                        />
                    </section>

                    <section className="mb-8">
                        <PositionsTable positions={positions} />
                    </section>

                    <section>
                        <CategoricalAnalysis positions={positions} />
                    </section>
                </Suspense>
            </main>
        </div>
    );
};

export default App;
