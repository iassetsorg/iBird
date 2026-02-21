/**
 * UpdateGroup is a React component that provides a form interface for users to update their group information.
 * It handles:
 * - Group icon upload to Arweave
 * - Basic group information (name, description)
 * - Two-step update process (upload icon, then update profile)
 * - Real-time status updates and error handling
 * - Enhanced error handling patterns following Next.js 15 best practices
 * - V2 Profile Support: Writes to Groups list topic instead of profile rewrite
 */

// ============================================================================
// IMPORTS SECTION
// ============================================================================

// React Core Imports
import React, { useState, useRef, useEffect } from "react";

// Third-party Library Imports
import { toast } from "react-toastify";

// Icon Imports
import { MdOutlinePermMedia } from "react-icons/md";
import { RiDeleteBinLine, RiCheckLine, RiRefreshLine } from "react-icons/ri";

// Custom Hook Imports
import useSendMessage from "../hooks/use_send_message";
import useUploadToArweave from "../media/use_upload_to_arweave";
import useGetProfile, { isV2Profile, getTopicId, getArrayData } from "../hooks/use_get_profile";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";
import useProfileLists, { GroupItem } from "../hooks/use_profile_lists";
import useProfileMigration from "../hooks/use_profile_migration";

// Wallet Integration Imports
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";

// Component Imports
import EmojiPickerPopup from "../common/EmojiPickerPopup";
import ImageCropModal from "../common/ImageCropModal";
import ReadMediaFile from "../media/read_media_file";
import MigrationModal from "../profile/migration_modal";

// ============================================================================
// TYPE DEFINITIONS & INTERFACES
// ============================================================================

/**
 * StepStatus Interface
 * Tracks the state of each step in the group update process
 */
interface StepStatus {
  status: "idle" | "loading" | "success" | "error";
  disabled: boolean;
}

/**
 * GroupUpdateSteps Interface
 * Manages the status of all steps in the group update process
 */
interface GroupUpdateSteps {
  arweave?: StepStatus;
  updateProfile: StepStatus;
}

/**
 * Props interface for UpdateGroup
 */
interface UpdateGroupProps {
  groupId: string;
  onClose: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UpdateGroup = ({ groupId, onClose }: UpdateGroupProps) => {
  // ========================================================================
  // HOOKS & EXTERNAL DEPENDENCIES
  // ========================================================================

  const { data: accountId } = useAccountId();
  const { send } = useSendMessage();
  const { profileData } = useGetProfile(accountId || "");
  const userProfileTopicId = profileData ? profileData.ProfileTopic : "";
  const { uploadToArweave } = useUploadToArweave();
  const { triggerRefresh } = useRefreshTrigger();

  // ========================================================================
  // V2 PROFILE SUPPORT - Profile Lists Hook
  // ========================================================================
  
  /**
   * Callback to update profile with new Groups topic ID after lazy creation
   * This is called by useProfileLists when a new Groups topic is created
   */
  const handleProfileUpdateWithNewTopicId = async (
    newTopicId: string,
    listType: "Channels" | "Groups" | "FollowingChannels" | "FollowingGroups"
  ): Promise<boolean> => {
    if (!profileData || !userProfileTopicId) return false;
    
    try {
      const updateMessage = {
        Type: "Profile",
        Name: profileData.Name || "",
        Bio: profileData.Bio || "",
        Website: profileData.Website || "",
        Channels: listType === "Channels" ? newTopicId : profileData.Channels,
        Groups: listType === "Groups" ? newTopicId : profileData.Groups,
        FollowingChannels: listType === "FollowingChannels" ? newTopicId : profileData.FollowingChannels,
        FollowingGroups: listType === "FollowingGroups" ? newTopicId : profileData.FollowingGroups,
        ExplorerMessages: profileData.ExplorerMessages || "",
        BillboardAds: profileData.BillboardAds || "",
        PrivateMessages: profileData.PrivateMessages || "",
        Picture: profileData.Picture || "",
        Banner: profileData.Banner || "",
        ProfileVersion: profileData.ProfileVersion || "2",
      };

      const result = await send(userProfileTopicId, updateMessage, "");
      return !!result;
    } catch (error) {
      console.error("Error updating profile with new topic ID:", error);
      return false;
    }
  };

  // V2 Groups list hook - handles reading/writing to Groups topic
  const groupsListTopicId = profileData ? getTopicId(profileData.Groups) : "";
  const groupsList = useProfileLists(
    groupsListTopicId,
    "Groups",
    userProfileTopicId,
    profileData,
    handleProfileUpdateWithNewTopicId
  );

  // V1 → V2 migration hook
  const migration = useProfileMigration(profileData, userProfileTopicId, triggerRefresh);

  // ========================================================================
  // COMPONENT STATE MANAGEMENT
  // ========================================================================

  // Form input states - initialized from existing group data
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [uploadedMediaId, setUploadedMediaId] = useState<string | null>(null);

  // UI control states
  const [isEditing, setIsEditing] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);

  // Auto-progression states
  const [autoProgress, setAutoProgress] = useState(false);
  const autoProgressRef = useRef(false);
  const [countdown, setCountdown] = useState(0);
  const [autoProgressDisabledByError, setAutoProgressDisabledByError] =
    useState(false);

  // Process tracking states
  const [stepStatuses, setStepStatuses] = useState<GroupUpdateSteps>({
    arweave: icon ? { status: "idle", disabled: false } : undefined,
    updateProfile: { status: "idle", disabled: true },
  });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxSize = 100 * 1024 * 1024; // 100 MB

  // ========================================================================
  // INITIALIZATION AND DATA LOADING
  // ========================================================================

  /**
   * Initializes form data with existing group information when available
   * Handles both V1 (array in profile) and V2 (topic ID with groupsList.items)
   */
  useEffect(() => {
    if (accountId && profileData && groupId) {
      // V2: Check groupsList.items first (loaded from Groups topic)
      if (isV2Profile(profileData) && groupsList.items.length > 0) {
        const existingGroup = (groupsList.items as GroupItem[]).find(
          (group) => group.Group === groupId
        );
        if (existingGroup) {
          setName(existingGroup.Name || "");
          setDescription(existingGroup.Description || "");
          if (existingGroup.Media) {
            setIconPreview(existingGroup.Media);
          }
        }
      } else {
        // V1: Read from profile.Groups array directly
        const groupsArray = getArrayData(profileData.Groups);
        const existingGroup = groupsArray.find(
          (group: unknown) => (group as { Group: string }).Group === groupId
        );
        if (existingGroup) {
          const g = existingGroup as {
            Group: string;
            Name: string;
            Description: string;
            Media: string;
          };
          setName(g.Name || "");
          setDescription(g.Description || "");
          if (g.Media) {
            setIconPreview(g.Media);
          }
        }
      }
    }
  }, [accountId, profileData, groupId, groupsList.items]);

  // ========================================================================
  // AUTO-PROGRESSION STATE SYNCHRONIZATION
  // ========================================================================

  // Monitor icon upload completion for auto-progression to profile update
  useEffect(() => {
    if (
      autoProgressRef.current &&
      uploadedMediaId &&
      uploadedMediaId.trim() !== ""
    ) {
      // Check if we should auto-progress to profile update step
      const updateStep = stepStatuses.updateProfile;
      if (updateStep && updateStep.status === "idle" && !updateStep.disabled) {
        console.log(
          "Icon upload complete, auto-progressing to profile update..."
        );
        setTimeout(() => {
          handleUpdateProfile().catch((error) => {
            console.error("Auto-update profile error:", error);
            disableAutoProgression("Profile update error");
          });
        }, 1000);
      }
    }
  }, [
    uploadedMediaId,
    stepStatuses.updateProfile?.status,
    autoProgressRef.current,
  ]);

  // ========================================================================
  // IMAGE HANDLING FUNCTIONS
  // ========================================================================

  /**
   * Handles emoji selection from the emoji picker
   * Adds the selected emoji to the description text
   */
  const onEmojiClick = (emojiData: { emoji: string }) => {
    setDescription((prevDescription) => prevDescription + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  /**
   * Clears the current icon selection and resets related states
   * Also removes the file from the file input and updates step statuses
   */
  const clearIcon = () => {
    setIcon(null);
    setIconPreview(null);
    setTempImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setStepStatuses((prev) => {
      const newStatuses = { ...prev };
      delete newStatuses.arweave;
      return newStatuses;
    });
  };

  /**
   * Handles file selection for group icon
   * Validates file size, creates preview, and updates step statuses
   */
  const handleIconChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (file.size > maxSize) {
      toast.error("The file exceeds 100MB.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setTempImage(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Handles completion of image cropping using the ImageCropModal
   * Processes the cropped image and updates state
   */
  const handleImageCropComplete = (croppedFile: File) => {
    setIcon(croppedFile);
    setIconPreview(URL.createObjectURL(croppedFile));
    setShowCropper(false);
    setTempImage(null);
  };

  // ========================================================================
  // AUTO-PROGRESSION UTILITY FUNCTIONS
  // ========================================================================

  /**
   * Utility function to safely disable auto-progression
   */
  const disableAutoProgression = (reason: string) => {
    console.log(`Disabling auto-progression: ${reason}`);
    setAutoProgress(false);
    autoProgressRef.current = false;
    setCountdown(0);
    setAutoProgressDisabledByError(true);
  };

  /**
   * Utility function to reset auto-progression after errors
   */
  const resetAutoProgression = () => {
    console.log(
      "Resetting auto-progression and automatically starting next step"
    );

    // First check if wallet is connected
    if (!accountId) {
      console.log("Cannot reset auto-progression: wallet not connected");
      toast.warning(
        "Please connect your wallet before resetting auto-progression"
      );
      return;
    }

    // Reset the disabled state
    setAutoProgressDisabledByError(false);

    // Enable auto-progression
    setAutoProgress(true);
    autoProgressRef.current = true;

    // Find the first available step to start (prioritize errors, then idle)
    const stepOrder = ["arweave", "updateProfile"];

    // First, look for failed steps to retry
    const failedStep = stepOrder.find((stepName) => {
      const status = stepStatuses[stepName as keyof GroupUpdateSteps];
      return status && status.status === "error" && !status.disabled;
    });

    if (failedStep) {
      console.log("Found failed step to retry:", failedStep);
      toast.info(`Auto-progression reset. Retrying ${failedStep}...`);

      // Start the failed step after a short delay
      setTimeout(() => {
        switch (failedStep) {
          case "arweave":
            console.log("Retrying icon upload...");
            handleArweaveUpload().catch((error) => {
              console.error("Auto-retry icon upload error:", error);
              disableAutoProgression("Icon upload retry error");
            });
            break;
          case "updateProfile":
            console.log("Retrying profile update...");
            handleUpdateProfile().catch((error) => {
              console.error("Auto-retry profile update error:", error);
              disableAutoProgression("Profile update retry error");
            });
            break;
          default:
            console.warn("Unknown step for auto-retry:", failedStep);
        }
      }, 1000);
      return;
    }

    // If no failed steps, look for idle steps to start
    const idleStep = stepOrder.find((stepName) => {
      const status = stepStatuses[stepName as keyof GroupUpdateSteps];
      return status && status.status === "idle" && !status.disabled;
    });

    if (idleStep) {
      console.log("Found idle step to start:", idleStep);
      toast.success(`Auto-progression reset. Starting ${idleStep}...`);

      setTimeout(() => {
        switch (idleStep) {
          case "arweave":
            console.log("Starting icon upload...");
            handleArweaveUpload().catch((error) => {
              console.error("Auto-start icon upload error:", error);
              disableAutoProgression("Icon upload start error");
            });
            break;
          case "updateProfile":
            console.log("Starting profile update...");
            handleUpdateProfile().catch((error) => {
              console.error("Auto-start profile update error:", error);
              disableAutoProgression("Profile update start error");
            });
            break;
          default:
            console.warn("Unknown step for auto-start:", idleStep);
        }
      }, 1000);
    } else {
      // All steps are complete or no steps available
      console.log("No steps available for auto-progression");
      toast.success("Auto-progression reset and enabled.");
    }
  };

  /**
   * Enhanced validation function
   */
  const validateWalletState = async (): Promise<boolean> => {
    try {
      // Check basic wallet connectivity
      if (!accountId) {
        throw new Error("Wallet not properly connected");
      }

      const testAccountId = String(accountId);
      if (!testAccountId || testAccountId === "undefined") {
        throw new Error("Account ID not available");
      }

      return true;
    } catch (error) {
      console.warn("Wallet state validation failed:", error);
      return false;
    }
  };

  /**
   * Next.js safe wrapper for async operations with enhanced pre-validation
   */
  const safeAsyncWrapper = async (
    operation: () => Promise<unknown>,
    context: string,
    onError?: (error: string) => void
  ): Promise<unknown> => {
    try {
      // Pre-execution validation
      const walletIsValid = await validateWalletState();
      if (!walletIsValid) {
        throw new Error(
          "Wallet connection is not stable. Please reconnect your wallet."
        );
      }

      // Execute operation with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              "Operation timed out. This might indicate a wallet connectivity issue."
            )
          );
        }, 30000); // 30 second timeout
      });

      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } catch (error) {
      console.error(`Safe wrapper caught error in ${context}:`, error);

      let errorMessage = "An unexpected error occurred";
      let isUserRejection = false;
      let shouldRetry = false;

      if (error && typeof error === "object") {
        if ("message" in error && typeof error.message === "string") {
          if (error.message.includes("USER_REJECT")) {
            isUserRejection = true;
            errorMessage = "Transaction rejected by user";
          } else if (error.message.includes("Query.fromBytes")) {
            shouldRetry = true;
            errorMessage = "Wallet synchronization issue. Retrying...";
          } else {
            errorMessage = error.message;
          }
        }
      } else if (error instanceof Error) {
        if (error.message.includes("USER_REJECT")) {
          isUserRejection = true;
          errorMessage = "Transaction rejected by user";
        } else if (error.message.includes("Query.fromBytes")) {
          shouldRetry = true;
          errorMessage = "Wallet synchronization issue. Retrying...";
        } else {
          errorMessage = error.message;
        }
      }

      // Handle different error types appropriately
      if (
        shouldRetry &&
        autoProgressRef.current &&
        context !== "retry-operation"
      ) {
        console.log(`Auto-retry scheduled for ${context} due to wallet issue`);
        setTimeout(async () => {
          console.log(`Retrying ${context}...`);
          await safeAsyncWrapper(operation, `retry-${context}`, onError);
        }, 3000);

        toast.warning(
          "Wallet connectivity issue detected. Retrying automatically..."
        );
        return null;
      }

      // Disable auto-progression on user rejection
      if (isUserRejection && autoProgressRef.current) {
        disableAutoProgression("User rejected transaction");
      }

      // Call error handler if provided
      if (onError) {
        onError(errorMessage);
      }

      return null;
    }
  };

  // ========================================================================
  // GROUP UPDATE WORKFLOW FUNCTIONS
  // ========================================================================

  /**
   * Proceeds with the group update workflow after V2 migration check passes
   * Sets up the update steps and transitions to processing view
   */
  const proceedWithGroupUpdate = () => {
    setIsEditing(false);

    // Set up steps based on what needs to be uploaded
    const newStepStatuses: GroupUpdateSteps = {
      updateProfile: { status: "idle", disabled: true },
    };

    if (icon) {
      newStepStatuses.arweave = { status: "idle", disabled: false };
    } else {
      // If no icon upload needed, enable profile update directly
      newStepStatuses.updateProfile = { status: "idle", disabled: false };
    }

    setStepStatuses(newStepStatuses);
  };

  /**
   * Initiates the group update process
   * Validates required fields and checks for V1 → V2 migration requirement
   */
  const handleStartUpdate = () => {
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }

    if (!description.trim()) {
      toast.error("Group description is required");
      return;
    }

    if (icon && icon.size > maxSize) {
      toast.error("The group icon file exceeds 100MB.");
      return;
    }

    // Use migration.requireV2() to check if V1 profile needs migration
    // For V2 profiles, this immediately calls proceedWithGroupUpdate()
    // For V1 profiles, this shows the migration modal first
    migration.requireV2(() => {
      proceedWithGroupUpdate();
    });
  };

  /**
   * Handles the upload of group icon to Arweave
   * Updates step statuses during the process and handles success/error states
   */
  const handleArweaveUpload = async () => {
    if (!icon) return;

    setStepStatuses((prev) => ({
      ...prev,
      arweave: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        const mediaId = await uploadToArweave(icon);
        return mediaId;
      },
      "Icon Upload",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          arweave: { status: "error", disabled: false },
        }));

        // Stop auto-progression on error
        if (autoProgressRef.current) {
          console.log("Icon upload failed, stopping auto-progression");
          disableAutoProgression("Icon upload error");
        }
      }
    );

    if (result) {
      setUploadedMediaId(`${result}`);
      toast.success("Group icon uploaded to Arweave successfully.");

      setStepStatuses((prev) => ({
        ...prev,
        arweave: { status: "success" as const, disabled: true },
        updateProfile: { status: "idle", disabled: false },
      }));

      // Auto-progression will be handled by useEffect hook monitoring uploadedMediaId
      console.log(
        "Icon upload complete, auto-progression will be handled by useEffect"
      );
    }
  };

  /**
   * Performs the final profile update by updating the group in the user's profile
   * V2: Uses groupsList.updateItem() to update the Groups list topic (no profile rewrite)
   * V1: Rewrites the entire profile with updated Groups array
   */
  const handleUpdateProfile = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      updateProfile: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        // V2 Profile: Use groupsList.updateItem() to update the Groups list topic
        // This avoids rewriting the entire profile
        if (profileData && isV2Profile(profileData)) {
          console.log("V2 Profile: Updating group via groupsList.updateItem()");
          
          const updateSuccess = await groupsList.updateItem(groupId, {
            Name: name,
            Description: description,
            Media: uploadedMediaId || iconPreview || "",
          });
          
          if (!updateSuccess) {
            throw new Error("Failed to update group in Groups list topic");
          }
          
          return { success: true };
        }

        // V1 Profile: Rewrite the entire profile with updated Groups array
        console.log("V1 Profile: Updating group via profile rewrite");
        
        // Find and update the group in the Groups array using getArrayData
        const currentGroups = getArrayData(profileData?.Groups);
        const updatedGroups = currentGroups.map((group: unknown) => {
          const g = group as {
            Group: string;
            Name: string;
            Description: string;
            Media: string;
          };
          if (g.Group === groupId) {
            return {
              ...g,
              Name: name,
              Description: description,
              Media: uploadedMediaId || iconPreview || g.Media,
            };
          }
          return g;
        });

        const updateMessage = {
          Type: "Profile",
          Name: profileData?.Name || "",
          Bio: profileData?.Bio || "",
          Website: profileData?.Website || "",
          Channels: profileData?.Channels || [],
          Groups: updatedGroups,
          FollowingChannels: profileData?.FollowingChannels || [],
          FollowingGroups: profileData?.FollowingGroups || [],
          ExplorerMessages: profileData?.ExplorerMessages || "",
          BillboardAds: profileData?.BillboardAds || "",
          Picture: profileData?.Picture || "",
          Banner: profileData?.Banner || "",
          ProfileVersion: profileData?.ProfileVersion || 1,
        };

        const updateProfile = await send(userProfileTopicId, updateMessage, "");

        // Check if send returned undefined (user rejection or cancellation)
        if (!updateProfile) {
          console.warn("Profile update was cancelled or rejected by user");
          return null; // Return null to indicate cancellation
        }

        // Check the transaction result
        if (
          !(
            updateProfile as {
              receipt?: { result?: { toString: () => string } };
            }
          )?.receipt?.result?.toString ||
          (
            updateProfile as {
              receipt: { result: { toString: () => string } };
            }
          ).receipt.result.toString() !== "SUCCESS"
        ) {
          throw new Error("Failed to update profile - transaction failed");
        }

        return updateProfile;
      },
      "Profile Update",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          updateProfile: { status: "error", disabled: false },
        }));

        // Stop auto-progression on error
        if (autoProgressRef.current) {
          console.log("Profile update failed, stopping auto-progression");
          disableAutoProgression("Profile update error");
        }
      }
    );

    if (result) {
      // Success path - transaction completed successfully
      setStepStatuses((prev) => ({
        ...prev,
        updateProfile: { status: "success", disabled: true },
      }));
      toast.success("Group Updated Successfully");
      onClose();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      triggerRefresh();
    } else if (result === null) {
      // User cancelled/rejected the transaction
      console.log("User cancelled profile update");
      setStepStatuses((prev) => ({
        ...prev,
        updateProfile: { status: "error", disabled: false },
      }));

      // Disable auto-progression since user rejected
      if (autoProgressRef.current) {
        console.log("User rejected transaction, stopping auto-progression");
        disableAutoProgression("User rejected transaction");
      }

      toast.warn("Group update cancelled. You can retry manually.");
      return;
    }
  };

  /**
   * Renders a step with status indicators and action button
   * Used in the processing steps view
   */
  const renderStepButton = (
    step: keyof GroupUpdateSteps,
    label: string,
    handler: () => void
  ) => {
    const status = stepStatuses[step];
    if (!status) return null;

    return (
      <div
        className="flex justify-between items-center p-4 rounded-lg transition-all duration-200 border border-purple-400/20 shadow-lg shadow-purple-400/5 bg-slate-800/20"
        key={step}
      >
        {/* Left side - Step information */}
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1">
            {/* Status icon */}
            <div
              className={`w-2 h-2 rounded-full ${
                status.status === "success"
                  ? "bg-green-400"
                  : status.status === "error"
                  ? "bg-red-400"
                  : status.status === "loading"
                  ? "bg-purple-400 animate-pulse"
                  : status.disabled
                  ? "bg-gray-500"
                  : "bg-purple-400"
              }`}
            />

            {/* Step label */}
            <h3
              className={`text-base font-medium font-mono ${
                status.status === "success"
                  ? "text-green-400"
                  : status.status === "error"
                  ? "text-red-400"
                  : status.disabled
                  ? "text-gray-500"
                  : "text-white"
              }`}
            >
              {label}
            </h3>
          </div>

          {/* Status messages */}
          {status.status === "error" && (
            <p className="text-sm text-red-400/80 font-light">
              Failed. Please try again.
            </p>
          )}
          {status.status === "loading" && (
            <p className="text-sm text-purple-400/80 font-light animate-pulse">
              Processing...
            </p>
          )}
          {status.status === "success" &&
            autoProgressRef.current &&
            countdown > 0 && (
              <p className="text-sm text-green-400/80 font-light">
                Next step in {countdown}s...
              </p>
            )}
          {status.status === "success" && countdown === 0 && (
            <p className="text-sm text-green-400/80 font-light">
              Completed successfully
            </p>
          )}
        </div>

        {/* Right side - Action button */}
        <div className="flex-shrink-0">
          <button
            onClick={handler}
            disabled={status.disabled || status.status === "loading"}
            className={`px-6 py-2 rounded-lg transition-all duration-200 font-medium min-w-[100px] font-mono
                      flex items-center justify-center shadow-lg ${
                        status.status === "success"
                          ? "bg-green-500 text-white shadow-green-500/25 cursor-default"
                          : status.status === "loading"
                          ? "bg-slate-700 text-white animate-pulse cursor-not-allowed"
                          : status.status === "error"
                          ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/25"
                          : status.disabled
                          ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-purple-400 to-pink-500 hover:scale-105 text-white shadow-purple-400/25"
                      }`}
          >
            {status.status === "loading" ? (
              <span className="text-sm">Processing...</span>
            ) : status.status === "success" ? (
              <>
                <RiCheckLine className="mr-1.5" />
                <span className="text-sm">Done</span>
              </>
            ) : status.status === "error" ? (
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
    );
  };

  /**
   * Renders the processing steps view showing update progress
   * Displays preview of changes and step-by-step update buttons
   */
  const renderProcessingSteps = () => (
    <div className="p-4 h-[80vh] flex flex-col">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-mono text-purple-400">Update Group</h1>
        </div>

        {/* Auto-progress toggle */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-white/60 font-mono">Auto-progress</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newAutoProgress = !autoProgress;
                console.log(
                  "Toggling auto-progress from",
                  autoProgress,
                  "to",
                  newAutoProgress
                );
                setAutoProgress(newAutoProgress);
                autoProgressRef.current = newAutoProgress;

                // If enabling auto-progress, check if there's a pending step to start
                if (newAutoProgress) {
                  // First check if wallet is connected
                  if (!accountId) {
                    console.log("Auto-progress disabled: wallet not connected");
                    setAutoProgress(false);
                    autoProgressRef.current = false;
                    toast.warning(
                      "Please connect your wallet before enabling auto-progress"
                    );
                    return;
                  }

                  console.log(
                    "Auto-progress enabled, checking for pending steps..."
                  );
                  console.log("Current step statuses:", stepStatuses);

                  // Find the first available step in proper order
                  const stepOrder = ["arweave", "updateProfile"];

                  const nextStep = stepOrder.find((stepName) => {
                    const status =
                      stepStatuses[stepName as keyof GroupUpdateSteps];
                    return (
                      status && status.status === "idle" && !status.disabled
                    );
                  });

                  console.log(
                    "Found next step for auto-progression:",
                    nextStep
                  );
                  if (nextStep) {
                    console.log("Auto-starting step:", nextStep);
                    setTimeout(() => {
                      switch (nextStep) {
                        case "arweave":
                          console.log(
                            "Auto-progression: Starting icon upload..."
                          );
                          handleArweaveUpload().catch((error) => {
                            console.error("Auto-upload error:", error);
                            disableAutoProgression("Upload error");
                          });
                          break;
                        case "updateProfile":
                          console.log("Auto-progression: Updating profile...");
                          handleUpdateProfile().catch((error) => {
                            console.error("Auto-update profile error:", error);
                            disableAutoProgression("Profile update error");
                          });
                          break;
                        default:
                          console.warn(
                            "Unknown step for auto-progression:",
                            nextStep
                          );
                      }
                    }, 500);
                  } else {
                    console.log("No available steps for auto-progression");
                  }
                }
              }}
              disabled={autoProgressDisabledByError}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                autoProgress ? "bg-purple-500" : "bg-slate-600"
              } ${
                autoProgressDisabledByError
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  autoProgress ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
            {/* Status indicator */}
            <span
              className={`text-xs font-mono px-2 py-1 rounded ${
                autoProgress
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "bg-slate-600/20 text-slate-400 border border-slate-600/30"
              }`}
            >
              {autoProgress ? "ON" : "OFF"}
            </span>
            {/* Reset button when auto-progression is disabled by error */}
            {autoProgressDisabledByError && (
              <button
                onClick={resetAutoProgression}
                className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-mono hover:bg-amber-500/30 transition-colors duration-200"
                title="Reset auto-progression after error"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Group Information Preview */}
      <div className="mb-4 p-3 bg-slate-800/80 backdrop-blur-md rounded-xl border border-purple-400/30 shadow-lg shadow-purple-400/10 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          {iconPreview && (
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 ring-2 ring-purple-400/30">
              {icon ? (
                <img
                  src={iconPreview}
                  alt="Group"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full">
                  <ReadMediaFile cid={iconPreview} />
                </div>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-mono font-bold text-white truncate bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {name}
            </h2>
            <p className="text-xs text-purple-400 font-mono">
              Group ID: {groupId}
            </p>
          </div>
        </div>
        {description && (
          <p className="text-white/80 break-words text-sm leading-relaxed font-light line-clamp-2">
            {description}
          </p>
        )}
      </div>

      {/* Processing Steps - Scrollable */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {/* Upload Group Icon Step */}
        {renderStepButton("arweave", "Upload Group Icon", handleArweaveUpload)}

        {/* Update Profile Step */}
        {renderStepButton(
          "updateProfile",
          "Update Profile",
          handleUpdateProfile
        )}

        {/* Cancel Button */}
        <button
          onClick={onClose}
          className="w-full bg-slate-800 hover:bg-red-500/20 text-white py-2 mt-3 px-4 rounded-full border border-purple-400/50 hover:border-red-400/50 transition-all duration-200 font-mono"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  /**
   * Renders the edit form view for updating group information
   * Includes inputs for name, description, and group icon
   */
  const renderEditForm = () => (
    <div className="flex flex-col max-h-[80vh] bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-purple-400/50 flex-shrink-0">
        <h3 className="text-2xl font-mono text-purple-400 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Update Group
        </h3>
        <p className="text-sm text-white/60 mt-1 font-light">
          Update your group information
        </p>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Group Icon Section */}
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              {iconPreview ? (
                <>
                  {/* Icon Preview */}
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-800/50 mb-3 ring-2 ring-purple-400/30">
                    {icon ? (
                      <img
                        src={iconPreview}
                        alt="Group Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full">
                        <ReadMediaFile cid={iconPreview} />
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex gap-2 justify-center">
                    <label
                      htmlFor="iconUpload"
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-gradient-to-r from-purple-400 to-pink-500 hover:scale-110 text-white cursor-pointer
                        transition-all duration-200 shadow-lg shadow-purple-400/25"
                      title="Change Icon"
                    >
                      <MdOutlinePermMedia className="text-sm" />
                    </label>
                    <button
                      onClick={clearIcon}
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white
                        transition-all duration-200"
                      title="Remove Icon"
                    >
                      <RiDeleteBinLine className="text-sm" />
                    </button>
                  </div>
                </>
              ) : (
                // Upload new icon button
                <label
                  htmlFor="iconUpload"
                  className="flex flex-col items-center gap-2 p-4 cursor-pointer rounded-xl
                    border-2 border-dashed border-purple-400/50 hover:border-purple-400
                    transition-all duration-200 w-full max-w-[240px] hover:bg-purple-400/5"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-400/10 flex items-center justify-center">
                    <MdOutlinePermMedia className="text-2xl text-purple-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-white text-sm">
                      Add Group Icon
                    </p>
                    <p className="text-xs text-white/50">Up to 100MB</p>
                  </div>
                </label>
              )}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              id="iconUpload"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleIconChange}
            />
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5 font-mono">
                Group Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-white font-light
                  border-2 transition-all duration-200 outline-none ${
                    name.trim()
                      ? "border-green-400/50 focus:border-green-400 shadow-lg shadow-green-400/10"
                      : "border-purple-400/50 focus:border-purple-400 shadow-lg shadow-purple-400/10"
                  }`}
                placeholder="Your group name"
                maxLength={50}
              />
              {name.trim() && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1 font-light">
                  <RiCheckLine className="text-sm" />
                  Group name looks good!
                </p>
              )}
            </div>

            {/* Description Input - Updated with emoji picker */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5 font-mono">
                Group Description <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-white font-light
                    border-2 border-purple-400/50 focus:border-purple-400 transition-all
                    duration-200 outline-none resize-none min-h-[100px] shadow-lg shadow-purple-400/10"
                  placeholder="Describe your group"
                  rows={4}
                  maxLength={200}
                />
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="absolute right-2 bottom-2 p-2 rounded-full
                    hover:bg-purple-400/10 text-white/60 hover:text-purple-400
                    transition-colors duration-200"
                  type="button"
                >
                  😊
                </button>
              </div>

              {/* Emoji Picker Popup */}
              {showEmojiPicker && (
                <EmojiPickerPopup
                  onEmojiClick={onEmojiClick}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
              {description.trim() && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1 font-light">
                  <RiCheckLine className="text-sm" />
                  Description looks good!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="border-t border-purple-400/50 bg-slate-900/95 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex justify-between space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 font-semibold rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-all duration-200 font-mono"
            >
              Cancel
            </button>
            <button
              onClick={handleStartUpdate}
              disabled={!name.trim() || !description.trim()}
              className={`px-8 py-2.5 font-semibold rounded-full transition-all
                duration-200 hover:shadow-lg active:scale-98 font-mono ${
                  !name.trim() || !description.trim()
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-400 to-pink-500 hover:scale-105 text-white shadow-lg shadow-purple-400/25"
                }`}
            >
              Update Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-md w-full mx-auto bg-slate-900/80 backdrop-blur-md rounded-2xl border border-purple-400/50 text-white">
      {isEditing ? renderEditForm() : renderProcessingSteps()}

      {/* Image Cropper Modal using common Modal component */}
      <ImageCropModal
        isOpen={showCropper}
        onClose={() => {
          setShowCropper(false);
          setTempImage(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }}
        tempImage={tempImage || ""}
        onCropComplete={handleImageCropComplete}
      />

      {/* V1 → V2 Migration Modal - only render when profileData exists */}
      {profileData && (
        <MigrationModal
          isOpen={migration.showMigrationModal}
          onClose={() => migration.setShowMigrationModal(false)}
          profileData={profileData}
          profileTopicId={userProfileTopicId}
          onMigrationComplete={() => {
            migration.setShowMigrationModal(false);
            // After migration completes, proceed with the group update
            proceedWithGroupUpdate();
          }}
        />
      )}
    </div>
  );
};

export default UpdateGroup;
