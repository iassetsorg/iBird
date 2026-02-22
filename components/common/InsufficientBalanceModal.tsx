"use client";

import React, { FC } from "react";
import Modal from "./modal";

/**
 * Props interface for InsufficientBalanceModal
 */
interface InsufficientBalanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    requiredAmount: number;
    currentBalance: string;
    saucerSwapUrl: string;
    type: "explorer" | "billboard";
}

/**
 * Modal component displayed when user doesn't have enough ASSET tokens to post.
 * Shows the required amount and provides a link to buy ASSET on SaucerSwap.
 */
const InsufficientBalanceModal: FC<InsufficientBalanceModalProps> = ({
    isOpen,
    onClose,
    requiredAmount,
    currentBalance,
    saucerSwapUrl,
    type,
}) => {
    const isExplorer = type === "explorer";
    const gradientColors = isExplorer
        ? "from-purple-900 via-blue-900 to-purple-900"
        : "from-yellow-900 via-orange-900 to-yellow-900";
    const borderColor = isExplorer ? "border-purple-400/30" : "border-yellow-400/30";
    const accentColor = isExplorer ? "purple" : "yellow";

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div
                className={`flex flex-col items-center p-8 w-full max-w-md mx-auto sm:rounded-2xl relative bg-gradient-to-br ${gradientColors} backdrop-blur-xl ${borderColor} border-y sm:border shadow-2xl`}
            >
                {/* Warning Icon */}
                <div
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br from-slate-700 to-slate-800 border border-${accentColor}-400/30 shadow-lg shadow-${accentColor}-400/20`}
                >
                    <svg
                        className={`w-10 h-10 text-${accentColor}-400`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                    </svg>
                </div>

                {/* Title */}
                <h2
                    className={`text-2xl font-mono font-bold mb-3 bg-gradient-to-r from-${accentColor}-400 via-${accentColor}-500 to-${accentColor}-600 bg-clip-text text-transparent`}
                >
                    Insufficient Balance
                </h2>

                {/* Description */}
                <p className="text-sm mb-6 text-white/70 font-mono text-center max-w-sm leading-relaxed">
                    You need <span className="text-white font-bold">{requiredAmount.toLocaleString()} ASSET</span> tokens
                    to {isExplorer ? "post a new message" : "create an ad"} on the{" "}
                    {isExplorer ? "Explorer" : "Billboard"}.
                </p>

                {/* Balance Info Card */}
                <div
                    className={`w-full p-4 mb-6 rounded-xl bg-slate-800/50 border border-${accentColor}-400/20`}
                >
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-white/60 font-mono text-sm">Your Balance</span>
                        <span className="text-white font-mono font-semibold">{currentBalance} ASSET</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-white/60 font-mono text-sm">Required</span>
                        <span className={`text-${accentColor}-400 font-mono font-semibold`}>
                            {requiredAmount.toLocaleString()} ASSET
                        </span>
                    </div>
                    <div className="w-full h-px bg-slate-700 my-3"></div>
                    <div className="flex justify-between items-center">
                        <span className="text-white/60 font-mono text-sm">Needed</span>
                        <span className="text-red-400 font-mono font-semibold">
                            {Math.max(0, requiredAmount - parseFloat(currentBalance.replace(/,/g, ""))).toLocaleString()} ASSET
                        </span>
                    </div>
                </div>

                {/* SaucerSwap Button */}
                <a
                    href={saucerSwapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
            w-full
            py-4 px-6
            rounded-xl
            text-center
            font-mono font-semibold
            text-white
            bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-600
            hover:from-cyan-400 hover:via-blue-400 hover:to-cyan-500
            border border-cyan-400/30
            shadow-lg shadow-cyan-400/20
            hover:shadow-xl hover:shadow-cyan-400/30
            transition-all duration-300
            hover:scale-[1.02]
            active:scale-[0.98]
            flex items-center justify-center gap-3
          `}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                    </svg>
                    Buy ASSET on SaucerSwap
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                    </svg>
                </a>

                {/* Info text */}
                <p className="text-xs mt-4 text-center text-white/50 font-mono">
                    ASSET tokens are used to publish content on the iBird platform
                </p>
            </div>
        </Modal>
    );
};

export default InsufficientBalanceModal;
