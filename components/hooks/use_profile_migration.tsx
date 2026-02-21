/**
 * use_profile_migration.tsx
 * Hook for migrating V1 profiles to V2 format.
 * 
 * V1 profiles have arrays embedded in the profile JSON.
 * V2 profiles have topic IDs referencing separate Hedera topics.
 * 
 * This hook provides:
 * - Detection of V1 profiles that need migration
 * - Step-by-step migration process with progress tracking
 * - `requireV2()` interception for V1 users attempting write actions
 * 
 * @module useProfileMigration
 */

import { useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import useCreateTopic from "./use_create_topic";
import useSendMessage from "./use_send_message";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import { ProfileData, isV2Profile, getArrayData, hasArrayData } from "./use_get_profile";
import { clearListCache } from "./use_profile_lists";

/**
 * Step status for migration steps - consistent with multi-step-transaction-architecture
 */
export interface StepStatus {
  status: "idle" | "loading" | "success" | "error";
  disabled: boolean;
}

/**
 * Migration step identifiers
 */
export type MigrationStep = 
  | "createChannelsTopic"
  | "createGroupsTopic"
  | "createFollowingChannelsTopic"
  | "createFollowingGroupsTopic"
  | "updateProfile";

/**
 * Migration step statuses
 */
export interface MigrationStepStatuses {
  createChannelsTopic?: StepStatus;
  createGroupsTopic?: StepStatus;
  createFollowingChannelsTopic?: StepStatus;
  createFollowingGroupsTopic?: StepStatus;
  updateProfile: StepStatus;
}

/**
 * New topic IDs created during migration
 */
export interface MigrationTopicIds {
  Channels?: string;
  Groups?: string;
  FollowingChannels?: string;
  FollowingGroups?: string;
}

/**
 * Return type for the migration hook
 */
export interface UseProfileMigrationReturn {
  // State
  needsMigration: boolean;
  isMigrating: boolean;
  stepStatuses: MigrationStepStatuses;
  error: string | null;
  
  // Migration progress
  currentStep: MigrationStep | null;
  completedSteps: MigrationStep[];
  totalSteps: number;
  completedCount: number;
  
  // Auto-progression
  autoProgress: boolean;
  setAutoProgress: (value: boolean) => void;
  autoProgressDisabledByError: boolean;
  
  // Actions
  startMigration: () => Promise<boolean>;
  retryStep: (step: MigrationStep) => Promise<boolean>;
  resetMigration: () => void;
  
  // Interception for V1 users
  requireV2: (onReady: () => void) => void;
  showMigrationModal: boolean;
  setShowMigrationModal: (show: boolean) => void;
  pendingAction: (() => void) | null;
  
  // New topic IDs
  newTopicIds: MigrationTopicIds;
}

/**
 * Hook for managing V1 to V2 profile migration
 */
const useProfileMigration = (
  profileData: ProfileData | null,
  profileTopicId: string,
  onMigrationComplete?: () => void
): UseProfileMigrationReturn => {
  const { data: accountId } = useAccountId();
  const { create: createTopic, showToast } = useCreateTopic();
  const { send } = useSendMessage();
  
  // Migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<MigrationStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<MigrationStep[]>([]);
  const [newTopicIds, setNewTopicIds] = useState<MigrationTopicIds>({});
  
  // Auto-progression state
  const [autoProgress, setAutoProgressState] = useState(false);
  const autoProgressRef = useRef(false);
  const [autoProgressDisabledByError, setAutoProgressDisabledByError] = useState(false);
  
  // Modal state for V1 interception
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  
  // Step statuses - initialize based on profile data
  const [stepStatuses, setStepStatuses] = useState<MigrationStepStatuses>(() => {
    return getInitialStepStatuses(profileData);
  });

  /**
   * Syncs autoProgress state with ref
   */
  const setAutoProgress = useCallback((value: boolean) => {
    setAutoProgressState(value);
    autoProgressRef.current = value;
  }, []);

  /**
   * Check if migration is needed
   */
  const needsMigration = profileData !== null && !isV2Profile(profileData);

  /**
   * Calculate total steps needed (only non-null steps)
   */
  const totalSteps = Object.values(stepStatuses).filter(s => s !== undefined).length;
  const completedCount = completedSteps.length;

  /**
   * Gets initial step statuses based on which arrays have data
   */
  function getInitialStepStatuses(profile: ProfileData | null): MigrationStepStatuses {
    if (!profile || isV2Profile(profile)) {
      return {
        updateProfile: { status: "idle", disabled: true },
      };
    }

    const statuses: MigrationStepStatuses = {
      updateProfile: { status: "idle", disabled: true }, // Always last step
    };

    // Only add steps for arrays that have data
    if (hasArrayData(profile.Channels)) {
      statuses.createChannelsTopic = { status: "idle", disabled: false };
    }
    if (hasArrayData(profile.Groups)) {
      statuses.createGroupsTopic = { status: "idle", disabled: !hasArrayData(profile.Channels) };
    }
    if (hasArrayData(profile.FollowingChannels)) {
      statuses.createFollowingChannelsTopic = { 
        status: "idle", 
        disabled: hasArrayData(profile.Channels) || hasArrayData(profile.Groups) 
      };
    }
    if (hasArrayData(profile.FollowingGroups)) {
      statuses.createFollowingGroupsTopic = { 
        status: "idle", 
        disabled: hasArrayData(profile.Channels) || hasArrayData(profile.Groups) || hasArrayData(profile.FollowingChannels)
      };
    }

    // Enable updateProfile if no array data at all
    if (!hasArrayData(profile.Channels) && !hasArrayData(profile.Groups) && 
        !hasArrayData(profile.FollowingChannels) && !hasArrayData(profile.FollowingGroups)) {
      statuses.updateProfile = { status: "idle", disabled: false };
    }

    return statuses;
  }

  /**
   * Disables auto-progression due to error
   */
  const disableAutoProgression = useCallback((reason: string) => {
    console.log(`Migration: Disabling auto-progression: ${reason}`);
    setAutoProgress(false);
    setAutoProgressDisabledByError(true);
  }, [setAutoProgress]);

  /**
   * Updates a step status
   */
  const updateStepStatus = useCallback((step: MigrationStep, status: Partial<StepStatus>) => {
    setStepStatuses(prev => ({
      ...prev,
      [step]: prev[step] ? { ...prev[step], ...status } : undefined,
    }));
  }, []);

  /**
   * Creates a list topic and sends initial array data
   */
  const createListTopic = useCallback(async (
    memo: string,
    arrayData: unknown[]
  ): Promise<string | undefined> => {
    try {
      const newTopicId = await createTopic(memo, memo, false);
      
      if (!newTopicId) {
        return undefined;
      }

      // Wait for topic propagation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Send initial array
      const result = await send(newTopicId, arrayData, "");
      if (!result) {
        toast.error(`Failed to initialize ${memo} topic`);
        return undefined;
      }

      return newTopicId;
    } catch (err) {
      console.error(`Error creating ${memo} topic:`, err);
      return undefined;
    }
  }, [createTopic, send]);

  /**
   * Executes the Channels topic creation step
   */
  const handleCreateChannelsTopic = useCallback(async (): Promise<boolean> => {
    if (!profileData || !hasArrayData(profileData.Channels)) {
      return true; // Skip if no data
    }

    setCurrentStep("createChannelsTopic");
    updateStepStatus("createChannelsTopic", { status: "loading", disabled: true });

    try {
      const channelsArray = getArrayData(profileData.Channels);
      const topicId = await createListTopic("iBird Channels List", channelsArray);

      if (!topicId) {
        updateStepStatus("createChannelsTopic", { status: "error", disabled: false });
        disableAutoProgression("Channels topic creation failed");
        return false;
      }

      setNewTopicIds(prev => ({ ...prev, Channels: topicId }));
      setCompletedSteps(prev => [...prev, "createChannelsTopic"]);
      updateStepStatus("createChannelsTopic", { status: "success", disabled: true });
      
      // Enable next step
      enableNextStep("createChannelsTopic");
      
      showToast("success", "Channels list topic created!");
      return true;
    } catch (err) {
      console.error("Error in handleCreateChannelsTopic:", err);
      updateStepStatus("createChannelsTopic", { status: "error", disabled: false });
      disableAutoProgression("Channels topic creation error");
      return false;
    }
  }, [profileData, createListTopic, updateStepStatus, disableAutoProgression, showToast]);

  /**
   * Executes the Groups topic creation step
   */
  const handleCreateGroupsTopic = useCallback(async (): Promise<boolean> => {
    if (!profileData || !hasArrayData(profileData.Groups)) {
      return true; // Skip if no data
    }

    setCurrentStep("createGroupsTopic");
    updateStepStatus("createGroupsTopic", { status: "loading", disabled: true });

    try {
      const groupsArray = getArrayData(profileData.Groups);
      const topicId = await createListTopic("iBird Groups List", groupsArray);

      if (!topicId) {
        updateStepStatus("createGroupsTopic", { status: "error", disabled: false });
        disableAutoProgression("Groups topic creation failed");
        return false;
      }

      setNewTopicIds(prev => ({ ...prev, Groups: topicId }));
      setCompletedSteps(prev => [...prev, "createGroupsTopic"]);
      updateStepStatus("createGroupsTopic", { status: "success", disabled: true });
      
      enableNextStep("createGroupsTopic");
      
      showToast("success", "Groups list topic created!");
      return true;
    } catch (err) {
      console.error("Error in handleCreateGroupsTopic:", err);
      updateStepStatus("createGroupsTopic", { status: "error", disabled: false });
      disableAutoProgression("Groups topic creation error");
      return false;
    }
  }, [profileData, createListTopic, updateStepStatus, disableAutoProgression, showToast]);

  /**
   * Executes the FollowingChannels topic creation step
   */
  const handleCreateFollowingChannelsTopic = useCallback(async (): Promise<boolean> => {
    if (!profileData || !hasArrayData(profileData.FollowingChannels)) {
      return true; // Skip if no data
    }

    setCurrentStep("createFollowingChannelsTopic");
    updateStepStatus("createFollowingChannelsTopic", { status: "loading", disabled: true });

    try {
      const followingChannelsArray = getArrayData(profileData.FollowingChannels);
      const topicId = await createListTopic("iBird Following Channels List", followingChannelsArray);

      if (!topicId) {
        updateStepStatus("createFollowingChannelsTopic", { status: "error", disabled: false });
        disableAutoProgression("Following channels topic creation failed");
        return false;
      }

      setNewTopicIds(prev => ({ ...prev, FollowingChannels: topicId }));
      setCompletedSteps(prev => [...prev, "createFollowingChannelsTopic"]);
      updateStepStatus("createFollowingChannelsTopic", { status: "success", disabled: true });
      
      enableNextStep("createFollowingChannelsTopic");
      
      showToast("success", "Following channels list topic created!");
      return true;
    } catch (err) {
      console.error("Error in handleCreateFollowingChannelsTopic:", err);
      updateStepStatus("createFollowingChannelsTopic", { status: "error", disabled: false });
      disableAutoProgression("Following channels topic creation error");
      return false;
    }
  }, [profileData, createListTopic, updateStepStatus, disableAutoProgression, showToast]);

  /**
   * Executes the FollowingGroups topic creation step
   */
  const handleCreateFollowingGroupsTopic = useCallback(async (): Promise<boolean> => {
    if (!profileData || !hasArrayData(profileData.FollowingGroups)) {
      return true; // Skip if no data
    }

    setCurrentStep("createFollowingGroupsTopic");
    updateStepStatus("createFollowingGroupsTopic", { status: "loading", disabled: true });

    try {
      const followingGroupsArray = getArrayData(profileData.FollowingGroups);
      const topicId = await createListTopic("iBird Following Groups List", followingGroupsArray);

      if (!topicId) {
        updateStepStatus("createFollowingGroupsTopic", { status: "error", disabled: false });
        disableAutoProgression("Following groups topic creation failed");
        return false;
      }

      setNewTopicIds(prev => ({ ...prev, FollowingGroups: topicId }));
      setCompletedSteps(prev => [...prev, "createFollowingGroupsTopic"]);
      updateStepStatus("createFollowingGroupsTopic", { status: "success", disabled: true });
      
      enableNextStep("createFollowingGroupsTopic");
      
      showToast("success", "Following groups list topic created!");
      return true;
    } catch (err) {
      console.error("Error in handleCreateFollowingGroupsTopic:", err);
      updateStepStatus("createFollowingGroupsTopic", { status: "error", disabled: false });
      disableAutoProgression("Following groups topic creation error");
      return false;
    }
  }, [profileData, createListTopic, updateStepStatus, disableAutoProgression, showToast]);

  /**
   * Executes the profile update step - final step that writes V2 profile
   */
  const handleUpdateProfile = useCallback(async (): Promise<boolean> => {
    if (!profileData || !profileTopicId) {
      setError("Missing profile data");
      return false;
    }

    setCurrentStep("updateProfile");
    updateStepStatus("updateProfile", { status: "loading", disabled: true });

    try {
      // Build V2 profile message
      const v2Profile = {
        Type: "Profile",
        Name: profileData.Name || "",
        Bio: profileData.Bio || "",
        Website: profileData.Website || "",
        // Use new topic IDs or empty string if no data
        Channels: newTopicIds.Channels || "",
        Groups: newTopicIds.Groups || "",
        FollowingChannels: newTopicIds.FollowingChannels || "",
        FollowingGroups: newTopicIds.FollowingGroups || "",
        ExplorerMessages: profileData.ExplorerMessages || "",
        BillboardAds: profileData.BillboardAds || "",
        PrivateMessages: "", // New V2 field
        Picture: profileData.Picture || "",
        Banner: profileData.Banner || "",
        ProfileVersion: "2",
      };

      const result = await send(profileTopicId, v2Profile, "");

      if (!result) {
        updateStepStatus("updateProfile", { status: "error", disabled: false });
        disableAutoProgression("Profile update failed");
        return false;
      }

      setCompletedSteps(prev => [...prev, "updateProfile"]);
      updateStepStatus("updateProfile", { status: "success", disabled: true });
      
      // Clear any cached list data
      clearListCache();
      
      showToast("success", "Profile upgraded to V2!");
      
      // Call completion callback
      if (onMigrationComplete) {
        onMigrationComplete();
      }
      
      // Execute pending action if any
      if (pendingAction) {
        setTimeout(() => {
          pendingAction();
          setPendingAction(null);
        }, 1000);
      }
      
      setShowMigrationModal(false);
      return true;
    } catch (err) {
      console.error("Error in handleUpdateProfile:", err);
      updateStepStatus("updateProfile", { status: "error", disabled: false });
      disableAutoProgression("Profile update error");
      return false;
    }
  }, [profileData, profileTopicId, newTopicIds, send, updateStepStatus, 
      disableAutoProgression, showToast, onMigrationComplete, pendingAction]);

  /**
   * Enables the next step after a step completes
   */
  const enableNextStep = useCallback((completedStep: MigrationStep) => {
    const stepOrder: MigrationStep[] = [
      "createChannelsTopic",
      "createGroupsTopic",
      "createFollowingChannelsTopic",
      "createFollowingGroupsTopic",
      "updateProfile",
    ];

    const currentIndex = stepOrder.indexOf(completedStep);
    
    // Find next step that exists
    for (let i = currentIndex + 1; i < stepOrder.length; i++) {
      const nextStep = stepOrder[i];
      if (stepStatuses[nextStep] !== undefined) {
        updateStepStatus(nextStep, { disabled: false });
        
        // Auto-progress to next step if enabled
        if (autoProgressRef.current) {
          setTimeout(() => {
            executeStep(nextStep);
          }, 1000);
        }
        return;
      }
    }
    
    // If no more topic creation steps, enable updateProfile
    if (stepStatuses.updateProfile) {
      updateStepStatus("updateProfile", { disabled: false });
      
      if (autoProgressRef.current) {
        setTimeout(() => {
          handleUpdateProfile();
        }, 1000);
      }
    }
  }, [stepStatuses, updateStepStatus, handleUpdateProfile]);

  /**
   * Executes a specific step
   */
  const executeStep = useCallback(async (step: MigrationStep): Promise<boolean> => {
    switch (step) {
      case "createChannelsTopic":
        return handleCreateChannelsTopic();
      case "createGroupsTopic":
        return handleCreateGroupsTopic();
      case "createFollowingChannelsTopic":
        return handleCreateFollowingChannelsTopic();
      case "createFollowingGroupsTopic":
        return handleCreateFollowingGroupsTopic();
      case "updateProfile":
        return handleUpdateProfile();
      default:
        return false;
    }
  }, [handleCreateChannelsTopic, handleCreateGroupsTopic, 
      handleCreateFollowingChannelsTopic, handleCreateFollowingGroupsTopic, 
      handleUpdateProfile]);

  /**
   * Starts the migration process
   */
  const startMigration = useCallback(async (): Promise<boolean> => {
    if (!accountId) {
      toast.error("Please connect your wallet");
      return false;
    }

    if (!profileData || !profileTopicId) {
      toast.error("Profile data not available");
      return false;
    }

    if (!needsMigration) {
      toast.info("Profile is already V2");
      return true;
    }

    setIsMigrating(true);
    setError(null);
    setCompletedSteps([]);
    setNewTopicIds({});

    // Reset step statuses
    setStepStatuses(getInitialStepStatuses(profileData));

    // Find first step to execute
    const stepOrder: MigrationStep[] = [
      "createChannelsTopic",
      "createGroupsTopic",
      "createFollowingChannelsTopic",
      "createFollowingGroupsTopic",
      "updateProfile",
    ];

    for (const step of stepOrder) {
      if (stepStatuses[step] !== undefined) {
        const result = await executeStep(step);
        if (!result && stepStatuses[step]?.status === "error") {
          // Step failed - stop here and let user retry
          return false;
        }
        // If auto-progress is off, stop after first step
        if (!autoProgressRef.current) {
          return true;
        }
      }
    }

    setIsMigrating(false);
    return true;
  }, [accountId, profileData, profileTopicId, needsMigration, stepStatuses, executeStep]);

  /**
   * Retries a specific step
   */
  const retryStep = useCallback(async (step: MigrationStep): Promise<boolean> => {
    setAutoProgressDisabledByError(false);
    return executeStep(step);
  }, [executeStep]);

  /**
   * Resets migration state
   */
  const resetMigration = useCallback(() => {
    setIsMigrating(false);
    setError(null);
    setCurrentStep(null);
    setCompletedSteps([]);
    setNewTopicIds({});
    setAutoProgress(false);
    setAutoProgressDisabledByError(false);
    setStepStatuses(getInitialStepStatuses(profileData));
  }, [profileData, setAutoProgress]);

  /**
   * Intercepts V1 users and requires migration before proceeding
   * This is the main entry point for components to ensure V2
   */
  const requireV2 = useCallback((onReady: () => void) => {
    // If user is not connected or no profile, let the action handle it
    if (!accountId || !profileData) {
      onReady();
      return;
    }

    // If already V2, proceed immediately
    if (isV2Profile(profileData)) {
      onReady();
      return;
    }

    // V1 profile - show migration modal and store pending action
    setPendingAction(() => onReady);
    setShowMigrationModal(true);
  }, [accountId, profileData]);

  return {
    // State
    needsMigration,
    isMigrating,
    stepStatuses,
    error,
    
    // Progress
    currentStep,
    completedSteps,
    totalSteps,
    completedCount,
    
    // Auto-progression
    autoProgress,
    setAutoProgress,
    autoProgressDisabledByError,
    
    // Actions
    startMigration,
    retryStep,
    resetMigration,
    
    // Interception
    requireV2,
    showMigrationModal,
    setShowMigrationModal,
    pendingAction,
    
    // New topic IDs
    newTopicIds,
  };
};

export default useProfileMigration;
