/**
 * UnifiedChatList is a React component that displays a unified list of channels and groups.
 * Like Telegram's chat list - combines both types in one view with filtering capabilities.
 *
 * Features:
 * - Combined channels and groups display
 * - Type filtering (All / Channels / Groups)
 * - Search across both types
 * - Sorting by name
 * - Distinct color themes (cyan for channels, purple for groups)
 * - V2 Profile Support: Resolves topic IDs to actual list data
 */

// ============================================================================
// IMPORTS SECTION
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import { toast } from "react-toastify";
import {
    RiAddLine,
    RiFileCopyLine,
    RiMessage3Line,
    RiGroupLine,
    RiArrowRightLine,
    RiSearchLine,
    RiSortAsc,
    RiSortDesc,
    RiEyeLine,
    RiGlobalLine,
    RiShareLine,
    RiLinkM,
} from "react-icons/ri";
import useGetProfile, { isV2Profile, getTopicId, getArrayData } from "../hooks/use_get_profile";
import useProfileLists from "../hooks/use_profile_lists";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import ReadMediaFile from "../media/read_media_file";
import CreateNewChannel from "../channels/create_new_channel";
import CreateNewGroup from "../groups/create_new_group";
import CreateNewProfile from "../profile/create_new_profile";
import Modal from "../common/modal";
import Spinner from "../common/Spinner";
import { useWalletContext } from "../wallet/WalletContext";
import ConnectModal from "../wallet/ConnectModal";

// ============================================================================
// TYPE DEFINITIONS & INTERFACES
// ============================================================================

interface Channel {
    Name: string;
    Channel: string;
    Description: string;
    Media: string;
    isFollowed?: boolean;
}

interface Group {
    Name: string;
    Group: string;
    Description: string;
    Media: string;
    isFollowed?: boolean;
}

type ChatItem =
    | { type: "channel"; data: Channel }
    | { type: "group"; data: Group };

type FilterType = "all" | "channels" | "groups";

interface UnifiedChatListProps {
    onChannelClick: (channel: Channel) => void;
    onGroupClick: (group: Group) => void;
    className?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UnifiedChatList = ({
    onChannelClick,
    onGroupClick,
    className = "",
}: UnifiedChatListProps) => {
    // ========================================================================
    // HOOKS & EXTERNAL DEPENDENCIES
    // ========================================================================

    const router = useRouter();
    const { data: accountId } = useAccountId();
    const { profileData, isLoading, error } = useGetProfile(accountId || "");
    const { isConnected } = useWalletContext();

    // ========================================================================
    // V2 PROFILE SUPPORT - HOOKS FOR FETCHING LIST DATA FROM TOPICS
    // ========================================================================

    const isV2 = profileData ? isV2Profile(profileData) : false;
    const channelsTopicId = profileData ? getTopicId(profileData.Channels) : "";
    const groupsTopicId = profileData ? getTopicId(profileData.Groups) : "";
    const followingChannelsTopicId = profileData ? getTopicId(profileData.FollowingChannels) : "";
    const followingGroupsTopicId = profileData ? getTopicId(profileData.FollowingGroups) : "";

    // V2 Profile Support - Hooks for fetching list data from topics (read-only, no profile update callback needed)
    const channelsList = useProfileLists(channelsTopicId, "Channels", "", null, async () => false);
    const groupsList = useProfileLists(groupsTopicId, "Groups", "", null, async () => false);
    const followingChannelsList = useProfileLists(followingChannelsTopicId, "FollowingChannels", "", null, async () => false);
    const followingGroupsList = useProfileLists(followingGroupsTopicId, "FollowingGroups", "", null, async () => false);

    // ========================================================================
    // COMPONENT STATE MANAGEMENT
    // ========================================================================

    const [showCreateChannel, setShowCreateChannel] = useState(false);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showCreateProfile, setShowCreateProfile] = useState(false);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [followedChannels, setFollowedChannels] = useState<Channel[]>([]);
    const [followedGroups, setFollowedGroups] = useState<Group[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<FilterType>("all");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Find by ID state
    const [showFindById, setShowFindById] = useState(false);
    const [findByIdValue, setFindByIdValue] = useState("");
    const [isFindingById, setIsFindingById] = useState(false);

    // ========================================================================
    // SHARE AND FIND HANDLERS
    // ========================================================================

    const handleShareLink = (type: "channel" | "group", topicId: string) => {
        const url = `${window.location.origin}/${type}/${topicId}`;
        navigator.clipboard.writeText(url).then(() => {
            toast.success(`${type === "channel" ? "Channel" : "Group"} link copied!`);
        }).catch(() => {
            toast.error("Failed to copy link");
        });
    };

    const handleFindById = async () => {
        const trimmedId = findByIdValue.trim();
        if (!trimmedId) {
            toast.error("Please enter a topic ID");
            return;
        }

        setIsFindingById(true);

        try {
            const mirrorNodeUrl =
                process.env.NEXT_PUBLIC_NETWORK === "mainnet"
                    ? "https://mainnet.mirrornode.hedera.com"
                    : "https://testnet.mirrornode.hedera.com";

            // Fetch the FIRST message (the identifier message) to detect type
            const response = await fetch(
                `${mirrorNodeUrl}/api/v1/topics/${trimmedId}/messages?order=asc&limit=1`
            );

            if (!response.ok) {
                toast.error("Topic not found. Please check the ID.");
                setIsFindingById(false);
                return;
            }

            const data = await response.json();
            if (data.messages?.length > 0) {
                const decoded = atob(data.messages[0].message);
                const metadata = JSON.parse(decoded);

                // Detect type based on the identifier message Type field
                const isChannel = metadata.Type === "ChannelIdentifier";
                const isGroup = metadata.Type === "GroupIdentifier";

                if (isChannel) {
                    router.push(`/channel/${trimmedId}`);
                } else if (isGroup) {
                    router.push(`/group/${trimmedId}`);
                } else {
                    // If not an identifier message, show error
                    toast.error("This topic is not a valid channel or group");
                    setIsFindingById(false);
                    return;
                }

                setShowFindById(false);
                setFindByIdValue("");
            } else {
                toast.error("No data found for this topic");
            }
        } catch (error) {
            console.error("Error finding topic:", error);
            toast.error("Error finding topic. Please try again.");
        } finally {
            setIsFindingById(false);
        }
    };

    // ========================================================================
    // DATA LOADING AND SYNCHRONIZATION
    // ========================================================================

    // Load owned channels and groups - handles both V1 and V2 profiles
    useEffect(() => {
        if (!profileData) {
            setChannels([]);
            setGroups([]);
            return;
        }

        // V2 Profile: Get data from useProfileLists hooks
        if (isV2) {
            // Channels from hook
            const channelData: Channel[] = channelsList.items.map((item: { Name?: string; Channel?: string; Description?: string; Media?: string }) => ({
                Name: item.Name || "Channel",
                Channel: item.Channel || "",
                Description: item.Description || "",
                Media: item.Media || "",
                isFollowed: false,
            }));
            setChannels(channelData);

            // Groups from hook
            const groupData: Group[] = groupsList.items.map((item: { Name?: string; Group?: string; Description?: string; Media?: string }) => ({
                Name: item.Name || "Group",
                Group: item.Group || "",
                Description: item.Description || "",
                Media: item.Media || "",
                isFollowed: false,
            }));
            setGroups(groupData);
        } else {
            // V1 Profile: Get data from profile arrays
            if (profileData?.Channels && Array.isArray(profileData.Channels)) {
                setChannels(profileData.Channels as unknown as Channel[]);
            } else {
                setChannels([]);
            }

            if (profileData?.Groups && Array.isArray(profileData.Groups)) {
                setGroups(profileData.Groups as unknown as Group[]);
            } else {
                setGroups([]);
            }
        }
    }, [profileData, isV2, channelsList.items, groupsList.items]);

    // Load followed channels - handles both V1 and V2 profiles
    useEffect(() => {
        if (!profileData) {
            setFollowedChannels([]);
            return;
        }

        // V2 Profile: Get data from useProfileLists hooks
        if (isV2) {
            const followedChannelData: Channel[] = followingChannelsList.items.map((item: { Name?: string; Channel?: string; Description?: string; Media?: string }) => ({
                Name: item.Name || "Followed Channel",
                Channel: item.Channel || "",
                Description: item.Description || "",
                Media: item.Media || "",
                isFollowed: true,
            }));
            setFollowedChannels(followedChannelData);
        } else {
            // V1 Profile: Get data from profile array
            const arrayData = getArrayData(profileData.FollowingChannels);
            if (!arrayData.length) {
                setFollowedChannels([]);
                return;
            }

            // Handle both old (string[]) and new (object[]) formats
            const channels: Channel[] = arrayData.map((item: unknown) => {
                if (typeof item === "string") {
                    // Legacy format - just ID
                    return {
                        Name: "Followed Channel",
                        Channel: item,
                        Description: "",
                        Media: "",
                        isFollowed: true,
                    };
                }
                // New format - full metadata object
                const typedItem = item as { Name?: string; Channel?: string; Description?: string; Media?: string };
                return {
                    Name: typedItem.Name || "Followed Channel",
                    Channel: typedItem.Channel || "",
                    Description: typedItem.Description || "",
                    Media: typedItem.Media || "",
                    isFollowed: true,
                };
            });

            setFollowedChannels(channels);
        }
    }, [profileData, isV2, followingChannelsList.items]);

    // Load followed groups - handles both V1 and V2 profiles
    useEffect(() => {
        if (!profileData) {
            setFollowedGroups([]);
            return;
        }

        // V2 Profile: Get data from useProfileLists hooks
        if (isV2) {
            const followedGroupData: Group[] = followingGroupsList.items.map((item: { Name?: string; Group?: string; Description?: string; Media?: string }) => ({
                Name: item.Name || "Followed Group",
                Group: item.Group || "",
                Description: item.Description || "",
                Media: item.Media || "",
                isFollowed: true,
            }));
            setFollowedGroups(followedGroupData);
        } else {
            // V1 Profile: Get data from profile array
            const arrayData = getArrayData(profileData.FollowingGroups);
            if (!arrayData.length) {
                setFollowedGroups([]);
                return;
            }

            // Handle both old (string[]) and new (object[]) formats
            const groups: Group[] = arrayData.map((item: unknown) => {
                if (typeof item === "string") {
                    // Legacy format - just ID
                    return {
                        Name: "Followed Group",
                        Group: item,
                        Description: "",
                        Media: "",
                        isFollowed: true,
                    };
                }
                // New format - full metadata object
                const typedItem = item as { Name?: string; Group?: string; Description?: string; Media?: string };
                return {
                    Name: typedItem.Name || "Followed Group",
                    Group: typedItem.Group || "",
                    Description: typedItem.Description || "",
                    Media: typedItem.Media || "",
                    isFollowed: true,
                };
            });

            setFollowedGroups(groups);
        }
    }, [profileData, isV2, followingGroupsList.items]);

    // ========================================================================
    // UNIFIED LIST LOGIC
    // ========================================================================

    const unifiedItems = useMemo((): ChatItem[] => {
        // Owned channels and groups
        const channelItems: ChatItem[] = channels.map((channel) => ({
            type: "channel" as const,
            data: { ...channel, isFollowed: false },
        }));

        const groupItems: ChatItem[] = groups.map((group) => ({
            type: "group" as const,
            data: { ...group, isFollowed: false },
        }));

        // Followed channels and groups (already have isFollowed: true from fetch)
        const followedChannelItems: ChatItem[] = followedChannels.map((channel) => ({
            type: "channel" as const,
            data: channel,
        }));

        const followedGroupItems: ChatItem[] = followedGroups.map((group) => ({
            type: "group" as const,
            data: group,
        }));

        let allItems = [...channelItems, ...groupItems, ...followedChannelItems, ...followedGroupItems];

        // Apply type filter
        if (filterType === "channels") {
            allItems = allItems.filter((item) => item.type === "channel");
        } else if (filterType === "groups") {
            allItems = allItems.filter((item) => item.type === "group");
        }

        // Apply search filter
        if (searchTerm) {
            allItems = allItems.filter((item) => {
                const name = item.type === "channel" ? item.data.Name : item.data.Name;
                const description = item.data.Description || "";
                return (
                    name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    description.toLowerCase().includes(searchTerm.toLowerCase())
                );
            });
        }

        // Sort by name
        allItems.sort((a, b) => {
            const nameA = a.data.Name.toLowerCase();
            const nameB = b.data.Name.toLowerCase();
            const comparison = nameA.localeCompare(nameB);
            return sortOrder === "asc" ? comparison : -comparison;
        });

        return allItems;
    }, [channels, groups, followedChannels, followedGroups, filterType, searchTerm, sortOrder]);

    const toggleSortOrder = () => {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    };

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    const handleItemClick = (item: ChatItem) => {
        if (item.type === "channel") {
            onChannelClick(item.data as Channel);
        } else {
            onGroupClick(item.data as Group);
        }
    };

    const handleCopyTopicId = (e: React.MouseEvent, item: ChatItem) => {
        e.stopPropagation();
        const topicId = item.type === "channel"
            ? (item.data as Channel).Channel
            : (item.data as Group).Group;
        navigator.clipboard.writeText(topicId).then(() => {
            toast.success(`Topic ID copied: ${topicId}`);
        });
    };

    const handleCreateNew = (type: "channel" | "group") => {
        // First check wallet connection
        if (!isConnected) {
            setShowConnectModal(true);
            return;
        }

        // Check if profile is still loading
        if (isLoading) {
            toast.info("Loading profile data, please wait...");
            return;
        }

        // Check if user has a profile before allowing channel/group creation
        if (!profileData || !profileData.ProfileTopic) {
            toast.info("Please create a profile first before creating channels or groups");
            router.push("/profile");
            return;
        }

        // User has a profile, proceed to create channel/group
        if (type === "channel") {
            setShowCreateChannel(true);
        } else {
            setShowCreateGroup(true);
        }
    };

    // ========================================================================
    // RENDER FUNCTIONS
    // ========================================================================

    const renderChatItem = (item: ChatItem, index: number) => {
        const isChannel = item.type === "channel";
        const name = item.data.Name;
        const description = item.data.Description;
        const media = item.data.Media;
        const topicId = isChannel
            ? (item.data as Channel).Channel
            : (item.data as Group).Group;

        // Theme colors based on type
        const themeColors = isChannel
            ? {
                border: "border-cyan-400/20 hover:border-cyan-400/50",
                gradient: "from-cyan-400/5 to-blue-500/5",
                ring: "ring-cyan-400/30 group-hover:ring-cyan-400/70",
                shadow: "group-hover:shadow-cyan-400/30",
                text: "from-cyan-400 to-blue-400 group-hover:from-cyan-300 group-hover:to-blue-300",
                badge: "bg-cyan-400/20 text-cyan-300 border-cyan-400/30",
                icon: "text-cyan-400",
                iconBg: "from-cyan-400/20 to-blue-500/20",
                button: "bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-400",
                actionButton: "from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400",
                topicBg: "border-cyan-400/10",
                topicText: "text-cyan-300/80",
                topicValue: "text-cyan-400",
            }
            : {
                border: "border-purple-400/20 hover:border-purple-400/50",
                gradient: "from-purple-400/5 to-pink-500/5",
                ring: "ring-purple-400/30 group-hover:ring-purple-400/70",
                shadow: "group-hover:shadow-purple-400/30",
                text: "from-purple-400 to-pink-400 group-hover:from-purple-300 group-hover:to-pink-300",
                badge: "bg-purple-400/20 text-purple-300 border-purple-400/30",
                icon: "text-purple-400",
                iconBg: "from-purple-400/20 to-pink-500/20",
                button: "bg-purple-400/10 hover:bg-purple-400/20 text-purple-400",
                actionButton: "from-purple-400 to-pink-500 hover:from-purple-300 hover:to-pink-400",
                topicBg: "border-purple-400/10",
                topicText: "text-purple-300/80",
                topicValue: "text-purple-400",
            };

        return (
            <div
                key={`${item.type}-${topicId}-${index}`}
                onClick={() => handleItemClick(item)}
                className={`group relative bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-md sm:rounded-2xl p-5 border-y sm:border ${themeColors.border} transition-all duration-300 cursor-pointer hover:scale-[1.01] hover:shadow-2xl ${themeColors.shadow} overflow-hidden active:scale-[0.99]`}
            >
                {/* Animated background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${themeColors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                {/* Content */}
                <div className="relative z-10">
                    <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="relative">
                            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden flex-shrink-0 ring-2 ${themeColors.ring} transition-all duration-300 shadow-lg`}>
                                {media ? (
                                    <ReadMediaFile cid={media} />
                                ) : (
                                    <div className={`w-full h-full bg-gradient-to-br ${themeColors.iconBg} flex items-center justify-center`}>
                                        {isChannel ? (
                                            <RiMessage3Line className={`text-2xl sm:text-3xl ${themeColors.icon}`} />
                                        ) : (
                                            <RiGroupLine className={`text-2xl sm:text-3xl ${themeColors.icon}`} />
                                        )}
                                    </div>
                                )}
                            </div>
                            {/* Status indicator */}
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-slate-900 flex items-center justify-center">
                                {isChannel ? (
                                    <RiEyeLine className="text-xs text-slate-900" />
                                ) : (
                                    <RiGlobalLine className="text-xs text-slate-900" />
                                )}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h3 className={`text-lg sm:text-xl font-mono font-bold text-white truncate bg-gradient-to-r ${themeColors.text} bg-clip-text text-transparent transition-all duration-300`}>
                                    {name}
                                </h3>
                                <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 ${themeColors.badge} text-xs font-mono rounded-full border`}>
                                    {isChannel ? "Channel" : "Group"}
                                </span>
                                {item.data.isFollowed && (
                                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-400/20 text-emerald-300 border-emerald-400/30 text-xs font-mono rounded-full border">
                                        Following
                                    </span>
                                )}
                            </div>

                            <div className={`bg-slate-800/60 rounded-lg p-2 sm:p-2.5 mb-2 sm:mb-3 border ${themeColors.topicBg}`}>
                                <p className={`text-xs ${themeColors.topicText} font-mono mb-0.5 sm:mb-1`}>
                                    Topic ID
                                </p>
                                <p className={`text-xs ${themeColors.topicValue} font-mono truncate font-semibold`}>
                                    {topicId}
                                </p>
                            </div>

                            {description && (
                                <p className="text-white/70 text-sm leading-relaxed font-light line-clamp-2 group-hover:text-white/80 transition-colors duration-300 hidden sm:block">
                                    {description}
                                </p>
                            )}
                        </div>

                        {/* Action Buttons - Always Visible */}
                        <div className="flex flex-col items-center gap-2">
                            <button
                                onClick={(e) => handleCopyTopicId(e, item)}
                                className={`p-2 sm:p-3 rounded-full ${themeColors.button} transition-all duration-200 hover:scale-110 active:scale-95 shadow-md hover:shadow-lg`}
                                title="Copy Topic ID"
                            >
                                <RiFileCopyLine className="text-base sm:text-lg" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleShareLink(isChannel ? "channel" : "group", topicId);
                                }}
                                className="p-2 sm:p-3 rounded-full bg-emerald-400/20 text-emerald-400 hover:bg-emerald-400/30 transition-all duration-200 hover:scale-110 active:scale-95 shadow-md hover:shadow-lg"
                                title="Copy Share Link"
                            >
                                <RiShareLine className="text-base sm:text-lg" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleItemClick(item);
                                }}
                                className={`p-2 sm:p-3 rounded-full bg-gradient-to-r ${themeColors.actionButton} text-white transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl`}
                                title={`View ${isChannel ? "Channel" : "Group"}`}
                            >
                                <RiArrowRightLine className="text-base sm:text-lg" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderLoading = () => (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-400/10 to-purple-500/10 flex items-center justify-center border-2 border-indigo-400/20 shadow-lg shadow-indigo-400/10 mb-4">
                <Spinner />
            </div>
            <p className="text-white/60 font-mono">Loading your chats...</p>
        </div>
    );

    const renderError = () => (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-red-400/20 flex items-center justify-center mb-4">
                <span className="text-red-400 text-xl">!</span>
            </div>
            <p className="text-red-400 font-mono mb-2">Error loading chats</p>
            <p className="text-white/60 text-sm font-mono">{error}</p>
        </div>
    );

    const renderEmpty = () => (
        <div className="flex flex-col items-center justify-center py-16">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-400/10 to-purple-500/10 flex items-center justify-center mb-6 border-2 border-indigo-400/20 shadow-lg shadow-indigo-400/10">
                <RiMessage3Line className="text-4xl text-indigo-400/60" />
            </div>
            <h3 className="text-2xl font-mono font-bold text-white/90 mb-3">
                No Chats Yet
            </h3>
            <p className="text-white/60 text-sm font-mono text-center mb-8 max-w-md leading-relaxed">
                Create channels for announcements or groups for community discussions.
                Or find existing channels and groups by their Topic ID!
            </p>

            {/* Find by ID Button */}
            <button
                onClick={() => setShowFindById(true)}
                className="mb-6 px-6 py-3 bg-gradient-to-r from-emerald-400/20 to-teal-500/20 hover:from-emerald-400/30 hover:to-teal-500/30 text-emerald-400 font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 font-mono border border-emerald-400/30 hover:border-emerald-400/50"
            >
                <RiSearchLine className="text-lg" />
                Find Channel or Group by ID
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-4">
                <button
                    onClick={() => handleCreateNew("channel")}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-semibold rounded-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2 font-mono shadow-lg hover:shadow-xl hover:shadow-cyan-400/30"
                >
                    <RiMessage3Line className="text-lg" />
                    Create Channel
                </button>
                <button
                    onClick={() => handleCreateNew("group")}
                    className="px-6 py-3 bg-gradient-to-r from-purple-400 to-pink-500 text-white font-semibold rounded-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2 font-mono shadow-lg hover:shadow-xl hover:shadow-purple-400/30"
                >
                    <RiGroupLine className="text-lg" />
                    Create Group
                </button>
            </div>
        </div>
    );

    const renderSearchAndFilters = () => (
        <div className="mb-6 space-y-4">
            {/* Search Bar */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <RiSearchLine className="h-5 w-5 text-indigo-400/60" />
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3 bg-slate-800/60 backdrop-blur-sm border border-indigo-400/30 rounded-xl text-white placeholder-indigo-400/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 transition-all duration-200 font-mono"
                    placeholder="Search channels and groups..."
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm("")}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-indigo-400/60 hover:text-indigo-400 transition-colors"
                    >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Type Filter Buttons */}
                <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 border border-indigo-400/20">
                    {(["all", "channels", "groups"] as FilterType[]).map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-3 py-1.5 rounded-md text-sm font-mono transition-all duration-200 ${filterType === type
                                ? "bg-indigo-500 text-white shadow-md"
                                : "text-indigo-400/80 hover:text-white hover:bg-indigo-400/10"
                                }`}
                        >
                            {type === "all" ? "All" : type === "channels" ? "Channels" : "Groups"}
                        </button>
                    ))}
                </div>

                {/* Sort Button */}
                <button
                    onClick={toggleSortOrder}
                    className="p-2 rounded-lg bg-slate-800/60 hover:bg-indigo-400/10 text-indigo-400 transition-all duration-200 border border-indigo-400/20"
                    title={`Sort ${sortOrder === "asc" ? "Descending" : "Ascending"}`}
                >
                    {sortOrder === "asc" ? (
                        <RiSortAsc className="w-5 h-5" />
                    ) : (
                        <RiSortDesc className="w-5 h-5" />
                    )}
                </button>

                {/* Find by ID Button */}
                <button
                    onClick={() => setShowFindById(true)}
                    className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-400/20 to-teal-500/20 hover:from-emerald-400/30 hover:to-teal-500/30 text-emerald-400 transition-all duration-200 border border-emerald-400/30 flex items-center gap-2 font-mono text-sm"
                    title="Find channel or group by Topic ID"
                >
                    <RiLinkM className="w-4 h-4" />
                    <span className="hidden sm:inline">Find by ID</span>
                </button>

                {/* Results Count */}
                <span className="text-sm text-indigo-400/60 font-mono ml-auto">
                    {unifiedItems.length} {unifiedItems.length === 1 ? "chat" : "chats"}
                </span>
            </div>
        </div>
    );

    // Header removed - buttons moved to floating position at bottom

    // ========================================================================
    // MAIN RENDER
    // ========================================================================

    const totalChats = channels.length + groups.length + followedChannels.length + followedGroups.length;

    // Only show floating buttons if user has owned channels or groups
    const hasOwnedChats = channels.length + groups.length > 0;

    const floatingButtons = hasOwnedChats ? (
        <div className="fixed bottom-6 left-6 sm:bottom-10 sm:left-10 z-50 flex flex-row gap-3">
            {/* Create Channel Button */}
            <button
                onClick={() => handleCreateNew("channel")}
                className="px-4 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-semibold rounded-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2 font-mono text-sm shadow-2xl shadow-cyan-400/25 border border-cyan-400/40 hover:border-cyan-400/70 hover:shadow-cyan-400/40"
                title="Create Channel"
            >
                <div className="flex items-center">
                    <RiMessage3Line className="text-lg" />
                    <RiAddLine className="text-base -ml-0.5" />
                </div>
                <span className="hidden sm:inline">Channel</span>
            </button>

            {/* Create Group Button */}
            <button
                onClick={() => handleCreateNew("group")}
                className="px-4 py-3 bg-gradient-to-r from-purple-400 to-pink-500 text-white font-semibold rounded-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2 font-mono text-sm shadow-2xl shadow-purple-400/25 border border-purple-400/40 hover:border-purple-400/70 hover:shadow-purple-400/40"
                title="Create Group"
            >
                <div className="flex items-center">
                    <RiGroupLine className="text-lg" />
                    <RiAddLine className="text-base -ml-0.5" />
                </div>
                <span className="hidden sm:inline">Group</span>
            </button>
        </div>
    ) : null;

    return (
        <div className={`w-full ${className}`}>
            {isMounted && typeof document !== "undefined" && createPortal(floatingButtons, document.body)}

            {/* Loading State */}
            {isLoading && renderLoading()}

            {/* Error State */}
            {!isLoading && error && renderError()}

            {/* Empty State */}
            {!isLoading && !error && totalChats === 0 && renderEmpty()}

            {/* Chat List */}
            {!isLoading && !error && totalChats > 0 && (
                <div className="space-y-4 pb-20">
                    {renderSearchAndFilters()}

                    {/* Chat Items */}
                    <div className="space-y-2 sm:space-y-3">
                        {unifiedItems.length > 0 ? (
                            unifiedItems.map((item, index) => renderChatItem(item, index))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400/10 to-purple-500/10 flex items-center justify-center mb-4 border-2 border-indigo-400/20">
                                    <RiSearchLine className="text-2xl text-indigo-400/60" />
                                </div>
                                <h3 className="text-lg font-mono font-bold text-white/90 mb-2">
                                    No Results Found
                                </h3>
                                <p className="text-white/60 text-sm font-mono text-center max-w-md">
                                    No chats match your search. Try different keywords or clear the filters.
                                </p>
                                <button
                                    onClick={() => {
                                        setSearchTerm("");
                                        setFilterType("all");
                                    }}
                                    className="mt-4 px-4 py-2 bg-indigo-400/20 text-indigo-300 rounded-lg hover:bg-indigo-400/30 transition-all duration-200 font-mono text-sm"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Channel Modal */}
            <Modal isOpen={showCreateChannel} onClose={() => setShowCreateChannel(false)}>
                <CreateNewChannel onClose={() => setShowCreateChannel(false)} />
            </Modal>

            {/* Create Group Modal */}
            <Modal isOpen={showCreateGroup} onClose={() => setShowCreateGroup(false)}>
                <CreateNewGroup onClose={() => setShowCreateGroup(false)} />
            </Modal>

            {/* Connect Wallet Modal */}
            <ConnectModal
                isOpen={showConnectModal}
                onClose={() => setShowConnectModal(false)}
            />

            {/* Create Profile Modal - shown when user tries to create channel/group without a profile */}
            <Modal isOpen={showCreateProfile} onClose={() => setShowCreateProfile(false)}>
                <CreateNewProfile onClose={() => setShowCreateProfile(false)} />
            </Modal>

            {/* Find by ID Modal */}
            <Modal isOpen={showFindById} onClose={() => setShowFindById(false)}>
                <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl border border-emerald-400/30 p-6 w-full max-w-md mx-auto shadow-2xl shadow-emerald-400/10">
                    {/* Header */}
                    <div className="flex items-center gap-4 mb-6 pb-4 border-b border-emerald-400/20">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 flex items-center justify-center border border-emerald-400/30 shadow-lg shadow-emerald-400/10">
                            <RiLinkM className="w-7 h-7 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-mono font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                                Find by Topic ID
                            </h2>
                            <p className="text-sm text-white/60 font-mono">
                                Enter a channel or group ID to open
                            </p>
                        </div>
                    </div>

                    {/* Topic ID Input */}
                    <div className="mb-6">
                        <label className="block text-sm font-mono text-white/80 mb-2">
                            Topic ID <span className="text-emerald-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={findByIdValue}
                            onChange={(e) => setFindByIdValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !isFindingById && handleFindById()}
                            placeholder="e.g., 0.0.12345"
                            disabled={isFindingById}
                            className="w-full px-4 py-3.5 bg-slate-800/80 border-2 border-emerald-400/30 rounded-xl text-white placeholder-emerald-400/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 font-mono disabled:opacity-50 transition-all duration-200"
                        />
                        <p className="text-xs text-white/50 font-mono mt-2 flex items-center gap-1">
                            <RiSearchLine className="w-3 h-3" />
                            Channel or group type is detected automatically
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowFindById(false)}
                            disabled={isFindingById}
                            className="flex-1 px-4 py-3 bg-slate-700/80 hover:bg-slate-600 text-white rounded-xl font-mono text-sm transition-all duration-200 disabled:opacity-50 border border-slate-600/50 hover:border-slate-500"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleFindById}
                            disabled={isFindingById || !findByIdValue.trim()}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-white rounded-xl font-mono text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-400/20 hover:shadow-emerald-400/30"
                        >
                            {isFindingById ? (
                                <>
                                    <Spinner />
                                    Finding...
                                </>
                            ) : (
                                <>
                                    <RiArrowRightLine className="w-4 h-4" />
                                    Find & Open
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UnifiedChatList;
