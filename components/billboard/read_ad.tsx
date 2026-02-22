/**
 * ReadAd Component
 * Displays a single ad with user information, message content, media, and interaction buttons.
 * Supports tipping, sharing, and blockchain transaction viewing functionality.
 */

import React, { useState, useMemo } from "react";
import { FiShare2, FiHash } from "react-icons/fi";
import { toast } from "react-toastify";
import { BsCurrencyDollar } from "react-icons/bs";

import Modal from "../common/modal";
import Tip from "../tip/tip";
import ReadMediaFile from "../media/read_media_file";
import UserProfile from "../profile/user_profile";
import LinkAndHashtagReader from "../common/link_and_hashtag_reader";
import ConnectModal from "../wallet/ConnectModal";
import { useWalletContext } from "../wallet/WalletContext";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { formatTimestamp } from "../common/formatTimestamp";
import type { Message } from "../hooks/use_get_data";

interface ReadAdProps {
    message: Message;
}

function ReadAd({ message }: ReadAdProps) {
    const { isConnected } = useWalletContext();
    const { data: accountId } = useAccountId();

    const postData = message;
    const loading = false;
    const error = !postData;

    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
    const [isTipModalOpen, setIsTipModalOpen] = useState(false);
    const [selectedAuthor, setSelectedAuthor] = useState("");
    const [selectedTopicId, setSelectedTopicId] = useState("");

    // Parse Ad Content (JSON or Legacy String)
    const adContent = useMemo(() => {
        if (!postData?.Message) return { title: "", content: "" };
        try {
            const parsed = JSON.parse(postData.Message);
            if (parsed && typeof parsed === "object" && "title" in parsed) {
                return {
                    title: parsed.title,
                    content: parsed.content || "",
                };
            }
            return { title: "", content: postData.Message };
        } catch {
            return { title: "", content: postData.Message };
        }
    }, [postData?.Message]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto bg-background text-text px-0 sm:px-6">
                <div className="bg-gradient-to-br from-slate-900 via-yellow-900/20 to-slate-900 backdrop-blur-xl sm:rounded-2xl overflow-hidden border-y sm:border border-yellow-400/30 shadow-2xl shadow-yellow-400/20 animate-pulse">
                    <div className="h-32 bg-gradient-to-r from-yellow-400/10 to-orange-400/10 rounded-t-2xl"></div>
                    <div className="p-6 space-y-4">
                        <div className="h-4 bg-yellow-400/20 rounded-full w-3/4"></div>
                        <div className="h-4 bg-yellow-400/20 rounded-full w-1/2"></div>
                        <div className="h-20 bg-slate-700/30 rounded-xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !postData) {
        return (
            <div className="max-w-4xl mx-auto bg-background text-text px-0 sm:px-6">
                <div className="bg-gradient-to-br from-slate-900 via-red-900/20 to-slate-900 backdrop-blur-xl sm:rounded-2xl overflow-hidden border-y sm:border border-red-400/30 shadow-2xl shadow-red-400/20 p-6">
                    <div className="flex items-center gap-3 text-red-400">
                        <span className="font-mono font-medium">Failed to load ad</span>
                    </div>
                </div>
            </div>
        );
    }

    const openConnectModal = () => {
        setIsConnectModalOpen(true);
    };
    const closeConnectModal = () => {
        setIsConnectModalOpen(false);
    };

    const generateShareLink = (sequence_number: string) => {
        // Use current origin (works for localhost and production)
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ibird.io';
        const shareLink = `${baseUrl}/Ads/${sequence_number}`;
        return shareLink;
    };

    const copyShareLink = (sequence_number: string) => {
        const link = generateShareLink(sequence_number);
        navigator.clipboard.writeText(link).then(() => {
            toast("Link copied to clipboard!");
        });
    };

    const openTipModal = () => {
        setIsTipModalOpen(true);
    };
    const closeTipModal = () => {
        setIsTipModalOpen(false);
    };

    const handleTip = (author: string, topicId: string) => {
        if (!isConnected) {
            openConnectModal();
            return;
        }
        if (accountId === author) {
            toast("You cannot tip yourself");
            return;
        }
        setSelectedAuthor(author);
        setSelectedTopicId(topicId);
        openTipModal();
    };

    return (
        <div className="max-w-4xl mx-auto bg-background text-text px-0 sm:px-6">
            <div className="bg-gradient-to-br from-slate-900 via-yellow-900/10 to-slate-900 backdrop-blur-xl sm:rounded-2xl overflow-hidden border-y sm:border border-yellow-400/30 shadow-2xl shadow-yellow-400/10 group hover:border-yellow-400/50 transition-all duration-300">
                {/* Header - Ad specific styling */}
                <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-yellow-400/20 bg-gradient-to-r from-yellow-400/5 to-orange-400/5">
                    <div className="flex items-center justify-between">
                        <UserProfile userAccountId={postData?.sender || ""} />
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-yellow-900 bg-yellow-400 px-2 py-0.5 rounded-sm uppercase tracking-wider shadow-sm shadow-yellow-400/50">
                                Sponsored
                            </span>
                            <span className="text-xs text-yellow-400/60 font-mono">
                                {formatTimestamp(
                                    postData?.consensus_timestamp?.toString() || ""
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Content area */}
                <div className="p-0">
                    {/* Media - Displayed prominently at the top or middle, 16:9 Aspect Ratio enforced */}
                    {postData?.Media && (
                        <div className="w-full aspect-video bg-black/20 overflow-hidden relative border-b border-yellow-400/10">
                            <div className="absolute inset-0 flex items-center justify-center">
                                {/* ReadMediaFile handles the actual image/video rendering. 
                     We wrap it to enforce the container size. 
                     Note: ReadMediaFile might need to be adjusted if it doesn't fill 100% */}
                                <ReadMediaFile cid={postData?.Media} />
                            </div>
                        </div>
                    )}

                    <div className="p-4 sm:p-6 space-y-2 sm:space-y-3">
                        {/* Headline */}
                        {adContent.title && (
                            <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight font-sans tracking-tight">
                                {adContent.title}
                            </h3>
                        )}

                        {/* Body Text */}
                        <p className="text-slate-300 text-base leading-relaxed font-light whitespace-pre-line">
                            <LinkAndHashtagReader message={adContent.content} />
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="px-4 pb-4 sm:px-6 sm:pb-6 pt-2">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
                            {/* Tip Button */}
                            <button
                                className="group flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 rounded-full bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 transition-all duration-200 border border-yellow-400/20 hover:border-yellow-400/40"
                                onClick={() =>
                                    handleTip(
                                        postData?.sender?.toString() || "",
                                        message.sequence_number.toString()
                                    )
                                }
                                title="Tip the advertiser"
                            >
                                <BsCurrencyDollar className="w-4 h-4" />
                                <span className="text-sm font-medium">Tip</span>
                            </button>

                            {/* Share Button */}
                            <button
                                className="group flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all duration-200 border border-slate-700 hover:border-slate-600"
                                onClick={() =>
                                    copyShareLink(message.sequence_number.toString())
                                }
                                title="Share this ad"
                            >
                                <FiShare2 className="w-4 h-4" />
                                <span className="text-sm font-medium">Share</span>
                            </button>

                            {/* HashScan Button */}
                            <a
                                href={`https://hashscan.io/${process.env.NEXT_PUBLIC_NETWORK || "mainnet"
                                    }/transaction/${postData?.message_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto group flex items-center justify-center p-2 rounded-full text-slate-500 hover:text-yellow-400 transition-colors"
                                title="View on HashScan"
                            >
                                <FiHash className="w-4 h-4" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {isConnectModalOpen && (
                <ConnectModal isOpen={isConnectModalOpen} onClose={closeConnectModal} />
            )}

            {isTipModalOpen && (
                <Modal isOpen={isTipModalOpen} onClose={closeTipModal}>
                    <Tip
                        onClose={closeTipModal}
                        author={selectedAuthor}
                        topicId={selectedTopicId}
                    />
                </Modal>
            )}
        </div>
    );
}

export default ReadAd;
