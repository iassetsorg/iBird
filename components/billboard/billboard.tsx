/**
 * Billboard is a component that implements infinite scrolling to display ad messages.
 * Features:
 * - Infinite scroll loading
 * - Message type handling (Post, Thread, Poll)
 * - Loading states with spinner
 * - Animated message transitions
 */

import React, { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/router";
import useGetData from "../hooks/use_get_data";
import useGetProfile from "../hooks/use_get_profile";
import useAssetBalance, { POSTING_FEES } from "../hooks/use_asset_balance";
import ReadAd from "./read_ad";
import SendNewAd from "./send_new_ad";
import Modal from "../common/modal";
import InsufficientBalanceModal from "../common/InsufficientBalanceModal";
import eventService from "../services/event_service";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";
import SEOHead from "../common/SEOHead";
import { generateSEOConfig } from "../common/seo.config";
import { useWalletContext } from "../wallet/WalletContext";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { toast } from "react-toastify";
import Spinner from "../common/Spinner";
import ConnectModal from "../wallet/ConnectModal";

// Import Message type from useGetData
type Message = ReturnType<typeof useGetData>["messages"][0];

/**
 * Billboard component fetches and displays messages with infinite scroll functionality.
 * Uses Intersection Observer API to detect when to load more content.
 */
function Billboard() {
    // Router for navigation
    const router = useRouter();

    // Use Explorer Topic ID for Billboard as requested
    const billboardTopicID = process.env.NEXT_PUBLIC_BILLBOARD_ID || "0.0.7319495";
    const { refreshTrigger, triggerRefresh } = useRefreshTrigger();
    const { isConnected } = useWalletContext();
    const { data: accountId } = useAccountId();

    // Profile data to check if user has a profile
    const { profileData, isLoading: isProfileLoading } = useGetProfile(accountId);
    const userProfileTopicId = profileData?.ProfileTopic || "";

    // ASSET balance checking
    const {
        displayBalance,
        hasEnoughForBillboard,
        isLoading: isBalanceLoading,
        getSaucerSwapUrl,
    } = useAssetBalance();

    const [showCreateAd, setShowCreateAd] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);

    /**
     * Handle posting a new ad
     * Checks for wallet connection, profile existence, and ASSET balance before allowing ad creation
     */
    const handlePostAd = () => {
        if (!isConnected) {
            setShowConnectModal(true);
            return;
        }

        // Check if user has a profile, redirect to profile page if not
        if (!userProfileTopicId && !isProfileLoading) {
            toast.info("Please create a profile before posting ads");
            router.push("/profile");
            return;
        }

        // Check ASSET balance before allowing ad creation
        if (!isBalanceLoading && !hasEnoughForBillboard) {
            setShowInsufficientBalance(true);
            return;
        }

        setShowCreateAd(true);
    };

    // Custom hook for fetching message data
    const { messages, loading, fetchMessages, nextLink } = useGetData(
        billboardTopicID,
        null,
        true
    );

    // State management
    const [allMessages, setAllMessages] = useState<typeof messages>([]); // Accumulated messages
    const [isLoading, setIsLoading] = useState(false); // Loading state for next page

    // Reference for intersection observer
    const observerRef = useRef<HTMLDivElement | null>(null);

    // Add new state for tracking scroll position
    const [scrollTop, setScrollTop] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Modify the scroll handler
    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const element = e.currentTarget;
            setScrollTop(element.scrollTop);

            // Trigger refresh when scrolling up at the top
            if (element.scrollTop === 0 && scrollTop > 0) {
                triggerRefresh();
            }
        },
        [scrollTop, triggerRefresh]
    );

    // Initial data fetch
    useEffect(() => {
        setAllMessages([]); // Clear existing messages on refresh
        if (billboardTopicID) {
            fetchMessages(billboardTopicID);
        }
    }, [billboardTopicID, fetchMessages, refreshTrigger]); // Add refreshTrigger as a dependency

    /**
     * Intersection Observer callback
     * Triggers when the observer element becomes visible
     * Used to implement infinite scrolling
     */
    const handleObserver = useCallback(
        (entries: IntersectionObserverEntry[]) => {
            const target = entries[0];
            if (target.isIntersecting && nextLink && !isLoading) {
                setIsLoading(true);
                fetchMessages(nextLink);
            }
        },
        [nextLink, fetchMessages, isLoading]
    );

    /**
     * Sets up the Intersection Observer
     * Monitors when user scrolls near the bottom of the content
     */
    useEffect(() => {
        const option = {
            root: null,
            rootMargin: "100px",
            threshold: 0.5,
        };

        const observer = new IntersectionObserver(handleObserver, option);
        if (observerRef.current) observer.observe(observerRef.current);

        return () => {
            if (observerRef.current) observer.unobserve(observerRef.current);
        };
    }, [handleObserver]);

    /**
     * Updates allMessages state when new messages are fetched
     * Filters out duplicates and appends new messages
     */
    useEffect(() => {
        if (messages.length > 0) {
            setAllMessages((prevMessages: Message[]) => {
                const newMessages = messages.filter(
                    (message: Message) =>
                        !prevMessages.some(
                            (prevMessage: Message) =>
                                prevMessage.message_id === message.message_id
                        )
                );
                return [...prevMessages, ...newMessages];
            });
            setIsLoading(false);
        }
    }, [messages]);

    // Subscribe to refresh events
    useEffect(() => {
        const unsubscribe = eventService.subscribe("refreshBillboard", () => {
            triggerRefresh(); // This will trigger a global refresh
        });

        return () => unsubscribe();
    }, [triggerRefresh]);

    // Generate SEO configuration for billboard page
    const billboardSEO = generateSEOConfig("explore");

    return (
        <>
            <SEOHead seoConfig={billboardSEO} />

            {/* Post Ad Button - Fixed position like New Message */}
            <div className="fixed bottom-24 left-6 z-50">
                {/* Pulse animation ring for attention */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 opacity-20 animate-ping" />

                <button
                    onClick={handlePostAd}
                    className="
                        relative
                        inline-flex items-center justify-center
                        px-6 py-3
                        text-base font-mono font-semibold text-white
                        rounded-2xl
                        transition-all duration-300
                        hover:scale-[1.05]
                        active:scale-[0.95]
                        focus:outline-none
                        focus:ring-4 focus:ring-yellow-400/30
                        overflow-hidden
                        group
                        bg-gradient-to-br from-slate-900 via-yellow-900 to-slate-900
                        backdrop-blur-xl
                        border border-yellow-400/40
                        shadow-2xl shadow-yellow-400/25
                        hover:border-yellow-400/70
                        hover:shadow-yellow-400/40
                        hover:shadow-2xl
                        before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700
                    "
                    aria-label="Post Ad"
                >
                    {/* Enhanced gradient overlay on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-600" />

                    {/* Button content */}
                    <div className="relative flex items-center gap-3">
                        <span className="hidden sm:inline font-mono font-semibold text-white group-hover:text-yellow-100 transition-colors duration-300">
                            Post Ad
                        </span>
                        <div className="w-6 h-6 flex items-center justify-center">
                            <svg className="w-5 h-5 text-yellow-400 group-hover:text-yellow-200 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                    </div>

                    {/* Connection status indicator */}
                    <div
                        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${isConnected ? "bg-green-400" : "bg-red-400"
                            }`}
                    />
                </button>
            </div>

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="relative w-full h-[calc(100vh-4rem)] bg-background pt-4 px-0 sm:p-6 text-text
         overflow-y-scroll"
            >
                {/* Initial loading state */}
                {loading && allMessages.length === 0 && (
                    <div className="flex h-full items-center justify-center">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-yellow-400/10 to-orange-500/10 flex items-center justify-center border-2 border-yellow-400/20 shadow-lg shadow-yellow-400/10">
                                <Spinner />
                            </div>
                            <div>
                                <p className="text-white/80 font-mono font-semibold mb-1">
                                    Loading Billboard Ads
                                </p>
                                <p className="text-white/50 text-sm font-mono">
                                    Fetching ads from the network...
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty state - show immediately if not loading and no messages */}
                {!loading && allMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full py-16">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-400/10 to-orange-500/10 flex items-center justify-center mb-6 border border-yellow-400/20 shadow-lg shadow-yellow-400/10">
                            <svg
                                className="w-10 h-10 text-yellow-400/50"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                                />
                            </svg>
                        </div>
                        <h3 className="text-xl font-mono font-bold text-white/90 mb-3">
                            No Ads Found
                        </h3>
                        <p className="text-white/60 text-sm font-mono text-center mb-8 max-w-md leading-relaxed">
                            There are no ads to display at the moment. Check back later
                            for new opportunities.
                        </p>
                    </div>
                )}

                {/* Message list - Only show Ad type messages */}
                <div className="space-y-6">
                    {allMessages
                        .filter((message: Message) =>
                            // Only render Ad type messages in billboard
                            message.Type === "Ad"
                        )
                        .map((message: Message) => (
                            <div key={message.message_id}>
                                <ReadAd message={message} />
                            </div>
                        ))}
                </div>

                {/* Move the observer ref higher in the DOM */}
                <div ref={observerRef} className="h-10" />

                {/* Loading indicator for next page */}
                {isLoading && nextLink && (
                    <div className="flex items-center justify-center py-4">
                        <Spinner />
                    </div>
                )}
            </div>

            <Modal isOpen={showCreateAd} onClose={() => setShowCreateAd(false)}>
                <SendNewAd
                    onClose={() => setShowCreateAd(false)}
                    topicId={billboardTopicID}
                />
            </Modal>

            <ConnectModal
                isOpen={showConnectModal}
                onClose={() => setShowConnectModal(false)}
            />

            {/* Insufficient Balance Modal for Billboard */}
            <InsufficientBalanceModal
                isOpen={showInsufficientBalance}
                onClose={() => setShowInsufficientBalance(false)}
                requiredAmount={POSTING_FEES.billboard}
                currentBalance={displayBalance}
                saucerSwapUrl={getSaucerSwapUrl()}
                type="billboard"
            />
        </>
    );
}

export default Billboard;
