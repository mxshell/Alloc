import React, { useCallback, useState } from "react";
import {
    Upload,
    FileText,
    AlertCircle,
    CheckCircle2,
    Sparkles,
} from "lucide-react";
import { generateDemoData } from "../utils/demoDataGenerator";

interface FileDropZoneProps {
    onFileLoaded: (jsonContent: string) => void;
    onError: (error: string) => void;
    parseError?: string | null;
}

const FAVICON_PATH = `${import.meta.env.BASE_URL}android-chrome-512x512.png`;

const FileDropZone: React.FC<FileDropZoneProps> = ({
    onFileLoaded,
    onError,
    parseError,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dataFile, setDataFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Use parseError from props if available, otherwise use local error state
    const displayError = parseError || error;

    const readFile = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                resolve(content);
            };
            reader.onerror = () =>
                reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsText(file);
        });
    };

    const handleFiles = useCallback(
        async (files: FileList | null) => {
            if (!files || files.length === 0) return;

            // Clear any previous errors
            setError(null);

            // Expect a single JSON file
            if (files.length > 1) {
                const errorMsg = "Please provide a single JSON file";
                setError(errorMsg);
                onError(errorMsg);
                return;
            }

            const file = files[0];
            const fileName = file.name.toLowerCase();

            // Validate file is JSON
            if (!fileName.endsWith(".json")) {
                const errorMsg =
                    "Please provide a JSON file (should end with .json)";
                setError(errorMsg);
                onError(errorMsg);
                return;
            }

            setDataFile(file);

            try {
                // Read the JSON file
                const jsonContent = await readFile(file);

                // Validate file is not empty
                if (!jsonContent.trim()) {
                    throw new Error("JSON file is empty");
                }

                // Validate it's valid JSON
                try {
                    JSON.parse(jsonContent);
                } catch (e) {
                    throw new Error(
                        "Invalid JSON format. Please check the file.",
                    );
                }

                // Pass to parent for parsing
                onFileLoaded(jsonContent);
            } catch (err) {
                const errorMsg =
                    err instanceof Error ? err.message : "Failed to read file";
                setError(errorMsg);
                onError(errorMsg);
                setDataFile(null);
            }
        },
        [onFileLoaded, onError],
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
        },
        [handleFiles],
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            handleFiles(e.target.files);
        },
        [handleFiles],
    );

    const handleDemoMode = useCallback(() => {
        setError(null);
        try {
            const demoData = generateDemoData();
            onFileLoaded(demoData);
        } catch (err) {
            const errorMsg =
                err instanceof Error
                    ? err.message
                    : "Failed to generate demo data";
            setError(errorMsg);
            onError(errorMsg);
        }
    }, [onFileLoaded, onError]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="p-4">
                            <img
                                src={FAVICON_PATH}
                                alt="Alloc logo"
                                className="h-16 w-16 rounded-md"
                            />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        <span className="text-blue-500">Alloc</span> Dashboard
                        {/* <span className="text-blue-500">Pro</span> */}
                    </h1>
                    <p className="text-slate-400">
                        Stock Investment Portfolio Visualizer
                    </p>
                </div>

                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
            border-2 border-dashed rounded-xl p-12 text-center transition-all
            ${
                isDragging
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
            }
          `}
                >
                    <Upload
                        className={`h-12 w-12 mx-auto mb-4 ${
                            isDragging ? "text-blue-500" : "text-slate-500"
                        }`}
                    />
                    <p className="text-lg font-semibold text-white mb-2">
                        {isDragging
                            ? "Drop file here"
                            : "Drag and drop your account data file"}
                    </p>
                    <p className="text-sm text-slate-400 mb-6">
                        Or click to browse
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                        <input
                            type="file"
                            id="file-input"
                            accept=".json"
                            onChange={handleFileInput}
                            className="hidden"
                        />
                        <label
                            htmlFor="file-input"
                            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg cursor-pointer transition-colors"
                        >
                            Select File
                        </label>
                        <div className="text-slate-500 text-sm">or</div>
                        <button
                            onClick={handleDemoMode}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-800 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                        >
                            <Sparkles className="h-4 w-4" />
                            Try Demo Mode
                        </button>
                    </div>

                    <div className="mt-8 space-y-3">
                        <div className="text-sm text-slate-500 font-medium">
                            Required file:
                        </div>
                        <div className="flex items-center justify-center gap-2 text-sm">
                            <FileText className="h-4 w-4 text-slate-500" />
                            <span className="text-slate-400">
                                account_data.json (exported from FUTU Moomoo)
                            </span>
                            {dataFile && (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                        </div>
                        <div className="flex items-center justify-center gap-2 text-sm">
                            <span className="text-slate-500">
                                Data export instructions can be found at{" "}
                                <a
                                    href="https://github.com/mxshell/Alloc?tab=readme-ov-file#exporting-portfolio-data"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-400 underline"
                                >
                                    here
                                </a>
                                .
                            </span>
                        </div>

                        <div className="flex items-center justify-center gap-2">
                            <p className="text-blue-500 mt-2">
                                All data is consumed locally and never uploaded
                                to any servers.
                            </p>
                        </div>
                    </div>
                </div>

                {displayError && (
                    <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-rose-400">
                            <div className="font-semibold mb-1">Error</div>
                            <div>{displayError}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileDropZone;
