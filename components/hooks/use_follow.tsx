/**
 * use_follow.tsx
 * Hook for following/unfollowing channels and groups.
 *
 * V1 Mode: Updates the user's profile with FollowingChannels/FollowingGroups arrays.
 * V2 Mode: Writes to dedicated list topics (FollowingChannels/FollowingGroups topics).
 *
 * Stores full metadata objects with Name, Description, Media, and Channel/Group ID.
 */

import { useState, useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import useSendMessage from "./use_send_message";
import useGetProfile, { isV2Profile, getTopicId, getArrayData } from "./use_get_profile";
import useProfileLists, {
  FollowedChannel,
  FollowedGroup,
  fetchListFromTopicId,
  AddItemStepCallbacks,
  AddItemResult,
} from "./use_profile_lists";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { useRefreshTrigger } from "./use_refresh_trigger";

// Re-export types for convenience
export type { FollowedChannel, FollowedGroup, AddItemStepCallbacks, AddItemResult };

/**
 * Step status for UI tracking
 */
export type StepStatus = "idle" | "pending" | "complete" | "error";

/**
 * Follow operation steps for V2 profiles
 * When following for the first time (topic doesn't exist):
 * 1. Create FollowingChannels/FollowingGroups topic
 * 2. Send to the list topic
 * 3. Update profile with new topic ID
 *
 * When following subsequently (topic exists):
 * 1. Send to the list topic only
 */
export interface FollowSteps {
  createListTopic?: StepStatus;
  sendToList?: StepStatus;
  updateProfile?: StepStatus;
}

interface FollowHookReturn {
  // Follow/unfollow actions (simple API - no step tracking)
  followChannel: (channelData: FollowedChannel) => Promise<boolean>;
  unfollowChannel: (channelId: string) => Promise<boolean>;
  followGroup: (groupData: FollowedGroup) => Promise<boolean>;
  unfollowGroup: (groupId: string) => Promise<boolean>;
  
  // Follow actions with step tracking (V2 only)
  followChannelWithSteps: (
    channelData: FollowedChannel,
    stepCallbacks: AddItemStepCallbacks
  ) => Promise<AddItemResult>;
  followGroupWithSteps: (
    groupData: FollowedGroup,
    stepCallbacks: AddItemStepCallbacks
  ) => Promise<AddItemResult>;
  
  // Query functions
  isFollowingChannel: (channelId: string) => boolean;
  isFollowingGroup: (groupId: string) => boolean;
  getFollowedChannel: (channelId: string) => FollowedChannel | undefined;
  getFollowedGroup: (groupId: string) => FollowedGroup | undefined;
  
  // State
  isLoading: boolean;
  
  // V2 data
  followingChannels: FollowedChannel[];
  followingGroups: FollowedGroup[];
  
  // Migration requirement check
  needsMigration: boolean;
  
  // V2 step tracking helpers
  isV2Profile: boolean;
  isFirstChannelFollow: () => boolean;
  isFirstGroupFollow: () => boolean;
}

const useFollow = (): FollowHookReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [v2FollowingChannels, setV2FollowingChannels] = useState<FollowedChannel[]>([]);
  const [v2FollowingGroups, setV2FollowingGroups] = useState<FollowedGroup[]>([]);
  
  const { send } = useSendMessage();
  const { data: accountId } = useAccountId();
  const { profileData } = useGetProfile(accountId || "");
  const { triggerRefresh } = useRefreshTrigger();

  // Determine if profile is V2
  const isV2 = isV2Profile(profileData);
  const needsMigration = profileData !== null && !isV2;

  // Get topic IDs for V2 profiles
  const followingChannelsTopicId = isV2 ? getTopicId(profileData?.FollowingChannels) : "";
  const followingGroupsTopicId = isV2 ? getTopicId(profileData?.FollowingGroups) : "";

  // Use profile lists hook for V2 operations
  const followingChannelsList = useProfileLists(
    followingChannelsTopicId,
    "FollowingChannels",
    profileData?.ProfileTopic || "",
    profileData,
    async (newTopicId, listType) => {
      // Callback to update profile with new topic ID after lazy topic creation
      if (!profileData?.ProfileTopic) return false;
      
      const updatedProfile = {
        Type: "Profile",
        Name: profileData.Name || "",
        Bio: profileData.Bio || "",
        Website: profileData.Website || "",
        Channels: profileData.Channels || "",
        Groups: profileData.Groups || "",
        FollowingChannels: listType === "FollowingChannels" ? newTopicId : getTopicId(profileData.FollowingChannels),
        FollowingGroups: listType === "FollowingGroups" ? newTopicId : getTopicId(profileData.FollowingGroups),
        ExplorerMessages: profileData.ExplorerMessages || "",
        BillboardAds: profileData.BillboardAds || "",
        PrivateMessages: profileData.PrivateMessages || "",
        Picture: profileData.Picture || "",
        Banner: profileData.Banner || "",
        ProfileVersion: "2",
      };

      const result = await send(profileData.ProfileTopic, updatedProfile, "");
      return !!result;
    }
  );

  const followingGroupsList = useProfileLists(
    followingGroupsTopicId,
    "FollowingGroups",
    profileData?.ProfileTopic || "",
    profileData,
    async (newTopicId, listType) => {
      // Callback to update profile with new topic ID after lazy topic creation
      if (!profileData?.ProfileTopic) return false;
      
      const updatedProfile = {
        Type: "Profile",
        Name: profileData.Name || "",
        Bio: profileData.Bio || "",
        Website: profileData.Website || "",
        Channels: profileData.Channels || "",
        Groups: profileData.Groups || "",
        FollowingChannels: listType === "FollowingChannels" ? newTopicId : getTopicId(profileData.FollowingChannels),
        FollowingGroups: listType === "FollowingGroups" ? newTopicId : getTopicId(profileData.FollowingGroups),
        ExplorerMessages: profileData.ExplorerMessages || "",
        BillboardAds: profileData.BillboardAds || "",
        PrivateMessages: profileData.PrivateMessages || "",
        Picture: profileData.Picture || "",
        Banner: profileData.Banner || "",
        ProfileVersion: "2",
      };

      const result = await send(profileData.ProfileTopic, updatedProfile, "");
      return !!result;
    }
  );

  // Load V2 data when topic IDs are available
  useEffect(() => {
    if (isV2 && followingChannelsTopicId) {
      fetchListFromTopicId(followingChannelsTopicId, "FollowingChannels")
        .then((items) => setV2FollowingChannels(items as FollowedChannel[]));
    }
  }, [isV2, followingChannelsTopicId]);

  useEffect(() => {
    if (isV2 && followingGroupsTopicId) {
      fetchListFromTopicId(followingGroupsTopicId, "FollowingGroups")
        .then((items) => setV2FollowingGroups(items as FollowedGroup[]));
    }
  }, [isV2, followingGroupsTopicId]);

  /**
   * Get FollowingChannels array for V1 profiles
   * Handles both old (string[]) and new (object[]) formats
   */
  const getV1FollowingChannels = useCallback((): FollowedChannel[] => {
    if (!profileData || isV2) return [];
    const arr = getArrayData(profileData.FollowingChannels);
    return arr.map((item: unknown) => {
      if (typeof item === "string") {
        return { Name: "", Channel: item, Description: "", Media: "" };
      }
      return item as FollowedChannel;
    });
  }, [profileData, isV2]);

  /**
   * Get FollowingGroups array for V1 profiles
   * Handles both old (string[]) and new (object[]) formats
   */
  const getV1FollowingGroups = useCallback((): FollowedGroup[] => {
    if (!profileData || isV2) return [];
    const arr = getArrayData(profileData.FollowingGroups);
    return arr.map((item: unknown) => {
      if (typeof item === "string") {
        return { Name: "", Group: item, Description: "", Media: "" };
      }
      return item as FollowedGroup;
    });
  }, [profileData, isV2]);

  /**
   * Get combined following channels (V1 or V2)
   */
  const followingChannels = isV2 
    ? (followingChannelsList.items as FollowedChannel[])
    : getV1FollowingChannels();

  /**
   * Get combined following groups (V1 or V2)
   */
  const followingGroups = isV2 
    ? (followingGroupsList.items as FollowedGroup[])
    : getV1FollowingGroups();

  /**
   * Check if user is following a specific channel
   */
  const isFollowingChannel = useCallback((channelId: string): boolean => {
    if (isV2) {
      return v2FollowingChannels.some((ch) => ch.Channel === channelId);
    }
    return getV1FollowingChannels().some((ch) => ch.Channel === channelId);
  }, [isV2, v2FollowingChannels, getV1FollowingChannels]);

  /**
   * Check if user is following a specific group
   */
  const isFollowingGroup = useCallback((groupId: string): boolean => {
    if (isV2) {
      return v2FollowingGroups.some((gr) => gr.Group === groupId);
    }
    return getV1FollowingGroups().some((gr) => gr.Group === groupId);
  }, [isV2, v2FollowingGroups, getV1FollowingGroups]);

  /**
   * Get a followed channel by ID
   */
  const getFollowedChannel = useCallback((channelId: string): FollowedChannel | undefined => {
    if (isV2) {
      return v2FollowingChannels.find((ch) => ch.Channel === channelId);
    }
    return getV1FollowingChannels().find((ch) => ch.Channel === channelId);
  }, [isV2, v2FollowingChannels, getV1FollowingChannels]);

  /**
   * Get a followed group by ID
   */
  const getFollowedGroup = useCallback((groupId: string): FollowedGroup | undefined => {
    if (isV2) {
      return v2FollowingGroups.find((gr) => gr.Group === groupId);
    }
    return getV1FollowingGroups().find((gr) => gr.Group === groupId);
  }, [isV2, v2FollowingGroups, getV1FollowingGroups]);

  /**
   * Follow a channel - V2 implementation
   */
  const followChannelV2 = useCallback(async (channelData: FollowedChannel): Promise<boolean> => {
    if (isFollowingChannel(channelData.Channel)) {
      toast.info("Already following this channel");
      return true;
    }

    setIsLoading(true);
    try {
      const result = await followingChannelsList.addItem(channelData);
      if (result.success) {
        // Update local state
        setV2FollowingChannels(prev => [...prev, channelData]);
        toast.success("Channel followed successfully!");
        triggerRefresh();
        return true;
      } else {
        toast.error("Failed to follow channel");
        return false;
      }
    } catch (error) {
      console.error("Error following channel:", error);
      toast.error("Error following channel");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isFollowingChannel, followingChannelsList, triggerRefresh]);

  /**
   * Follow a channel - V1 implementation (rewrites entire profile)
   */
  const followChannelV1 = useCallback(async (channelData: FollowedChannel): Promise<boolean> => {
    if (!accountId || !profileData?.ProfileTopic) {
      toast.error("Please connect your wallet and create a profile first");
      return false;
    }

    if (isFollowingChannel(channelData.Channel)) {
      toast.info("Already following this channel");
      return true;
    }

    setIsLoading(true);

    try {
      const currentChannels = getV1FollowingChannels();
      const updatedFollowingChannels = [...currentChannels, channelData];

      const updateMessage = {
        Type: "Profile",
        Name: profileData.Name || "",
        Bio: profileData.Bio || "",
        Website: profileData.Website || "",
        Channels: profileData.Channels || [],
        Groups: profileData.Groups || [],
        FollowingChannels: updatedFollowingChannels,
        FollowingGroups: getV1FollowingGroups(),
        ExplorerMessages: profileData.ExplorerMessages || "",
        BillboardAds: profileData.BillboardAds || "",
        Picture: profileData.Picture || "",
        Banner: profileData.Banner || "",
        ProfileVersion: profileData.ProfileVersion || 1,
      };

      const result = await send(profileData.ProfileTopic, updateMessage, "");

      if (result) {
        toast.success("Channel followed successfully!");
        triggerRefresh();
        return true;
      } else {
        toast.error("Failed to follow channel");
        return false;
      }
    } catch (error) {
      console.error("Error following channel:", error);
      toast.error("Error following channel");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [accountId, profileData, isFollowingChannel, getV1FollowingChannels, getV1FollowingGroups, send, triggerRefresh]);

  /**
   * Follow a channel - routes to V1 or V2 implementation
   */
  const followChannel = useCallback(async (channelData: FollowedChannel): Promise<boolean> => {
    if (!accountId || !profileData?.ProfileTopic) {
      toast.error("Please connect your wallet and create a profile first");
      return false;
    }

    if (isV2) {
      return followChannelV2(channelData);
    } else {
      return followChannelV1(channelData);
    }
  }, [accountId, profileData, isV2, followChannelV2, followChannelV1]);

  /**
   * Unfollow a channel - V2 implementation
   */
  const unfollowChannelV2 = useCallback(async (channelId: string): Promise<boolean> => {
    if (!isFollowingChannel(channelId)) {
      toast.info("Not following this channel");
      return true;
    }

    setIsLoading(true);
    try {
      const result = await followingChannelsList.removeItem(channelId);
      if (result) {
        // Update local state
        setV2FollowingChannels(prev => prev.filter(ch => ch.Channel !== channelId));
        toast.success("Channel unfollowed");
        triggerRefresh();
        return true;
      } else {
        toast.error("Failed to unfollow channel");
        return false;
      }
    } catch (error) {
      console.error("Error unfollowing channel:", error);
      toast.error("Error unfollowing channel");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isFollowingChannel, followingChannelsList, triggerRefresh]);

  /**
   * Unfollow a channel - V1 implementation (rewrites entire profile)
   */
  const unfollowChannelV1 = useCallback(async (channelId: string): Promise<boolean> => {
    if (!accountId || !profileData?.ProfileTopic) {
      toast.error("Please connect your wallet and create a profile first");
      return false;
    }

    if (!isFollowingChannel(channelId)) {
      toast.info("Not following this channel");
      return true;
    }

    setIsLoading(true);

    try {
      const updatedFollowingChannels = getV1FollowingChannels().filter(
        (ch) => ch.Channel !== channelId
      );

      const updateMessage = {
        Type: "Profile",
        Name: profileData.Name || "",
        Bio: profileData.Bio || "",
        Website: profileData.Website || "",
        Channels: profileData.Channels || [],
        Groups: profileData.Groups || [],
        FollowingChannels: updatedFollowingChannels,
        FollowingGroups: getV1FollowingGroups(),
        ExplorerMessages: profileData.ExplorerMessages || "",
        BillboardAds: profileData.BillboardAds || "",
        Picture: profileData.Picture || "",
        Banner: profileData.Banner || "",
        ProfileVersion: profileData.ProfileVersion || 1,
      };

      const result = await send(profileData.ProfileTopic, updateMessage, "");

      if (result) {
        toast.success("Channel unfollowed");
        triggerRefresh();
        return true;
      } else {
        toast.error("Failed to unfollow channel");
        return false;
      }
    } catch (error) {
      console.error("Error unfollowing channel:", error);
      toast.error("Error unfollowing channel");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [accountId, profileData, isFollowingChannel, getV1FollowingChannels, getV1FollowingGroups, send, triggerRefresh]);

  /**
   * Unfollow a channel - routes to V1 or V2 implementation
   */
  const unfollowChannel = useCallback(async (channelId: string): Promise<boolean> => {
    if (!accountId || !profileData?.ProfileTopic) {
      toast.error("Please connect your wallet and create a profile first");
      return false;
    }

    if (isV2) {
      return unfollowChannelV2(channelId);
    } else {
      return unfollowChannelV1(channelId);
    }
  }, [accountId, profileData, isV2, unfollowChannelV2, unfollowChannelV1]);

  /**
   * Follow a group - V2 implementation
   */
  const followGroupV2 = useCallback(async (groupData: FollowedGroup): Promise<boolean> => {
    if (isFollowingGroup(groupData.Group)) {
      toast.info("Already following this group");
      return true;
    }

    setIsLoading(true);
    try {
      const result = await followingGroupsList.addItem(groupData);
      if (result.success) {
        // Update local state
        setV2FollowingGroups(prev => [...prev, groupData]);
        toast.success("Group followed successfully!");
        triggerRefresh();
        return true;
      } else {
        toast.error("Failed to follow group");
        return false;
      }
    } catch (error) {
      console.error("Error following group:", error);
      toast.error("Error following group");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isFollowingGroup, followingGroupsList, triggerRefresh]);

  /**
   * Follow a group - V1 implementation (rewrites entire profile)
   */
  const followGroupV1 = useCallback(async (groupData: FollowedGroup): Promise<boolean> => {
    if (!accountId || !profileData?.ProfileTopic) {
      toast.error("Please connect your wallet and create a profile first");
      return false;
    }

    if (isFollowingGroup(groupData.Group)) {
      toast.info("Already following this group");
      return true;
    }

    setIsLoading(true);

    try {
      const currentGroups = getV1FollowingGroups();
      const updatedFollowingGroups = [...currentGroups, groupData];

      const updateMessage = {
        Type: "Profile",
        Name: profileData.Name || "",
        Bio: profileData.Bio || "",
        Website: profileData.Website || "",
        Channels: profileData.Channels || [],
        Groups: profileData.Groups || [],
        FollowingChannels: getV1FollowingChannels(),
        FollowingGroups: updatedFollowingGroups,
        ExplorerMessages: profileData.ExplorerMessages || "",
        BillboardAds: profileData.BillboardAds || "",
        Picture: profileData.Picture || "",
        Banner: profileData.Banner || "",
        ProfileVersion: profileData.ProfileVersion || 1,
      };

      const result = await send(profileData.ProfileTopic, updateMessage, "");

      if (result) {
        toast.success("Group followed successfully!");
        triggerRefresh();
        return true;
      } else {
        toast.error("Failed to follow group");
        return false;
      }
    } catch (error) {
      console.error("Error following group:", error);
      toast.error("Error following group");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [accountId, profileData, isFollowingGroup, getV1FollowingChannels, getV1FollowingGroups, send, triggerRefresh]);

  /**
   * Follow a group - routes to V1 or V2 implementation
   */
  const followGroup = useCallback(async (groupData: FollowedGroup): Promise<boolean> => {
    if (!accountId || !profileData?.ProfileTopic) {
      toast.error("Please connect your wallet and create a profile first");
      return false;
    }

    if (isV2) {
      return followGroupV2(groupData);
    } else {
      return followGroupV1(groupData);
    }
  }, [accountId, profileData, isV2, followGroupV2, followGroupV1]);

  /**
   * Unfollow a group - V2 implementation
   */
  const unfollowGroupV2 = useCallback(async (groupId: string): Promise<boolean> => {
    if (!isFollowingGroup(groupId)) {
      toast.info("Not following this group");
      return true;
    }

    setIsLoading(true);
    try {
      const result = await followingGroupsList.removeItem(groupId);
      if (result) {
        // Update local state
        setV2FollowingGroups(prev => prev.filter(gr => gr.Group !== groupId));
        toast.success("Group unfollowed");
        triggerRefresh();
        return true;
      } else {
        toast.error("Failed to unfollow group");
        return false;
      }
    } catch (error) {
      console.error("Error unfollowing group:", error);
      toast.error("Error unfollowing group");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isFollowingGroup, followingGroupsList, triggerRefresh]);

  /**
   * Unfollow a group - V1 implementation (rewrites entire profile)
   */
  const unfollowGroupV1 = useCallback(async (groupId: string): Promise<boolean> => {
    if (!accountId || !profileData?.ProfileTopic) {
      toast.error("Please connect your wallet and create a profile first");
      return false;
    }

    if (!isFollowingGroup(groupId)) {
      toast.info("Not following this group");
      return true;
    }

    setIsLoading(true);

    try {
      const updatedFollowingGroups = getV1FollowingGroups().filter(
        (gr) => gr.Group !== groupId
      );

      const updateMessage = {
        Type: "Profile",
        Name: profileData.Name || "",
        Bio: profileData.Bio || "",
        Website: profileData.Website || "",
        Channels: profileData.Channels || [],
        Groups: profileData.Groups || [],
        FollowingChannels: getV1FollowingChannels(),
        FollowingGroups: updatedFollowingGroups,
        ExplorerMessages: profileData.ExplorerMessages || "",
        BillboardAds: profileData.BillboardAds || "",
        Picture: profileData.Picture || "",
        Banner: profileData.Banner || "",
        ProfileVersion: profileData.ProfileVersion || 1,
      };

      const result = await send(profileData.ProfileTopic, updateMessage, "");

      if (result) {
        toast.success("Group unfollowed");
        triggerRefresh();
        return true;
      } else {
        toast.error("Failed to unfollow group");
        return false;
      }
    } catch (error) {
      console.error("Error unfollowing group:", error);
      toast.error("Error unfollowing group");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [accountId, profileData, isFollowingGroup, getV1FollowingChannels, getV1FollowingGroups, send, triggerRefresh]);

  /**
   * Unfollow a group - routes to V1 or V2 implementation
   */
  const unfollowGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!accountId || !profileData?.ProfileTopic) {
      toast.error("Please connect your wallet and create a profile first");
      return false;
    }

    if (isV2) {
      return unfollowGroupV2(groupId);
    } else {
      return unfollowGroupV1(groupId);
    }
  }, [accountId, profileData, isV2, unfollowGroupV2, unfollowGroupV1]);

  /**
   * Check if this is the first channel follow (V2 - no FollowingChannels topic exists)
   */
  const isFirstChannelFollow = useCallback((): boolean => {
    return isV2 && !followingChannelsList.hasExistingTopic();
  }, [isV2, followingChannelsList]);

  /**
   * Check if this is the first group follow (V2 - no FollowingGroups topic exists)
   */
  const isFirstGroupFollow = useCallback((): boolean => {
    return isV2 && !followingGroupsList.hasExistingTopic();
  }, [isV2, followingGroupsList]);

  /**
   * Follow a channel with step callbacks (V2 only)
   * Provides granular progress tracking for UI
   */
  const followChannelWithSteps = useCallback(async (
    channelData: FollowedChannel,
    stepCallbacks: AddItemStepCallbacks
  ): Promise<AddItemResult> => {
    if (!accountId || !profileData?.ProfileTopic) {
      toast.error("Please connect your wallet and create a profile first");
      return { success: false };
    }

    if (!isV2) {
      // V1 profiles - just use simple follow (no step tracking)
      const success = await followChannelV1(channelData);
      return { success, createdTopic: false, updatedProfile: false };
    }

    if (isFollowingChannel(channelData.Channel)) {
      toast.info("Already following this channel");
      return { success: true, createdTopic: false, updatedProfile: false };
    }

    setIsLoading(true);
    try {
      const result = await followingChannelsList.addItem(channelData, stepCallbacks);
      if (result.success) {
        // Update local state
        setV2FollowingChannels(prev => [...prev, channelData]);
        toast.success("Channel followed successfully!");
        triggerRefresh();
      } else {
        toast.error("Failed to follow channel");
      }
      return result;
    } catch (error) {
      console.error("Error following channel:", error);
      toast.error("Error following channel");
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [accountId, profileData, isV2, isFollowingChannel, followingChannelsList, followChannelV1, triggerRefresh]);

  /**
   * Follow a group with step callbacks (V2 only)
   * Provides granular progress tracking for UI
   */
  const followGroupWithSteps = useCallback(async (
    groupData: FollowedGroup,
    stepCallbacks: AddItemStepCallbacks
  ): Promise<AddItemResult> => {
    if (!accountId || !profileData?.ProfileTopic) {
      toast.error("Please connect your wallet and create a profile first");
      return { success: false };
    }

    if (!isV2) {
      // V1 profiles - just use simple follow (no step tracking)
      const success = await followGroupV1(groupData);
      return { success, createdTopic: false, updatedProfile: false };
    }

    if (isFollowingGroup(groupData.Group)) {
      toast.info("Already following this group");
      return { success: true, createdTopic: false, updatedProfile: false };
    }

    setIsLoading(true);
    try {
      const result = await followingGroupsList.addItem(groupData, stepCallbacks);
      if (result.success) {
        // Update local state
        setV2FollowingGroups(prev => [...prev, groupData]);
        toast.success("Group followed successfully!");
        triggerRefresh();
      } else {
        toast.error("Failed to follow group");
      }
      return result;
    } catch (error) {
      console.error("Error following group:", error);
      toast.error("Error following group");
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, [accountId, profileData, isV2, isFollowingGroup, followingGroupsList, followGroupV1, triggerRefresh]);

  return {
    followChannel,
    unfollowChannel,
    followGroup,
    unfollowGroup,
    followChannelWithSteps,
    followGroupWithSteps,
    isFollowingChannel,
    isFollowingGroup,
    getFollowedChannel,
    getFollowedGroup,
    isLoading,
    followingChannels,
    followingGroups,
    needsMigration,
    isV2Profile: isV2,
    isFirstChannelFollow,
    isFirstGroupFollow,
  };
};

export default useFollow;
