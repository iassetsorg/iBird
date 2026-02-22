import React, { useState, useRef } from "react";
import { toast } from "react-toastify";
import { MdOutlinePermMedia, MdInfoOutline } from "react-icons/md";
import useSendMessage from "../hooks/use_send_message";
import useUploadToArweave from "../media/use_upload_to_arweave";
import { RiDeleteBinLine, RiCheckLine, RiRefreshLine } from "react-icons/ri";
import { BsEmojiSmile } from "react-icons/bs";
import EmojiPickerPopup from "../common/EmojiPickerPopup";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";
import ImageCropModal from "../common/ImageCropModal";

// Use Explorer Topic ID as requested for Billboard Ads
const explorerTopic = process.env.NEXT_PUBLIC_BILLBOARD_ID || "";

interface TransactionReceipt {
    result: {
        toString: () => string;
    };
}

const maxSize = 100 * 1024 * 1024;

// Industry Standard Limits
const MAX_HEADING_LENGTH = 60;
const MAX_BODY_LENGTH = 280;

const SendNewAd = ({
    onClose,
    topicId,
}: {
    onClose: () => void;
    topicId?: string;
}) => {
    const [heading, setHeading] = useState("");
    const [message, setMessage] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const { uploadToArweave } = useUploadToArweave();
    const { send } = useSendMessage();
    const [memo] = useState("");
    const [isEditing, setIsEditing] = useState(true);
    const { triggerRefresh } = useRefreshTrigger();

    // Cropping State
    const [showCropModal, setShowCropModal] = useState(false);
    const [tempImage, setTempImage] = useState<string>("");

    const [stepStatuses, setStepStatuses] = useState({
        arweave: { status: "idle", disabled: false },
        explorer: { status: "idle", disabled: true },
    });

    const uploadedMediaIdRef = useRef<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const [autoProgress, setAutoProgress] = useState(false);
    const autoProgressRef = useRef(false);
    const [autoProgressDisabledByError, setAutoProgressDisabledByError] =
        useState(false);

    const onEmojiClick = (emojiData: { emoji: string }) => {
        setMessage((prevMessage) => prevMessage + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    const clearFile = () => {
        setFile(null);
        uploadedMediaIdRef.current = null;
    };

    // Handle file selection and open crop modal
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            if (selectedFile.size > maxSize) {
                toast.error("File size exceeds 100MB limit.");
                return;
            }

            const reader = new FileReader();
            reader.addEventListener("load", () => {
                setTempImage(reader.result as string);
                setShowCropModal(true);
            });
            reader.readAsDataURL(selectedFile);
            e.target.value = ""; // Reset input
        }
    };

    // Handle crop completion
    const onCropComplete = (croppedFile: File) => {
        setFile(croppedFile);
        uploadedMediaIdRef.current = null; // Reset upload status for new file
        setShowCropModal(false);
    };

    const disableAutoProgression = (reason: string) => {
        console.log(`Disabling auto-progression: ${reason}`);
        setAutoProgress(false);
        autoProgressRef.current = false;
        setAutoProgressDisabledByError(true);
    };

    const resetAutoProgression = () => {
        setAutoProgressDisabledByError(false);
        setAutoProgress(true);
        autoProgressRef.current = true;

        const stepOrder = ["arweave", "explorer"];
        const nextStep = stepOrder.find((stepName) => {
            const status = stepStatuses[stepName as keyof typeof stepStatuses];
            return status && status.status === "error" && !status.disabled;
        });

        if (nextStep) {
            toast.info(`Auto-progression reset. Retrying ${nextStep}...`);
            setTimeout(() => {
                switch (nextStep) {
                    case "arweave":
                        handleArweaveUpload().catch(() => {
                            disableAutoProgression("Upload retry error");
                        });
                        break;
                    case "explorer":
                        handleExplorerPost().catch(() => {
                            disableAutoProgression("Explorer post retry error");
                        });
                        break;
                }
            }, 1000);
        } else {
            toast.success("Auto-progression reset and enabled.");
        }
    };

    const handleStartPosting = () => {
        if (!heading.trim()) {
            toast.error("Please enter a headline");
            return;
        }
        if (!message.trim()) {
            toast.error("Please enter ad content");
            return;
        }

        if (file && file.size > maxSize) {
            toast.error("The file exceeds 100MB.");
            return;
        }

        if (file) {
            setStepStatuses({
                arweave: { status: "idle", disabled: false },
                explorer: { status: "idle", disabled: true },
            });
        } else {
            setStepStatuses({
                arweave: { status: "idle", disabled: true },
                explorer: { status: "idle", disabled: false },
            });
        }

        setIsEditing(false);
    };

    const handleArweaveUpload = async () => {
        if (!file) return;

        setStepStatuses((prev) => ({
            ...prev,
            arweave: { status: "loading", disabled: true },
        }));

        try {
            toast.info("Uploading ad media to Arweave...");
            const mediaId = await uploadToArweave(file);
            uploadedMediaIdRef.current = mediaId;
            toast.success("Media uploaded successfully.");

            setStepStatuses((prev) => ({
                ...prev,
                arweave: { status: "success", disabled: true },
                explorer: { status: "idle", disabled: false },
            }));

            if (autoProgressRef.current) {
                setTimeout(() => {
                    handleExplorerPost();
                }, 1000);
            }
        } catch {
            toast.error("Media upload failed.");
            setStepStatuses((prev) => ({
                ...prev,
                arweave: { status: "error", disabled: false },
            }));
        }
    };

    const handleExplorerPost = async () => {
        const mediaCid = uploadedMediaIdRef.current;

        if (file && !mediaCid) {
            toast.info("Waiting for media upload to finish...");
            if (autoProgressRef.current) {
                setTimeout(() => {
                    handleExplorerPost();
                }, 1000);
            }
            return;
        }

        setStepStatuses((prev) => ({
            ...prev,
            explorer: { status: "loading", disabled: true },
        }));

        try {
            // Structure the message as JSON to include Heading and Body
            const structuredMessage = JSON.stringify({
                title: heading.trim(),
                content: message.trim(),
            });

            const postPayload = {
                Type: "Ad",
                Message: structuredMessage,
                Media: mediaCid,
            };

            const postExplorer = await send(
                topicId || explorerTopic,
                postPayload,
                memo
            );

            if (
                postExplorer &&
                (postExplorer.receipt as TransactionReceipt)?.result?.toString() ===
                "SUCCESS"
            ) {
                toast.success("Your ad was sent successfully.");
                setStepStatuses((prev) => ({
                    ...prev,
                    explorer: { status: "success", disabled: true },
                }));

                onClose();
                await new Promise((resolve) => setTimeout(resolve, 2000));
                triggerRefresh();
            } else {
                throw new Error("Ad post failed");
            }
        } catch {
            toast.error("Failed to send ad.");
            setStepStatuses((prev) => ({
                ...prev,
                explorer: { status: "error", disabled: false },
            }));
        }
    };

    const renderProcessingSteps = () => (
        <div className="flex flex-col h-[80vh] bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-yellow-400/50 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <h1 className="text-2xl font-mono text-yellow-400 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                        Publishing Your Ad
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-white/60 font-mono">Auto-progress</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const newAutoProgress = !autoProgress;
                                setAutoProgress(newAutoProgress);
                                autoProgressRef.current = newAutoProgress;

                                if (newAutoProgress) {
                                    const stepOrder = ["arweave", "explorer"];
                                    const nextStep = stepOrder.find((stepName) => {
                                        const status =
                                            stepStatuses[stepName as keyof typeof stepStatuses];
                                        return (
                                            status && status.status === "idle" && !status.disabled
                                        );
                                    });

                                    if (nextStep) {
                                        setTimeout(() => {
                                            switch (nextStep) {
                                                case "arweave":
                                                    handleArweaveUpload().catch(() =>
                                                        disableAutoProgression("Upload error")
                                                    );
                                                    break;
                                                case "explorer":
                                                    handleExplorerPost().catch(() =>
                                                        disableAutoProgression("Explorer post error")
                                                    );
                                                    break;
                                            }
                                        }, 500);
                                    }
                                }
                            }}
                            disabled={autoProgressDisabledByError}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${autoProgress ? "bg-yellow-500" : "bg-slate-600"
                                } ${autoProgressDisabledByError
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                        >
                            <div
                                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${autoProgress ? "translate-x-5" : "translate-x-0.5"
                                    }`}
                            />
                        </button>
                        <span
                            className={`text-xs font-mono px-2 py-1 rounded ${autoProgress
                                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                : "bg-slate-600/20 text-slate-400 border border-slate-600/30"
                                }`}
                        >
                            {autoProgress ? "ON" : "OFF"}
                        </span>
                        {autoProgressDisabledByError && (
                            <button
                                onClick={resetAutoProgression}
                                className="text-xs font-mono px-2 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors duration-200"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                </div>
                {autoProgressDisabledByError && (
                    <div className="text-xs text-amber-400/80 font-mono mt-1">
                        Auto-progression disabled due to error. Click &quot;Retry&quot; to restart.
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="p-6">
                    <div className="mb-6 p-4 bg-slate-800/80 backdrop-blur-sm rounded-xl border border-yellow-400/30 shadow-lg shadow-yellow-400/10">
                        <h3 className="text-lg font-bold text-yellow-400 mb-2 font-mono">
                            {heading}
                        </h3>
                        <p className="text-white break-words text-base leading-relaxed font-light">
                            {message}
                        </p>
                        {file && (
                            <div className="mt-4 space-y-2">
                                <div className="relative rounded-lg overflow-hidden aspect-video">
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt="Preview"
                                        className="w-full h-full object-cover bg-black/5"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/50 to-transparent">
                                        <div className="flex items-center text-white/90">
                                            <MdOutlinePermMedia className="text-lg mr-2" />
                                            <span className="text-sm font-mono">
                                                {(file.size / (1024 * 1024)).toFixed(1)} MB
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {uploadedMediaIdRef.current && (
                                    <p className="text-sm font-mono text-green-300">
                                        Media upload complete.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        {file && (
                            <div className="flex justify-between items-center p-4 rounded-xl transition-all duration-200 border border-yellow-400/20 shadow-lg shadow-yellow-400/5 bg-slate-800/20">
                                <div className="flex-1 pr-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div
                                            className={`w-2 h-2 rounded-full ${stepStatuses.arweave.status === "success"
                                                ? "bg-green-400"
                                                : stepStatuses.arweave.status === "error"
                                                    ? "bg-red-400"
                                                    : stepStatuses.arweave.status === "loading"
                                                        ? "bg-yellow-400 animate-pulse"
                                                        : "bg-yellow-400"
                                                }`}
                                        />
                                        <h3 className="text-base font-medium font-mono text-white">
                                            Upload Media To Arweave
                                        </h3>
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    <button
                                        onClick={handleArweaveUpload}
                                        disabled={
                                            stepStatuses.arweave.disabled ||
                                            stepStatuses.arweave.status === "loading"
                                        }
                                        className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium min-w-[100px] font-mono
                        flex items-center justify-center shadow-lg ${stepStatuses.arweave.status === "success"
                                                ? "bg-green-500 text-white shadow-green-500/25 cursor-default"
                                                : stepStatuses.arweave.status === "loading"
                                                    ? "bg-slate-700 text-white animate-pulse cursor-not-allowed"
                                                    : stepStatuses.arweave.status === "error"
                                                        ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/25"
                                                        : "bg-gradient-to-r from-yellow-400 to-orange-500 hover:scale-105 text-white shadow-yellow-400/25"
                                            }`}
                                    >
                                        {stepStatuses.arweave.status === "loading" ? (
                                            <span className="text-sm">Processing...</span>
                                        ) : stepStatuses.arweave.status === "success" ? (
                                            <>
                                                <RiCheckLine className="mr-1.5" />
                                                <span className="text-sm">Done</span>
                                            </>
                                        ) : stepStatuses.arweave.status === "error" ? (
                                            <>
                                                <RiRefreshLine className="mr-1.5" />
                                                <span className="text-sm">Retry</span>
                                            </>
                                        ) : (
                                            <span className="text-sm">Start</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center p-4 rounded-xl transition-all duration-200 border border-yellow-400/20 shadow-lg shadow-yellow-400/5 bg-slate-800/20">
                            <div className="flex-1 pr-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <div
                                        className={`w-2 h-2 rounded-full ${stepStatuses.explorer.status === "success"
                                            ? "bg-green-400"
                                            : stepStatuses.explorer.status === "error"
                                                ? "bg-red-400"
                                                : stepStatuses.explorer.status === "loading"
                                                    ? "bg-yellow-400 animate-pulse"
                                                    : "bg-yellow-400"
                                            }`}
                                    />
                                    <h3 className="text-base font-medium font-mono text-white">
                                        Publish Ad
                                    </h3>
                                </div>
                            </div>
                            <div className="flex-shrink-0">
                                <button
                                    onClick={handleExplorerPost}
                                    disabled={
                                        stepStatuses.explorer.disabled ||
                                        stepStatuses.explorer.status === "loading"
                                    }
                                    className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium min-w-[100px] font-mono
                      flex items-center justify-center shadow-lg ${stepStatuses.explorer.status === "success"
                                            ? "bg-green-500 text-white shadow-green-500/25 cursor-default"
                                            : stepStatuses.explorer.status === "loading"
                                                ? "bg-slate-700 text-white animate-pulse cursor-not-allowed"
                                                : stepStatuses.explorer.status === "error"
                                                    ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/25"
                                                    : "bg-gradient-to-r from-yellow-400 to-orange-500 hover:scale-105 text-white shadow-yellow-400/25"
                                        }`}
                                >
                                    {stepStatuses.explorer.status === "loading" ? (
                                        <span className="text-sm">Processing...</span>
                                    ) : stepStatuses.explorer.status === "success" ? (
                                        <>
                                            <RiCheckLine className="mr-1.5" />
                                            <span className="text-sm">Done</span>
                                        </>
                                    ) : stepStatuses.explorer.status === "error" ? (
                                        <>
                                            <RiRefreshLine className="mr-1.5" />
                                            <span className="text-sm">Retry</span>
                                        </>
                                    ) : (
                                        <span className="text-sm">Start</span>
                                    )}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full bg-slate-800 hover:bg-red-500/20 text-white py-2 mt-4 px-4 rounded-full border border-yellow-400/50 hover:border-red-400/50 transition-all duration-200 font-mono"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderEditForm = () => (
        <div className="flex flex-col bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-yellow-400/50">
                <h3 className="text-2xl font-mono text-yellow-400 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                    Create Ad
                </h3>
                <p className="text-sm text-white/60 mt-1 font-light">
                    Promote your content on the Billboard
                </p>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
                <div className="p-6 space-y-6">
                    {/* Ad Guidelines Section */}
                    <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2 text-yellow-400">
                            <MdInfoOutline className="text-lg" />
                            <h4 className="font-mono font-bold text-sm uppercase tracking-wider">
                                Ad Guidelines
                            </h4>
                        </div>
                        <ul className="space-y-1.5 text-xs sm:text-sm text-white/70 font-mono list-disc list-inside">
                            <li>
                                <span className="text-yellow-200">Headline:</span> Max{" "}
                                {MAX_HEADING_LENGTH} characters. Make it catchy!
                            </li>
                            <li>
                                <span className="text-yellow-200">Body:</span> Max{" "}
                                {MAX_BODY_LENGTH} characters. Be concise and clear.
                            </li>
                            <li>
                                <span className="text-yellow-200">Image:</span> Recommended 16:9
                                aspect ratio. Max 100MB.
                            </li>
                            <li>
                                <span className="text-yellow-200">Quality:</span> Ensure content
                                meets industry standards.
                            </li>
                        </ul>
                    </div>

                    {/* Headline Input */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-sm font-medium text-white/80 font-mono">
                                Headline <span className="text-red-400">*</span>
                            </label>
                            <span
                                className={`text-xs font-mono ${heading.length > MAX_HEADING_LENGTH
                                    ? "text-red-400"
                                    : "text-white/40"
                                    }`}
                            >
                                {heading.length}/{MAX_HEADING_LENGTH}
                            </span>
                        </div>
                        <input
                            type="text"
                            value={heading}
                            onChange={(e) => setHeading(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-white font-bold
                  border-2 border-yellow-400/50 focus:border-yellow-400 transition-all
                  duration-200 outline-none shadow-lg shadow-yellow-400/10 placeholder-white/20"
                            placeholder="Catchy headline (e.g., 'Launch Your Project Today!')"
                            maxLength={MAX_HEADING_LENGTH}
                        />
                    </div>

                    {/* Body Input */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-sm font-medium text-white/80 font-mono">
                                Ad Text <span className="text-red-400">*</span>
                            </label>
                            <span
                                className={`text-xs font-mono ${message.length > MAX_BODY_LENGTH
                                    ? "text-red-400"
                                    : "text-white/40"
                                    }`}
                            >
                                {message.length}/{MAX_BODY_LENGTH}
                            </span>
                        </div>
                        <div>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-white font-light
                  border-2 border-yellow-400/50 focus:border-yellow-400 transition-all
                  duration-200 outline-none resize-none min-h-[100px] shadow-lg shadow-yellow-400/10 placeholder-white/20"
                                placeholder="Describe your offer..."
                                rows={3}
                                maxLength={MAX_BODY_LENGTH}
                            />

                            {/* Emoji and Media buttons - positioned below textarea */}
                            <div className="flex gap-2 mt-2 px-1">
                                <button
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="p-2 hover:bg-yellow-400/10 rounded-full transition-colors group"
                                >
                                    <BsEmojiSmile className="text-xl text-yellow-400 group-hover:text-orange-400" />
                                </button>

                                <label
                                    htmlFor="fileUpload"
                                    className="p-2 hover:bg-yellow-400/10 rounded-full transition-colors group cursor-pointer"
                                >
                                    <MdOutlinePermMedia className="text-xl text-yellow-400 group-hover:text-orange-400" />
                                    <input
                                        type="file"
                                        id="fileUpload"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    {file && (
                        <div className="space-y-4">
                            <div className="rounded-xl overflow-hidden border border-yellow-400/50 space-y-2">
                                <div className="relative aspect-video bg-black/20">
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                {uploadedMediaIdRef.current && (
                                    <p className="px-3 text-sm font-mono text-green-400">
                                        Media upload complete.
                                    </p>
                                )}

                                <div className="p-3 border-t border-yellow-400/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <p className="text-sm text-white truncate" title={file.name}>
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-white/50 mt-0.5">
                                                {(file.size / (1024 * 1024)).toFixed(1)} MB
                                            </p>
                                        </div>
                                        <button
                                            onClick={clearFile}
                                            className="flex items-center px-3 py-1.5 rounded-lg
                        bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300
                        transition-all duration-200"
                                        >
                                            <RiDeleteBinLine className="text-lg mr-1.5" />
                                            <span className="text-sm font-medium">Remove</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showEmojiPicker && (
                <EmojiPickerPopup
                    onEmojiClick={onEmojiClick}
                    onClose={() => setShowEmojiPicker(false)}
                />
            )}

            {/* Image Crop Modal */}
            <ImageCropModal
                isOpen={showCropModal}
                onClose={() => setShowCropModal(false)}
                tempImage={tempImage}
                onCropComplete={onCropComplete}
                aspectRatio={16 / 9}
                cropShape="rect"
                title="Crop Ad Image"
                description="Adjust your image to fit the 16:9 aspect ratio for best display."
            />

            <div className="p-6 border-t border-yellow-400/50 bg-slate-900/50">
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-600 text-slate-300 font-mono hover:bg-slate-800 transition-all duration-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleStartPosting}
                        className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-mono font-bold shadow-lg shadow-yellow-400/20 hover:shadow-yellow-400/40 hover:scale-[1.02] transition-all duration-200"
                    >
                        Next Step
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-2xl mx-auto animate-in fade-in zoom-in duration-200">
            {isEditing ? renderEditForm() : renderProcessingSteps()}
        </div>
    );
};

export default SendNewAd;
