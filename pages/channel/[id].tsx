/**
 * Public Channel View Page
 * Allows any user to view a channel via shareable URL: /channel/[id]
 * Logged-in users can follow/unfollow the channel (if not owner)
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import useGetData from "../../components/hooks/use_get_data";
import useFollow, { StepStatus, AddItemStepCallbacks, FollowedChannel } from "../../components/hooks/use_follow";
import useGetProfile from "../../components/hooks/use_get_profile";
import Spinner from "../../components/common/Spinner";
import ReadThread from "../../components/read message/read_thread";
import ReadPost from "../../components/read message/read_post";
import ReadPoll from "../../components/read message/read_poll";
import ReadRepost from "../../components/read message/read_repost";
import ReadMediaFile from "../../components/media/read_media_file";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { useWalletContext } from "../../components/wallet/WalletContext";
import ConnectModal from "../../components/wallet/ConnectModal";
import Navbar from "../../components/layout/Navbar";
import { toast } from "react-toastify";
import { formatTimestamp } from "../../components/common/formatTimestamp";
import {
    RiArrowLeftLine,
    RiShareLine,
    RiUserFollowLine,
    RiUserUnfollowLine,
    RiMessage3Line,
    RiCheckLine,
    RiCheckboxCircleLine,
    RiLoader4Line,
    RiAlertLine,
    RiCloseLine,
} from "react-icons/ri";

/**
 * Follow operation steps interface
 */
interface FollowSteps {
    createListTopic: StepStatus;
    sendToList: StepStatus;
    updateProfile: StepStatus;
}

interface ChannelMetadata {
    Name: string;
    Description: string;
    Media: string;
    Type: string;
}

export default function PublicChannelPage() {
    const router = useRouter();
    const { id } = router.query;
    const channelId = typeof id === "string" ? id : "";

    // Wallet integration
    const { data: accountId } = useAccountId();
    const { isConnected } = useWalletContext();
    const { profileData } = useGetProfile(accountId || "");

    // Follow hook with step tracking
    const {
        followChannel,
        followChannelWithSteps,
        unfollowChannel,
        isFollowingChannel,
        isLoading: isFollowLoading,
        isV2Profile,
        isFirstChannelFollow,
    } = useFollow();

    // State
    const [channelMetadata, setChannelMetadata] = useState<ChannelMetadata | null>(null);
    const [isMetadataLoading, setIsMetadataLoading] = useState(true);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [allMessages, setAllMessages] = useState<typeof messages>([]);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [scrollTop, setScrollTop] = useState(0);
    
    // Follow progress tracking state
    const [showFollowProgressModal, setShowFollowProgressModal] = useState(false);
    const [followSteps, setFollowSteps] = useState<FollowSteps>({
        createListTopic: "idle",
        sendToList: "idle",
        updateProfile: "idle",
    });
    const [followError, setFollowError] = useState<string | null>(null);
    const [followComplete, setFollowComplete] = useState(false);
    const [followStarted, setFollowStarted] = useState(false);
    const [autoProgressFollow, setAutoProgressFollow] = useState(false);
    const [autoProgressFollowDisabledByError, setAutoProgressFollowDisabledByError] = useState(false);
    const [pendingFollowData, setPendingFollowData] = useState<FollowedChannel | null>(null);
    
    // Auto-progression ref for follow steps
    const autoProgressFollowRef = useRef(false);

    const disableAutoProgressFollow = (reason: string) => {
        console.log(`Disabling follow auto-progression: ${reason}`);
        setAutoProgressFollow(false);
        autoProgressFollowRef.current = false;
        setAutoProgressFollowDisabledByError(true);
    };

    const getFirstFollowStep = (): keyof FollowSteps => {
        return isFirstChannelFollow() ? "createListTopic" : "sendToList";
    };

    const startFollowProcess = async () => {
        if (followStarted || !pendingFollowData) return;

        setFollowStarted(true);
        setFollowError(null);
        setFollowComplete(false);
        setAutoProgressFollowDisabledByError(false);

        // Create step callbacks
        const stepCallbacks: AddItemStepCallbacks = {
            onCreateTopicStart: () => {
                setFollowSteps(prev => ({ ...prev, createListTopic: "pending" }));
            },
            onCreateTopicComplete: () => {
                setFollowSteps(prev => ({ ...prev, createListTopic: "complete" }));
            },
            onCreateTopicError: (error) => {
                setFollowSteps(prev => ({ ...prev, createListTopic: "error" }));
                setFollowError(error.message);
                setFollowStarted(false);
                disableAutoProgressFollow("Create list topic error");
            },
            onSendToTopicStart: () => {
                setFollowSteps(prev => ({ ...prev, sendToList: "pending" }));
            },
            onSendToTopicComplete: () => {
                setFollowSteps(prev => ({ ...prev, sendToList: "complete" }));
            },
            onSendToTopicError: (error) => {
                setFollowSteps(prev => ({ ...prev, sendToList: "error" }));
                setFollowError(error.message);
                setFollowStarted(false);
                disableAutoProgressFollow("Send to list error");
            },
            onUpdateProfileStart: () => {
                setFollowSteps(prev => ({ ...prev, updateProfile: "pending" }));
            },
            onUpdateProfileComplete: () => {
                setFollowSteps(prev => ({ ...prev, updateProfile: "complete" }));
                setFollowComplete(true);
                setFollowStarted(false);
                autoProgressFollowRef.current = false;
            },
            onUpdateProfileError: (error) => {
                setFollowSteps(prev => ({ ...prev, updateProfile: "error" }));
                setFollowError(error.message);
                setFollowStarted(false);
                disableAutoProgressFollow("Update profile error");
            },
        };

        // Execute follow with steps
        const result = await followChannelWithSteps(pendingFollowData, stepCallbacks);

        if (result.success) {
            setFollowComplete(true);
            setFollowStarted(false);
            // Mark remaining steps as complete if they weren't triggered
            setFollowSteps(prev => ({
                createListTopic: prev.createListTopic === "idle" ? "complete" : prev.createListTopic,
                sendToList: prev.sendToList === "idle" ? "complete" : prev.sendToList,
                updateProfile: prev.updateProfile === "idle" ? "complete" : prev.updateProfile,
            }));
        } else {
            setFollowStarted(false);
        }
    };

    const resetAutoProgressFollow = () => {
        setAutoProgressFollowDisabledByError(false);
        setAutoProgressFollow(true);
        autoProgressFollowRef.current = true;
        setFollowError(null);

        if (!followStarted && !followComplete) {
            setTimeout(() => {
                startFollowProcess().catch((error) => {
                    console.error("Auto-start follow error:", error);
                    disableAutoProgressFollow("Auto-start error");
                });
            }, 500);
        }
    };

    // Custom hook for fetching message data
    const { messages, loading, fetchMessages, nextLink } = useGetData(
        channelId,
        null,
        true
    );

    // References
    const observerRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Check if user is owner of this channel
    // V1 profiles have Channels as an array, V2 profiles have Channels as a topic ID string
    // For V2 profiles, we need to check differently (ownership determined by comparing creator account)
    const isOwner = Array.isArray(profileData?.Channels)
        ? (profileData.Channels as Array<{ Channel: string }>).some(
            (channel) => channel.Channel === channelId
          )
        : false; // For V2 profiles, ownership check needs channel data from topic (handled separately)

    // Fetch channel metadata - get topic info from mirror node + creator's profile for Media
    useEffect(() => {
        const fetchMetadata = async () => {
            console.log("=== fetchMetadata called, channelId:", channelId);
            if (!channelId) return;

            setIsMetadataLoading(true);
            try {
                const mirrorNodeUrl =
                    process.env.NEXT_PUBLIC_NETWORK === "mainnet"
                        ? "https://mainnet.mirrornode.hedera.com"
                        : "https://testnet.mirrornode.hedera.com";

                let channelName = "Channel";
                let channelDescription = "";
                let channelMedia = "";

                // First, try to get topic info (contains memo with channel name)
                const topicResponse = await fetch(
                    `${mirrorNodeUrl}/api/v1/topics/${channelId}`
                );

                if (topicResponse.ok) {
                    const topicData = await topicResponse.json();
                    // Memo format is "Channel: ChannelName"
                    const memo = topicData.memo || "";
                    channelName = memo.startsWith("Channel: ")
                        ? memo.replace("Channel: ", "")
                        : memo || "Channel";
                }

                // Get first message for additional metadata and to find the creator
                const msgResponse = await fetch(
                    `${mirrorNodeUrl}/api/v1/topics/${channelId}/messages?order=asc&limit=1`
                );

                console.log("=== Fetching first message, response ok:", msgResponse.ok);
                if (msgResponse.ok) {
                    const data = await msgResponse.json();
                    const msgs = data.messages || [];
                    console.log("=== First messages count:", msgs.length);

                    if (msgs.length > 0) {
                        const firstMessage = msgs[0];
                        const creatorAccountId = firstMessage.payer_account_id;
                        console.log("=== Channel creator account:", creatorAccountId);

                        // Try to parse first message for metadata
                        try {
                            // Use TextDecoder for proper UTF-8 support (emojis, special characters)
                            const decodedMessage = new TextDecoder("utf-8").decode(
                                Uint8Array.from(atob(firstMessage.message), (c) => c.charCodeAt(0))
                            );
                            const metadata = JSON.parse(decodedMessage);
                            console.log("=== First message metadata:", metadata);
                            if (metadata.Name) channelName = metadata.Name;
                            if (metadata.Description) channelDescription = metadata.Description;
                            if (metadata.Media) channelMedia = metadata.Media;
                        } catch {
                            // First message isn't JSON metadata, that's fine
                            console.log("=== First message is not JSON metadata");
                        }

                        // If we still don't have Media, try to fetch creator's profile
                        console.log("=== Checking if need to fetch creator profile, channelMedia:", channelMedia, "creatorAccountId:", creatorAccountId);
                        if (!channelMedia && creatorAccountId) {
                            try {
                                // Get creator's NFTs to find their profile topic
                                const profileNFTTokenId = process.env.NEXT_PUBLIC_PROFILE_NFT_TOKEN_ID || "";
                                console.log("Profile NFT Token ID:", profileNFTTokenId);
                                const nftResponse = await fetch(
                                    `${mirrorNodeUrl}/api/v1/accounts/${creatorAccountId}/nfts?token.id=${encodeURIComponent(profileNFTTokenId)}&limit=10`
                                );

                                if (nftResponse.ok) {
                                    const nftData = await nftResponse.json();
                                    const nfts = nftData.nfts || [];
                                    console.log("Creator NFTs found:", nfts.length);

                                    for (const nft of nfts) {
                                        if (nft.deleted) continue;
                                        try {
                                            // Decode NFT metadata to get profile topic ID
                                            const profileTopicId = atob(nft.metadata);

                                            // Fetch profile data
                                            const profileResponse = await fetch(
                                                `${mirrorNodeUrl}/api/v1/topics/${profileTopicId}/messages?order=desc&limit=1`
                                            );

                                            if (profileResponse.ok) {
                                                const profileMsgs = await profileResponse.json();
                                                const profileMessages = profileMsgs.messages || [];

                                                if (profileMessages.length > 0) {
                                                    // Use TextDecoder for proper UTF-8 support (emojis, special characters)
                                                    const decodedProfileMessage = new TextDecoder("utf-8").decode(
                                                        Uint8Array.from(atob(profileMessages[0].message), (c) => c.charCodeAt(0))
                                                    );
                                                    const profileData = JSON.parse(decodedProfileMessage);

                                                    // Find this channel in creator's profile
                                                    const channelsArray = profileData.Channels || [];
                                                    const foundChannel = channelsArray.find(
                                                        (ch: { Channel: string; Media?: string; Description?: string }) =>
                                                            ch.Channel === channelId
                                                    );

                                                    if (foundChannel) {
                                                        if (foundChannel.Media) channelMedia = foundChannel.Media;
                                                        if (foundChannel.Description && !channelDescription) {
                                                            channelDescription = foundChannel.Description;
                                                        }
                                                        break; // Found the channel, stop searching
                                                    }
                                                }
                                            }
                                        } catch {
                                            // Continue to next NFT
                                        }
                                    }
                                }
                            } catch (error) {
                                console.error("Error fetching creator profile:", error);
                            }
                        }
                    }
                }

                console.log("=== Setting channelMetadata:", {
                    Name: channelName,
                    Description: channelDescription,
                    Media: channelMedia
                });
                setChannelMetadata({
                    Name: channelName,
                    Description: channelDescription,
                    Media: channelMedia,
                    Type: "Channel"
                });
            } catch (error) {
                console.error("Error fetching channel metadata:", error);
            } finally {
                console.log("=== fetchMetadata completed");
                setIsMetadataLoading(false);
            }
        };

        fetchMetadata();
    }, [channelId]);

    // Initial data fetch
    useEffect(() => {
        if (channelId && channelId.trim() !== "") {
            setAllMessages([]);
            fetchMessages(channelId, true);
        }
    }, [channelId, fetchMessages]);

    // Intersection Observer callback
    const handleObserver = useCallback(
        (entries: IntersectionObserverEntry[]) => {
            const target = entries[0];
            if (target.isIntersecting && nextLink && !isLoadingMore && !loading) {
                setIsLoadingMore(true);
                fetchMessages(nextLink, false);
            }
        },
        [fetchMessages, nextLink, isLoadingMore, loading]
    );

    // Sets up the Intersection Observer
    useEffect(() => {
        const option = {
            root: null,
            rootMargin: "100px",
            threshold: 0.5,
        };

        const observer = new IntersectionObserver(handleObserver, option);
        const observedElement = observerRef.current;
        if (observedElement) observer.observe(observedElement);

        return () => {
            if (observedElement) observer.unobserve(observedElement);
        };
    }, [handleObserver]);

    // Updates allMessages when new messages are fetched
    useEffect(() => {
        if (messages.length > 0) {
            setAllMessages((prevMessages) => {
                const newMessages = messages.filter(
                    (message) =>
                        // Filter out duplicates
                        !prevMessages.some(
                            (prevMessage) => prevMessage.message_id === message.message_id
                        ) &&
                        // Filter out ChannelIdentifier messages (metadata messages)
                        message.Type !== "ChannelIdentifier" &&
                        // Skip the first message (sequence_number 1) which is the identifier
                        message.sequence_number !== 1
                );
                return [...prevMessages, ...newMessages];
            });
            setIsLoadingMore(false);
        }
    }, [messages]);

    // Handle scroll events
    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const element = e.currentTarget;
            setScrollTop(element.scrollTop);

            if (
                element.scrollTop === 0 &&
                scrollTop > 10 &&
                channelId &&
                !isRefreshing &&
                !loading
            ) {
                setIsRefreshing(true);
                fetchMessages(channelId, true).finally(() => {
                    setIsRefreshing(false);
                });
            }
        },
        [channelId, scrollTop, isRefreshing, loading]
    );

    // Handle follow action with step tracking for V2 profiles
    const handleFollow = async () => {
        if (!isConnected) {
            setShowConnectModal(true);
            return;
        }

        const channelData = {
            Name: channelMetadata?.Name || "Channel",
            Channel: channelId,
            Description: channelMetadata?.Description || "",
            Media: channelMetadata?.Media || "",
        };

        // For V2 profiles, use step tracking
        if (isV2Profile) {
            // Reset state
            setFollowError(null);
            setFollowComplete(false);
            setFollowStarted(false);
            setAutoProgressFollowDisabledByError(false);
            const isFirstFollow = isFirstChannelFollow();
            setPendingFollowData(channelData);
            
            // Initialize steps based on whether this is first follow
            setFollowSteps({
                createListTopic: isFirstFollow ? "idle" : "idle",
                sendToList: "idle",
                updateProfile: isFirstFollow ? "idle" : "idle",
            });
            
            // Show modal
            setShowFollowProgressModal(true);

            if (autoProgressFollowRef.current) {
                setTimeout(() => {
                    startFollowProcess().catch((error) => {
                        console.error("Auto-start follow error:", error);
                        disableAutoProgressFollow("Auto-start error");
                    });
                }, 500);
            }
        } else {
            // V1 profiles - simple follow
            await followChannel(channelData);
        }
    };

    const renderFollowStepButton = (
        step: keyof FollowSteps,
        label: string,
        description: string,
        stepNumber: string
    ) => {
        const status: StepStatus = followSteps[step];
        const firstStep = getFirstFollowStep();
        const isActionable = step === firstStep && (status === "idle" || status === "error") && !followStarted;

        return (
            <div
                className="flex justify-between items-center p-4 rounded-lg transition-all duration-200 border border-cyan-400/20 shadow-lg shadow-cyan-400/5 bg-slate-800/20"
                key={step}
            >
                <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                        <div
                            className={`w-2 h-2 rounded-full ${
                                status === "complete"
                                    ? "bg-green-400"
                                    : status === "error"
                                    ? "bg-red-400"
                                    : status === "pending"
                                    ? "bg-cyan-400 animate-pulse"
                                    : "bg-cyan-400"
                            }`}
                        />
                        <h3
                            className={`text-base font-medium font-mono ${
                                status === "complete"
                                    ? "text-green-400"
                                    : status === "error"
                                    ? "text-red-400"
                                    : status === "pending"
                                    ? "text-white"
                                    : "text-white"
                            }`}
                        >
                            {stepNumber}. {label}
                        </h3>
                    </div>
                    <p className="text-xs text-white/40">{description}</p>
                </div>
                <div className="flex-shrink-0">
                    <button
                        onClick={() => {
                            if (isActionable) {
                                startFollowProcess().catch((error) => {
                                    console.error("Manual follow start error:", error);
                                    disableAutoProgressFollow("Manual start error");
                                });
                            }
                        }}
                        disabled={!isActionable}
                        className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium min-w-[100px] font-mono
                            flex items-center justify-center shadow-lg ${
                                status === "complete"
                                    ? "bg-green-500 text-white shadow-green-500/25 cursor-default"
                                    : status === "pending"
                                    ? "bg-slate-700 text-white animate-pulse cursor-not-allowed"
                                    : status === "error"
                                    ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/25"
                                    : !isActionable
                                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                                    : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-cyan-400/25"
                            }`}
                    >
                        {status === "pending" ? (
                            <span className="text-sm">Processing...</span>
                        ) : status === "complete" ? (
                            <span className="text-sm">Done</span>
                        ) : status === "error" ? (
                            <span className="text-sm">Retry</span>
                        ) : (
                            <span className="text-sm">Start</span>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    // Handle unfollow action
    const handleUnfollow = async () => {
        await unfollowChannel(channelId);
    };

    // Handle share
    const handleShare = async () => {
        const url = `${window.location.origin}/channel/${channelId}`;
        try {
            await navigator.clipboard.writeText(url);
            toast.success("Channel link copied to clipboard!");
        } catch {
            toast.error("Failed to copy link");
        }
    };

    // Check if following
    const isFollowing = isFollowingChannel(channelId);

    if (!channelId) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>
                    {channelMetadata?.Name || "Channel"} - iBird
                </title>
                <meta
                    name="description"
                    content={channelMetadata?.Description || "View channel on iBird"}
                />
            </Head>

            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <Navbar />

                <div className="min-h-screen flex flex-col max-w-4xl mx-auto px-4 pt-20 pb-8">
                    {/* Channel Header Card */}
                    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md rounded-2xl border border-cyan-400/20 shadow-xl shadow-cyan-400/5 mb-6 overflow-hidden">
                        {/* Header Top */}
                        <div className="bg-gradient-to-r from-cyan-400/10 via-blue-500/10 to-cyan-400/10 px-6 py-5">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => router.back()}
                                        className="p-2.5 rounded-xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-400 transition-all duration-200 hover:scale-105"
                                        aria-label="Go back"
                                    >
                                        <RiArrowLeftLine className="w-5 h-5" />
                                    </button>

                                    <div className="flex items-center gap-4">
                                        {/* Channel Avatar */}
                                        <div className="relative flex-shrink-0">
                                            {isMetadataLoading ? (
                                                <div className="w-14 h-14 rounded-xl bg-slate-700 animate-pulse" />
                                            ) : channelMetadata?.Media ? (
                                                <div className="w-14 h-14 rounded-xl overflow-hidden ring-2 ring-cyan-400/40">
                                                    <ReadMediaFile cid={channelMetadata.Media} />
                                                </div>
                                            ) : (
                                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
                                                    <RiMessage3Line className="w-7 h-7 text-white" />
                                                </div>
                                            )}
                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-slate-800" />
                                        </div>

                                        {/* Channel Info */}
                                        <div>
                                            <h1 className="text-xl sm:text-2xl font-bold text-white">
                                                {isMetadataLoading ? (
                                                    <span className="animate-pulse">Loading...</span>
                                                ) : (
                                                    channelMetadata?.Name || "Unnamed Channel"
                                                )}
                                            </h1>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                                                    <RiMessage3Line className="w-3 h-3 mr-1" />
                                                    Channel
                                                </span>
                                                {isOwner && (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-400/20 text-green-300 border border-green-400/30">
                                                        <RiCheckLine className="w-3 h-3 mr-1" />
                                                        Owner
                                                    </span>
                                                )}
                                                <span className="text-xs text-cyan-400/60 font-mono">
                                                    {channelId}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-3">
                                    {/* Share Button */}
                                    <button
                                        onClick={handleShare}
                                        className="px-4 py-2.5 rounded-xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-400 border border-cyan-400/30 transition-all duration-200 flex items-center gap-2 font-medium"
                                        title="Share channel"
                                    >
                                        <RiShareLine className="w-5 h-5" />
                                        <span className="hidden sm:inline text-sm">Share</span>
                                    </button>

                                    {/* Follow/Unfollow Button - Only show if NOT owner */}
                                    {!isOwner && (
                                        <>
                                            {isFollowing ? (
                                                <button
                                                    onClick={handleUnfollow}
                                                    disabled={isFollowLoading}
                                                    className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-red-500/20 text-white border border-slate-600 hover:border-red-400/50 transition-all duration-200 flex items-center gap-2 font-medium text-sm disabled:opacity-50"
                                                >
                                                    {isFollowLoading ? (
                                                        <Spinner />
                                                    ) : (
                                                        <>
                                                            <RiUserUnfollowLine className="w-5 h-5" />
                                                            <span className="hidden sm:inline">Unfollow</span>
                                                        </>
                                                    )}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleFollow}
                                                    disabled={isFollowLoading}
                                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-white transition-all duration-200 flex items-center gap-2 font-medium text-sm shadow-lg hover:shadow-cyan-400/30 disabled:opacity-50"
                                                >
                                                    {isFollowLoading ? (
                                                        <Spinner />
                                                    ) : (
                                                        <>
                                                            <RiUserFollowLine className="w-5 h-5" />
                                                            <span className="hidden sm:inline">Follow</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            {channelMetadata?.Description && (
                                <p className="mt-4 text-white/70 text-sm leading-relaxed">
                                    {channelMetadata.Description}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Messages Container */}
                    <div
                        ref={scrollRef}
                        onScroll={handleScroll}
                        className="flex-1 bg-slate-800/40 rounded-2xl border border-slate-700/50 overflow-hidden"
                    >
                        {/* Pull to refresh indicator */}
                        {isRefreshing && (
                            <div className="flex items-center justify-center py-4 bg-cyan-900/20 border-b border-cyan-400/20">
                                <Spinner />
                                <span className="ml-2 text-sm text-cyan-400 font-mono">Refreshing...</span>
                            </div>
                        )}

                        {/* Loading state */}
                        {loading && allMessages.length === 0 && (
                            <div className="flex h-64 items-center justify-center">
                                <div className="text-center space-y-4">
                                    <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-400/10 flex items-center justify-center border border-cyan-400/20">
                                        <Spinner />
                                    </div>
                                    <p className="text-white/60 font-mono">Loading messages...</p>
                                </div>
                            </div>
                        )}

                        {/* Empty state */}
                        {!loading && allMessages.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="w-20 h-20 rounded-2xl bg-cyan-400/10 flex items-center justify-center mb-6 border border-cyan-400/20">
                                    <RiMessage3Line className="w-10 h-10 text-cyan-400/50" />
                                </div>
                                <h3 className="text-xl font-bold text-white/90 mb-3">
                                    No Messages Yet
                                </h3>
                                <p className="text-white/60 text-sm text-center max-w-md px-4">
                                    This channel is empty. Messages will appear here once the owner starts posting.
                                </p>
                            </div>
                        )}

                        {/* Message list */}
                        <div className="divide-y divide-slate-700/50">
                            {allMessages.map((message) => {
                                const commonProps = {
                                    key: message.message_id,
                                    message_id: message.message_id,
                                    sender: message.sender,
                                    sequence_number: message.sequence_number.toString(),
                                    consensus_timestamp:
                                        message.consensus_timestamp?.toString() || "0",
                                };

                                return (
                                    <div key={message.message_id} className="p-5 hover:bg-slate-700/20 transition-colors">
                                        <div className="flex items-start justify-between gap-4 mb-3">
                                            <span className="px-2 py-1 bg-cyan-400/15 text-cyan-300 text-xs font-mono rounded-md border border-cyan-400/20">
                                                {message.Type || "Post"}
                                            </span>
                                            <span className="text-xs text-white/40 font-mono">
                                                #{message.sequence_number} • {formatTimestamp(message.consensus_timestamp || "")}
                                            </span>
                                        </div>

                                        <div className="text-white">
                                            {message.Type === "Post" && <ReadPost message={message} />}
                                            {message.Type === "Thread" && (
                                                <ReadThread {...commonProps} topicId={message.Thread} />
                                            )}
                                            {message.Type === "Poll" && (
                                                <ReadPoll {...commonProps} topicId={message.Poll} />
                                            )}
                                            {message.Type === "Repost" && (
                                                <ReadRepost
                                                    {...commonProps}
                                                    contentType={message.ContentType}
                                                    source={message.Source}
                                                    rePoster={message.sender}
                                                    timestamp={message.consensus_timestamp?.toString() || "0"}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Intersection observer target */}
                        <div ref={observerRef} className="h-10" />

                        {/* Loading more indicator */}
                        {isLoadingMore && nextLink && (
                            <div className="flex items-center justify-center py-6 border-t border-slate-700/50">
                                <Spinner />
                                <span className="ml-2 text-sm text-cyan-400/70 font-mono">Loading more...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Follow Progress Modal */}
                {showFollowProgressModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-cyan-400/30 shadow-2xl max-w-md w-full">
                            {/* Modal Header */}
                            <div className="p-6 border-b border-cyan-400/20">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-cyan-400/20 flex items-center justify-center">
                                            <RiUserFollowLine className="w-5 h-5 text-cyan-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">
                                                {followComplete ? "Following Channel" : "Follow Channel"}
                                            </h3>
                                            <p className="text-sm text-cyan-400/60">
                                                {isFirstChannelFollow()
                                                    ? "First time follow - 3 wallet approvals"
                                                    : "1 wallet approval needed"}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowFollowProgressModal(false)}
                                        className="p-2 rounded-lg hover:bg-slate-700/50 text-white/60 hover:text-white transition-colors"
                                        aria-label="Close follow modal"
                                    >
                                        <RiCloseLine className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Auto-progress toggle */}
                            <div className="px-6 pt-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-xs text-white/60 font-mono">Auto-progress</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                const newAutoProgress = !autoProgressFollow;
                                                setAutoProgressFollow(newAutoProgress);
                                                autoProgressFollowRef.current = newAutoProgress;

                                                if (newAutoProgress) {
                                                    if (!accountId) {
                                                        setAutoProgressFollow(false);
                                                        autoProgressFollowRef.current = false;
                                                        toast.warning("Please connect your wallet before enabling auto-progress");
                                                        return;
                                                    }

                                                    if (!followStarted && !followComplete && !followError) {
                                                        setTimeout(() => {
                                                            startFollowProcess().catch((error) => {
                                                                console.error("Auto-start follow error:", error);
                                                                disableAutoProgressFollow("Auto-start error");
                                                            });
                                                        }, 500);
                                                    }
                                                }
                                            }}
                                            disabled={autoProgressFollowDisabledByError}
                                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${autoProgressFollow ? "bg-cyan-500" : "bg-slate-600"}
                                                ${autoProgressFollowDisabledByError ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                        >
                                            <div
                                                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${autoProgressFollow ? "translate-x-5" : "translate-x-0.5"}`}
                                            />
                                        </button>
                                        <span
                                            className={`text-xs font-mono px-2 py-1 rounded ${autoProgressFollow
                                                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                                : "bg-slate-600/20 text-slate-400 border border-slate-600/30"}`}
                                        >
                                            {autoProgressFollow ? "ON" : "OFF"}
                                        </span>
                                        {autoProgressFollowDisabledByError && (
                                            <button
                                                onClick={resetAutoProgressFollow}
                                                className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-mono hover:bg-amber-500/30 transition-colors duration-200"
                                                title="Reset auto-progression after error"
                                            >
                                                Reset
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Steps Progress */}
                            <div className="p-6 space-y-4">
                                {isFirstChannelFollow() && renderFollowStepButton(
                                    "createListTopic",
                                    "Create Following List",
                                    "Create topic to store followed channels",
                                    "1"
                                )}

                                {renderFollowStepButton(
                                    "sendToList",
                                    isFirstChannelFollow() ? "Add Channel to List" : "Update Following Channels",
                                    "Save channel to your following list",
                                    isFirstChannelFollow() ? "2" : "1"
                                )}

                                {isFirstChannelFollow() && renderFollowStepButton(
                                    "updateProfile",
                                    "Update Profile",
                                    "Link following list to profile",
                                    "3"
                                )}

                                {/* Error Message */}
                                {followError && (
                                    <div className="mt-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                                        <div className="flex items-start gap-3">
                                            <RiAlertLine className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-red-400">Follow Failed</p>
                                                <p className="text-xs text-red-400/70 mt-1">{followError}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Success Message */}
                                {followComplete && !followError && (
                                    <div className="mt-2 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                                        <div className="flex items-center gap-3">
                                            <RiCheckboxCircleLine className="w-5 h-5 text-green-400" />
                                            <div>
                                                <p className="text-sm font-medium text-green-400">Successfully Followed!</p>
                                                <p className="text-xs text-green-400/70 mt-1">
                                                    You are now following {channelMetadata?.Name || "this channel"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-cyan-400/20">
                                {followComplete ? (
                                    <button
                                        onClick={() => setShowFollowProgressModal(false)}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-semibold hover:from-cyan-300 hover:to-blue-400 transition-all"
                                    >
                                        Done
                                    </button>
                                ) : followError ? (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowFollowProgressModal(false)}
                                            className="flex-1 py-3 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition-colors"
                                        >
                                            Close
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowFollowProgressModal(false);
                                                handleFollow();
                                            }}
                                            className="flex-1 py-3 rounded-xl bg-cyan-500 text-white font-semibold hover:bg-cyan-400 transition-colors"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center text-sm text-white/50">
                                        <RiLoader4Line className="w-5 h-5 animate-spin inline-block mr-2" />
                                        {followStarted ? "Please approve the transaction in your wallet..." : "Click Start to begin, or enable auto-progress."}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Connect Wallet Modal */}
                <ConnectModal
                    isOpen={showConnectModal}
                    onClose={() => setShowConnectModal(false)}
                />
            </div>
        </>
    );
}
