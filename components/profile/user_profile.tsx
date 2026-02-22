/**
 * UserProfile is a React component that displays user profile information and handles profile modal interactions.
 * - Displays a compact user preview with profile picture and name
 * - Opens a detailed modal with complete profile information
 * - Shows loading states and error handling
 * - Integrates with external services (HashScan)
 * - V2 Profile Support: Resolves topic IDs to actual list counts for viewing other users' profiles
 */

// UserProfile.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import useGetProfile, { isV2Profile, getTopicId, getArrayData } from "../hooks/use_get_profile";
import useProfileLists from "../hooks/use_profile_lists";
import ReadMediaFile from "../media/read_media_file";
import Modal from "../common/modal";

interface UserProfileProps {
  userAccountId: string; // The unique identifier for the user account
}

/**
 * UserProfile component displays user information and handles profile modal interactions
 * @param {string} userAccountId - The unique identifier for the user account
 * @returns {JSX.Element} Profile preview and modal with detailed user information
 */
const UserProfile = ({ userAccountId }: UserProfileProps) => {
  const { profileData, isLoading, error } = useGetProfile(userAccountId);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [selectedModalContent, setSelectedModalContent] = useState<{
    type: string;
    title: string;
    data: string[];
  } | null>(null);

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
      return channelsList.items.map((item: { Channel?: string; Name?: string }) =>
        item.Channel || item.Name || JSON.stringify(item)
      );
    }
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

  /**
   * Updates the profile checking state when loading is complete
   * Prevents premature "Profile NOT FOUND" messages
   */
  useEffect(() => {
    if (!isLoading) {
      setIsCheckingProfile(false);
    }
  }, [isLoading, profileData]);

  /**
   * Modal control functions for opening and closing the detailed profile view
   */
  const openUserProfileModal = () => {
    setIsUserProfileModalOpen(true);
  };

  const closeUserProfileModal = () => {
    setIsUserProfileModalOpen(false);
  };

  // Handle opening section modal with enhanced UX
  const openSectionModal = (type: string, title: string, data: string[]) => {
    setSelectedModalContent({ type, title, data });
    setIsSectionModalOpen(true);
  };

  // Handle closing section modal with animation
  const closeSectionModal = () => {
    setIsSectionModalOpen(false);
    // Clear content after animation completes
    setTimeout(() => setSelectedModalContent(null), 200);
  };

  // Helper function to get modal content for the new UI
  const getModalContent = () => {
    if (!isUserProfileModalOpen) return null;

    return (
      <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Animated Background Effects */}
        <div className="absolute inset-0 bg-cyber-grid opacity-10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-radial from-cyan-500/10 to-transparent rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-radial from-purple-500/10 to-transparent rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />

        <div className="relative z-10 flex flex-col w-full h-full pt-6">
          <div className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 overflow-y-auto mt-2 sm:mt-3 lg:mt-4 pb-4">
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col justify-center items-center h-full space-y-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
                  <div
                    className="absolute inset-0 w-16 h-16 border-4 border-purple-400/20 border-r-purple-400 rounded-full animate-spin"
                    style={{
                      animationDirection: "reverse",
                      animationDelay: "0.5s",
                    }}
                  ></div>
                </div>
                <div className="text-cyan-100/80 font-mono text-lg animate-pulse">
                  Loading profile...
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="flex justify-center items-center h-full">
                <div className="bg-gradient-to-r from-red-900/50 to-red-800/50 backdrop-blur-md border border-red-500/30 rounded-2xl p-8 text-center">
                  <div className="text-red-400 text-xl mb-2">⚠️</div>
                  <div className="text-red-300 font-mono">{error}</div>
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
                      🔍
                    </div>
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-mono bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent px-2">
                      Profile Not Found
                    </h2>
                    <p className="text-cyan-100/70 font-mono text-sm sm:text-base max-w-xs sm:max-w-md mx-auto px-2">
                      This user hasn&apos;t created a profile yet.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Existing Profile Display */}
            {profileData && !isCheckingProfile && (
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
                      className="w-full h-auto object-contain transition-opacity duration-300 opacity-0"
                      onLoad={(e) => {
                        e.currentTarget.style.opacity = '1';
                        console.log("Direct banner image loaded!");
                      }}
                      onError={() =>
                        console.log("Direct banner image failed!")
                      }
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent" />
                  </div>
                )}

                {/* Profile Information Card */}
                <div className="relative bg-gradient-to-r from-slate-900/80 via-purple-900/50 to-slate-900/80 backdrop-blur-xl border border-cyan-400/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-5 shadow-2xl shadow-cyan-400/10">
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/5 via-purple-500/5 to-pink-500/5 blur-xl" />

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
                              className="w-full h-full object-cover rounded-full transition-opacity duration-300 opacity-0"
                              onLoad={(e) => {
                                e.currentTarget.style.opacity = '1';
                                console.log("Direct image loaded!");
                              }}
                              onError={() =>
                                console.log("Direct image failed!")
                              }
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
                            }/account/${userAccountId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 hover:text-cyan-100 font-mono text-xs underline decoration-cyan-400/50 hover:decoration-cyan-400 transition-colors break-all"
                          >
                            {userAccountId}
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
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div
        className="items-center cursor-pointer flex"
        onClick={openUserProfileModal}
      >
        {profileData && profileData.Picture && (
          <div className="w-10 h-10 rounded-full mr-2">
            <ReadMediaFile cid={profileData.Picture} />
          </div>
        )}
        <p className="text-lg font-semibold text-white hover:text-cyan-300 transition-colors duration-300">
          {profileData?.Name}
        </p>
      </div>

      {/* Render modal using the common Modal component */}
      <Modal
        isOpen={isUserProfileModalOpen}
        onClose={closeUserProfileModal}
        hideCloseButton={false}
        removeZIndex={false}
      >
        {getModalContent()}
      </Modal>

      {/* Ultra-Compact Section Modal */}
      {isSectionModalOpen && selectedModalContent && (
        <Modal isOpen={isSectionModalOpen} onClose={closeSectionModal}>
          <div className="relative bg-gradient-to-br from-slate-900/90 via-purple-900/50 to-slate-900/90 backdrop-blur-xl border-y sm:border border-cyan-400/30 sm:rounded-2xl p-3 max-w-5xl mx-auto shadow-2xl shadow-cyan-400/10 h-[85vh]">
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
    </div>
  );
};

export default UserProfile;
