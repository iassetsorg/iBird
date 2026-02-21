/**
 * Profile is a React component that handles the display and management of user profiles.
 * It provides functionality to:
 * - View existing profile information
 * - Create a new profile if none exists
 * - Update existing profile information
 * - Display user's media and activity
 * - V2 Profile Support: Resolves topic IDs to actual list counts
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import useGetProfile, { isV2Profile, getTopicId, getArrayData } from "../hooks/use_get_profile";
import useProfileLists from "../hooks/use_profile_lists";
import CreateProfile from "./create_new_profile";
import UpdateProfile from "./update_profile";
import Modal from "../common/modal";
import { useWalletContext } from "../wallet/WalletContext";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";

/**
 * Main Profile component that orchestrates the display and management of user profiles
 * @returns {JSX.Element} The rendered Profile component
 */
const Profile: React.FC = () => {
  const router = useRouter();
  const { isConnected } = useWalletContext();
  const { data: accountId } = useAccountId();
  const { profileData, isLoading, error } = useGetProfile(accountId || "");
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [isCreateProfileModalOpen, setIsCreateProfileModalOpen] =
    useState(false);
  const [isUpdateProfileModalOpen, setIsUpdateProfileModalOpen] =
    useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [selectedModalContent, setSelectedModalContent] = useState<{
    type: string;
    title: string;
    data: string[];
  } | null>(null);

  // Enhanced error handling with retry functionality
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // V2 Profile Support - Get topic IDs for list data
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

  // V2 Profile Support - Computed counts and data that work for both V1 and V2 profiles
  const channelsCount = useMemo(() => {
    if (!profileData) return 0;
    if (isV2) return channelsList.items.length;
    return getArrayData(profileData.Channels).length;
  }, [profileData, isV2, channelsList.items]);

  const groupsCount = useMemo(() => {
    if (!profileData) return 0;
    if (isV2) return groupsList.items.length;
    return getArrayData(profileData.Groups).length;
  }, [profileData, isV2, groupsList.items]);

  const followingChannelsCount = useMemo(() => {
    if (!profileData) return 0;
    if (isV2) return followingChannelsList.items.length;
    return getArrayData(profileData.FollowingChannels).length;
  }, [profileData, isV2, followingChannelsList.items]);

  const followingGroupsCount = useMemo(() => {
    if (!profileData) return 0;
    if (isV2) return followingGroupsList.items.length;
    return getArrayData(profileData.FollowingGroups).length;
  }, [profileData, isV2, followingGroupsList.items]);

  // V2 Profile Support - Get data arrays for modals
  const getChannelsData = useCallback((): string[] => {
    if (!profileData) return [];
    if (isV2) {
      // For V2, return channel topic IDs from the items
      return channelsList.items.map((item: { Channel?: string; Name?: string }) =>
        item.Channel || item.Name || JSON.stringify(item)
      );
    }
    // For V1, return the raw array data (cast needed for legacy compatibility)
    const data = getArrayData(profileData.Channels);
    return data.map((item) => {
      if (typeof item === 'string') return item;
      const typedItem = item as { Channel?: string; Name?: string };
      return typedItem?.Channel || typedItem?.Name || JSON.stringify(item);
    });
  }, [profileData, isV2, channelsList.items]);

  const getGroupsData = useCallback((): string[] => {
    if (!profileData) return [];
    if (isV2) {
      return groupsList.items.map((item: { Group?: string; Name?: string }) =>
        item.Group || item.Name || JSON.stringify(item)
      );
    }
    const data = getArrayData(profileData.Groups);
    return data.map((item) => {
      if (typeof item === 'string') return item;
      const typedItem = item as { Group?: string; Name?: string };
      return typedItem?.Group || typedItem?.Name || JSON.stringify(item);
    });
  }, [profileData, isV2, groupsList.items]);

  const getFollowingChannelsData = useCallback((): string[] => {
    if (!profileData) return [];
    if (isV2) {
      return followingChannelsList.items.map((item: { Channel?: string; Name?: string }) =>
        item.Channel || item.Name || JSON.stringify(item)
      );
    }
    const data = getArrayData(profileData.FollowingChannels);
    return data.map((item) => {
      if (typeof item === 'string') return item;
      const typedItem = item as { Channel?: string; Name?: string };
      return typedItem?.Channel || typedItem?.Name || JSON.stringify(item);
    });
  }, [profileData, isV2, followingChannelsList.items]);

  const getFollowingGroupsData = useCallback((): string[] => {
    if (!profileData) return [];
    if (isV2) {
      return followingGroupsList.items.map((item: { Group?: string; Name?: string }) =>
        item.Group || item.Name || JSON.stringify(item)
      );
    }
    const data = getArrayData(profileData.FollowingGroups);
    return data.map((item) => {
      if (typeof item === 'string') return item;
      const typedItem = item as { Group?: string; Name?: string };
      return typedItem?.Group || typedItem?.Name || JSON.stringify(item);
    });
  }, [profileData, isV2, followingGroupsList.items]);


  // Retry handler for failed profile loading
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    // Simulate retry delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // The useGetProfile hook will automatically retry when accountId changes
    // We can trigger a re-render by updating a state that affects the hook
    setIsRetrying(false);
  }, []);

  // Handle opening section modal with enhanced UX
  const openSectionModal = useCallback(
    (type: string, title: string, data: string[]) => {
      setSelectedModalContent({ type, title, data });
      setIsSectionModalOpen(true);
    },
    []
  );

  // Handle closing section modal with animation
  const closeSectionModal = useCallback(() => {
    setIsSectionModalOpen(false);
    // Clear content after animation completes
    setTimeout(() => setSelectedModalContent(null), 200);
  }, []);

  // Debug logging to understand the state
  console.log("Profile Debug:", {
    isConnected,
    accountId,
    profileData,
    isLoading,
    isCheckingProfile,
    error,
  });

  /**
   * Handlers for closing different modal windows
   * These functions ensure clean state management when modals are dismissed
   */
  const closeCreateProfileModal = () => {
    setIsCreateProfileModalOpen(false);
  };

  const closeUpdateProfileModal = () => {
    setIsUpdateProfileModalOpen(false);
  };

  /**
   * Effect hook to update profile checking state
   * Transitions from loading to ready state once profile data is available
   */
  useEffect(() => {
    if (!isLoading) {
      setIsCheckingProfile(false);
    }
  }, [isLoading, profileData]);

  return (
    <div className="relative py-12 h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 ">
      {/* Animated Background Effects */}
      <div className="absolute inset-0 bg-cyber-grid opacity-10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-radial from-cyan-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
      <div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-radial from-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse"
        style={{ animationDelay: "2s" }}
      />

      <div className="relative z-10 flex flex-col w-full h-full pt-14 sm:pt-16 lg:pt-18">
        <div className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 overflow-y-auto mt-2 sm:mt-3 lg:mt-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-800/30 [&::-webkit-scrollbar-thumb]:bg-gradient-to-b [&::-webkit-scrollbar-thumb]:from-purple-500 [&::-webkit-scrollbar-thumb]:to-purple-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-purple-400/30 [&::-webkit-scrollbar-corner]:bg-slate-900/50">
          {/* Enhanced Loading State */}
          {isLoading && (
            <div className="flex flex-col justify-center items-center h-full space-y-8">
              {/* Enhanced Loading Spinner */}
              <div className="relative">
                <div className="w-20 h-20 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin"></div>
                <div
                  className="absolute inset-0 w-20 h-20 border-4 border-purple-400/20 border-r-purple-400 rounded-full animate-spin"
                  style={{
                    animationDirection: "reverse",
                    animationDelay: "0.5s",
                  }}
                ></div>
                <div
                  className="absolute inset-2 w-16 h-16 border-2 border-pink-400/30 border-b-pink-400 rounded-full animate-spin"
                  style={{
                    animationDirection: "reverse",
                    animationDelay: "1s",
                  }}
                ></div>
              </div>

              {/* Loading Text with Typewriter Effect */}
              <div className="text-center space-y-2">
                <div className="text-cyan-100/80 font-mono text-lg">
                  Loading profile...
                </div>
                <div className="flex justify-center space-x-1">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>

              {/* Skeleton Profile Preview */}
              <div className="w-full max-w-2xl mx-auto space-y-4 p-6">
                <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-2xl h-32 animate-pulse"></div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full animate-pulse"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-800/50 rounded animate-pulse w-3/4"></div>
                    <div className="h-3 bg-slate-800/50 rounded animate-pulse w-1/2"></div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="text-center space-y-2">
                      <div className="h-6 bg-slate-800/50 rounded animate-pulse mx-auto w-8"></div>
                      <div className="h-3 bg-slate-800/50 rounded animate-pulse w-16 mx-auto"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Error State with Retry */}
          {error && (
            <div className="flex justify-center items-center h-full">
              <div className="relative bg-gradient-to-r from-red-900/50 to-red-800/50 backdrop-blur-md border border-red-500/30 rounded-2xl p-6 sm:p-8 text-center shadow-2xl shadow-red-500/10 max-w-md mx-4">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-red-400/10 to-pink-500/10 rounded-2xl blur-xl" />

                <div className="relative z-10 space-y-4 sm:space-y-6">
                  <div className="text-red-400 text-3xl sm:text-4xl mb-2">
                    ⚠️
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-red-300 font-mono text-lg sm:text-xl font-semibold">
                      Connection Error
                    </h3>
                    <p className="text-red-200/80 font-mono text-sm sm:text-base leading-relaxed">
                      {error}
                    </p>
                    {retryCount > 0 && (
                      <p className="text-red-300/60 font-mono text-xs">
                        Retry attempts: {retryCount}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={handleRetry}
                      disabled={isRetrying}
                      className="group relative px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg sm:rounded-xl font-mono font-semibold text-white text-sm sm:text-base shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        {isRetrying ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Retrying...
                          </>
                        ) : (
                          <>
                            <span>🔄</span>
                            Try Again
                          </>
                        )}
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                    </button>

                    <button
                      onClick={() => setIsCreateProfileModalOpen(true)}
                      className="group relative px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg sm:rounded-xl font-mono font-semibold text-white text-sm sm:text-base shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 hover:scale-105"
                    >
                      <span className="relative z-10">Create Profile</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                    </button>
                  </div>

                  <div className="text-red-300/50 font-mono text-xs border-t border-red-500/20 pt-4">
                    If the problem persists, try refreshing the page or check
                    your wallet connection.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No Profile State */}
          {!isLoading && !profileData && !isCheckingProfile && (
            <div className="flex justify-center items-center h-full">
              <div className="relative bg-gradient-to-r from-slate-900/80 via-purple-900/50 to-slate-900/80 backdrop-blur-xl border border-cyan-400/30 rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-12 text-center shadow-2xl shadow-cyan-400/10 mx-3">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/10 via-purple-500/10 to-pink-500/10 rounded-2xl sm:rounded-3xl blur-xl" />

                <div className="relative z-10 space-y-4 sm:space-y-6">
                  <div className="text-4xl sm:text-5xl lg:text-6xl mb-2 sm:mb-4">
                    🚀
                  </div>
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-mono bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent px-2">
                    Create Your Web3 Identity
                  </h2>
                  <p className="text-cyan-100/70 font-mono text-sm sm:text-base max-w-xs sm:max-w-md mx-auto px-2">
                    Join the decentralized revolution. Own your data, control
                    your narrative.
                  </p>
                  <button
                    className="group relative px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg sm:rounded-xl font-mono font-semibold text-white text-sm sm:text-base shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300 hover:scale-105"
                    onClick={() => setIsCreateProfileModalOpen(true)}
                  >
                    <span className="relative z-10">Create Profile</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Existing Profile Display */}
          {profileData && !isCheckingProfile && isConnected && (
            <div className="space-y-2 sm:space-y-3 lg:space-y-4 pb-2">
              {/* Twitter-style Banner Section - Only show if user has a banner */}
              {profileData.Banner && (
                <div className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden border border-cyan-400/30 shadow-2xl shadow-cyan-400/10">
                  <img
                    src={`https://arweave.net/${profileData.Banner.replace(
                      "ar://",
                      ""
                    )}`}
                    alt="Profile Banner"
                    className="w-full h-auto object-contain"
                    onLoad={() => console.log("Direct banner image loaded!")}
                    onError={() => console.log("Direct banner image failed!")}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent" />
                </div>
              )}

              {/* Profile Information Card */}
              <div className="relative bg-gradient-to-r from-slate-900/80 via-purple-900/50 to-slate-900/80 backdrop-blur-xl border border-cyan-400/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/5 via-purple-500/5 to-pink-500/5 blur-xl" />

                {/* Action Buttons positioned in top right corner */}
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                  <button
                    onClick={() => router.push("/app")}
                    className="group relative px-3 sm:px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg font-mono font-medium text-white text-xs sm:text-sm shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300 hover:scale-105 whitespace-nowrap"
                  >
                    <span className="relative z-10 flex items-center gap-1">
                     
                      Explorer
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                  </button>
                  <button
                    onClick={() => setIsUpdateProfileModalOpen(true)}
                    className="group relative px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg font-mono font-medium text-white text-xs sm:text-sm shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 hover:scale-105 whitespace-nowrap"
                  >
                    <span className="relative z-10">Update Profile</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                  </button>
                </div>

                {/* Profile Content */}
                <div className="relative z-10 space-y-3">
                  {/* Profile Picture and Name Section */}
                  <div className="flex items-start gap-4 mt-3">
                    {/* Profile Picture on the left */}
                    {profileData.Picture && (
                      <div className="relative group flex-shrink-0">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full overflow-hidden border-2 border-purple-600 shadow-xl">
                          <img
                            src={`https://arweave.net/${profileData.Picture.replace(
                              "ar://",
                              ""
                            )}`}
                            alt="Profile"
                            className="w-full h-full object-cover rounded-full"
                            onLoad={() => console.log("Direct image loaded!")}
                            onError={() => console.log("Direct image failed!")}
                          />
                        </div>
                        {/* Glow effect around avatar */}
                        <div className="absolute inset-0 bg-purple-600/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-300" />
                      </div>
                    )}

                    {/* Name and Info on the right */}
                    <div className="flex-1 space-y-2">
                      <h1 className="text-lg sm:text-xl lg:text-2xl font-mono font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-blue-400 bg-clip-text text-transparent break-words">
                        {profileData.Name}
                      </h1>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="text-cyan-400/80 font-mono text-xs">
                          Account ID:
                        </span>
                        <a
                          href={`https://hashscan.io/${
                            process.env.NEXT_PUBLIC_NETWORK === "mainnet"
                              ? "mainnet"
                              : "testnet"
                          }/account/${accountId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-300 hover:text-cyan-100 font-mono text-xs underline decoration-cyan-400/50 hover:decoration-cyan-400 transition-colors break-all"
                        >
                          {accountId}
                        </a>
                      </div>

                      {/* Website */}
                      {profileData.Website && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <a
                            href={
                              profileData.Website.startsWith("http")
                                ? profileData.Website
                                : `https://${profileData.Website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 hover:text-cyan-100 font-mono text-xs underline decoration-cyan-400/50 hover:decoration-cyan-400 transition-colors break-all"
                          >
                            {profileData.Website}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  {profileData.Bio && (
                    <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 rounded-lg p-2 sm:p-3 border border-cyan-400/20">
                      <p className="text-cyan-100/90 font-mono text-xs leading-relaxed whitespace-pre-line">
                        {profileData.Bio}
                      </p>
                    </div>
                  )}

                  {/* Enhanced Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {/* Channels */}
                    <div
                      className="group relative text-center cursor-pointer hover:bg-cyan-400/10 rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cyan-400/20 border border-cyan-400/10 hover:border-cyan-400/30"
                      onClick={() =>
                        openSectionModal(
                          "channels",
                          "Channels",
                          getChannelsData()
                        )
                      }
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${channelsCount} channels`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openSectionModal(
                            "channels",
                            "Channels",
                            getChannelsData()
                          );
                        }
                      }}
                    >
                      <div className="relative">
                        <div className="text-lg sm:text-xl font-mono font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors duration-300">
                          {channelsCount}
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                      </div>
                      <div className="text-xs sm:text-sm font-mono text-cyan-100/70 group-hover:text-cyan-100/90 transition-colors duration-300 mt-1">
                        Channels
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-transparent rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>

                    {/* Groups */}
                    <div
                      className="group relative text-center cursor-pointer hover:bg-purple-400/10 rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-400/20 border border-purple-400/10 hover:border-purple-400/30"
                      onClick={() =>
                        openSectionModal(
                          "groups",
                          "Groups",
                          getGroupsData()
                        )
                      }
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${groupsCount} groups`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openSectionModal(
                            "groups",
                            "Groups",
                            getGroupsData()
                          );
                        }
                      }}
                    >
                      <div className="relative">
                        <div className="text-lg sm:text-xl font-mono font-bold text-purple-400 group-hover:text-purple-300 transition-colors duration-300">
                          {groupsCount}
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                      </div>
                      <div className="text-xs sm:text-sm font-mono text-cyan-100/70 group-hover:text-cyan-100/90 transition-colors duration-300 mt-1">
                        Groups
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-400/5 to-transparent rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>

                    {/* Following Channels */}
                    <div
                      className="group relative text-center cursor-pointer hover:bg-blue-400/10 rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-400/20 border border-blue-400/10 hover:border-blue-400/30"
                      onClick={() =>
                        openSectionModal(
                          "following-channels",
                          "Following Channels",
                          getFollowingChannelsData()
                        )
                      }
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${followingChannelsCount} following channels`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openSectionModal(
                            "following-channels",
                            "Following Channels",
                            getFollowingChannelsData()
                          );
                        }
                      }}
                    >
                      <div className="relative">
                        <div className="text-lg sm:text-xl font-mono font-bold text-blue-400 group-hover:text-blue-300 transition-colors duration-300">
                          {followingChannelsCount}
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                      </div>
                      <div className="text-xs sm:text-sm font-mono text-cyan-100/70 group-hover:text-cyan-100/90 transition-colors duration-300 mt-1">
                        Following
                        <br />
                        Channels
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 to-transparent rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>

                    {/* Following Groups */}
                    <div
                      className="group relative text-center cursor-pointer hover:bg-indigo-400/10 rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-indigo-400/20 border border-indigo-400/10 hover:border-indigo-400/30"
                      onClick={() =>
                        openSectionModal(
                          "following-groups",
                          "Following Groups",
                          getFollowingGroupsData()
                        )
                      }
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${followingGroupsCount} following groups`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openSectionModal(
                            "following-groups",
                            "Following Groups",
                            getFollowingGroupsData()
                          );
                        }
                      }}
                    >
                      <div className="relative">
                        <div className="text-lg sm:text-xl font-mono font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors duration-300">
                          {followingGroupsCount}
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                      </div>
                      <div className="text-xs sm:text-sm font-mono text-cyan-100/70 group-hover:text-cyan-100/90 transition-colors duration-300 mt-1">
                        Following
                        <br />
                        Groups
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/5 to-transparent rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>

                    {/* Explorer Messages */}
                    <div
                      className="group relative text-center cursor-pointer hover:bg-violet-400/10 rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-violet-400/20 border border-violet-400/10 hover:border-violet-400/30"
                      onClick={() =>
                        openSectionModal(
                          "messages",
                          "Messages",
                          profileData.ExplorerMessages
                            ? [profileData.ExplorerMessages]
                            : []
                        )
                      }
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${
                        profileData.ExplorerMessages ? 1 : 0
                      } explorer messages`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openSectionModal(
                            "messages",
                            "Messages",
                            profileData.ExplorerMessages
                              ? [profileData.ExplorerMessages]
                              : []
                          );
                        }
                      }}
                    >
                      <div className="relative">
                        <div className="text-lg sm:text-xl font-mono font-bold text-violet-400 group-hover:text-violet-300 transition-colors duration-300">
                          {profileData.ExplorerMessages ? 1 : 0}
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-violet-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                      </div>
                      <div className="text-xs sm:text-sm font-mono text-cyan-100/70 group-hover:text-cyan-100/90 transition-colors duration-300 mt-1">
                        Explorer
                        <br />
                        Messages
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-400/5 to-transparent rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>

                    {/* Billboard Ads */}
                    <div
                      className="group relative text-center cursor-pointer hover:bg-sky-400/10 rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-sky-400/20 border border-sky-400/10 hover:border-sky-400/30"
                      onClick={() =>
                        openSectionModal(
                          "ads",
                          "Ads",
                          profileData.BillboardAds
                            ? [profileData.BillboardAds]
                            : []
                        )
                      }
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${
                        profileData.BillboardAds ? 1 : 0
                      } billboard ads`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openSectionModal(
                            "ads",
                            "Ads",
                            profileData.BillboardAds
                              ? [profileData.BillboardAds]
                              : []
                          );
                        }
                      }}
                    >
                      <div className="relative">
                        <div className="text-lg sm:text-xl font-mono font-bold text-sky-400 group-hover:text-sky-300 transition-colors duration-300">
                          {profileData.BillboardAds ? 1 : 0}
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-sky-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                      </div>
                      <div className="text-xs sm:text-sm font-mono text-cyan-100/70 group-hover:text-cyan-100/90 transition-colors duration-300 mt-1">
                        Billboard
                        <br />
                        Ads
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-sky-400/5 to-transparent rounded-lg sm:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Components */}
          {isCreateProfileModalOpen && (
            <Modal
              isOpen={isCreateProfileModalOpen}
              onClose={closeCreateProfileModal}
            >
              <CreateProfile onClose={closeCreateProfileModal} />
            </Modal>
          )}

          {/* Ultra-Compact Section Modal */}
          {isSectionModalOpen && selectedModalContent && (
            <Modal isOpen={isSectionModalOpen} onClose={closeSectionModal}>
              <div className="relative bg-gradient-to-br from-slate-900/90 via-purple-900/50 to-slate-900/90 backdrop-blur-xl border border-cyan-400/30 rounded-2xl p-3 max-w-5xl mx-auto shadow-2xl shadow-cyan-400/10 h-[85vh]">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 via-purple-500/5 to-pink-500/5 rounded-2xl blur-xl" />

                <div className="relative z-10 h-full flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 pr-12">
                      <h2 className="text-base sm:text-lg font-mono font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-1">
                        {selectedModalContent.title}
                      </h2>
                      <div className="text-xs font-mono text-cyan-100/60 bg-slate-800/50 px-2 py-1 rounded border border-cyan-400/20 inline-block">
                        {selectedModalContent.data.length} items
                      </div>
                    </div>
                  </div>

                  {selectedModalContent.data.length > 0 ? (
                    <div className="flex-1 overflow-hidden">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 h-full">
                        {selectedModalContent.data.map((item, index) => (
                          <div
                            key={index}
                            className="group relative bg-gradient-to-r from-slate-800/60 to-slate-700/40 rounded p-1.5 border border-cyan-400/20 hover:border-cyan-400/40 transition-all duration-300 hover:shadow-md hover:shadow-cyan-400/10 min-h-0"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/5 to-purple-400/5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="relative z-10 min-h-0">
                              <div className="text-cyan-100 font-mono text-xs break-all leading-tight overflow-hidden">
                                <div className="line-clamp-2">{item}</div>
                              </div>
                              <div className="text-cyan-100/40 font-mono text-xs mt-0.5">
                                #{index + 1}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-center">
                      <div className="space-y-2">
                        <div className="text-2xl">📭</div>
                        <div className="text-cyan-100/70 font-mono text-sm">
                          No items found
                        </div>
                        <div className="text-cyan-100/50 font-mono text-xs">
                          This section is currently empty
                        </div>
                        <div className="text-cyan-100/30 font-mono text-xs">
                          Start by creating some content to see it here!
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Modal>
          )}

          {/* Update Profile Modal */}
          {isUpdateProfileModalOpen && (
            <Modal
              isOpen={isUpdateProfileModalOpen}
              onClose={closeUpdateProfileModal}
            >
              <UpdateProfile onClose={closeUpdateProfileModal} />
            </Modal>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
