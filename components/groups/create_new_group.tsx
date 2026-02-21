/**
 * CreateNewGroup is a React component that provides a form interface for users to create new groups.
 * It handles:
 * - Group image upload to Arweave
 * - Group information (name, description)
 * - Multi-step creation process (create topic, upload image, update profile)
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
import useCreateTopic from "../hooks/use_create_topic";
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
 * Tracks the state of each step in the group creation process
 */
interface StepStatus {
  status: "idle" | "loading" | "success" | "error";
  disabled: boolean;
}

/**
 * GroupCreationSteps Interface
 * Manages the status of all steps in the group creation process
 *
 * For FIRST group (no Groups list topic exists):
 * - createGroupsListTopic: Creates the Groups list topic
 * - sendToGroupsList: Sends group data to the new Groups list topic
 * - updateProfileWithGroupsTopic: Updates profile with new Groups topic ID
 *
 * For SUBSEQUENT groups (Groups list topic already exists):
 * - updateGroupsList: Just sends updated list to existing topic
 */
interface GroupCreationSteps {
  createTopic?: StepStatus;
  sendIdentifier?: StepStatus;
  arweave?: StepStatus;
  // First group creation steps (when Groups list topic doesn't exist)
  createGroupsListTopic?: StepStatus;
  sendToGroupsList?: StepStatus;
  updateProfileWithGroupsTopic?: StepStatus;
  // Subsequent group creation step (when Groups list topic exists)
  updateGroupsList?: StepStatus;
  // Legacy - kept for backward compatibility with V1 profiles
  updateProfile?: StepStatus;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const CreateNewGroup = ({ onClose }: { onClose: () => void }) => {
  // ========================================================================
  // HOOKS & EXTERNAL DEPENDENCIES
  // ========================================================================

  const { data: accountId } = useAccountId();
  const { send } = useSendMessage();
  const { profileData } = useGetProfile(accountId || "");
  const userProfileTopicId = profileData ? profileData.ProfileTopic : "";
  const { uploadToArweave } = useUploadToArweave();
  const { create: createTopic } = useCreateTopic();
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

  // Form input states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedMediaId, setUploadedMediaId] = useState<string | null>(null);
  const [createdTopicId, setCreatedTopicId] = useState<string | null>(null);
  const [identifierSent, setIdentifierSent] = useState(false);
  
  // First-group creation state: track the new Groups list topic ID
  const [newGroupsListTopicId, setNewGroupsListTopicId] = useState<string | null>(null);

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

  // Detect if this is the first group (no Groups list topic exists)
  const isFirstGroup = !groupsListTopicId || groupsListTopicId.trim() === "";

  // Calculate total wallet approvals needed for user warning
  // First group: createTopic(1) + sendIdentifier(1) + createGroupsListTopic(1) + sendToGroupsList(1) + updateProfileWithGroupsTopic(1) = 5
  // Subsequent: createTopic(1) + sendIdentifier(1) + updateGroupsList(1) = 3
  // Note: arweave upload doesn't require wallet approval
  const walletApprovals = isFirstGroup ? 5 : 3;

  // Process tracking states
  const [stepStatuses, setStepStatuses] = useState<GroupCreationSteps>({
    createTopic: { status: "idle", disabled: false },
    sendIdentifier: { status: "idle", disabled: true },
    arweave: image ? { status: "idle", disabled: false } : undefined,
    updateProfile: { status: "idle", disabled: true },
  });

  // Limits
  const nameMaxLength = 50;
  const descriptionMaxLength = 200;

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxSize = 100 * 1024 * 1024; // 100 MB

  // ========================================================================
  // AUTO-PROGRESSION STATE SYNCHRONIZATION
  // ========================================================================

  // Monitor topic creation completion for auto-progression to image upload or send identifier
  useEffect(() => {
    if (
      autoProgressRef.current &&
      createdTopicId &&
      createdTopicId.trim() !== ""
    ) {
      // Check if we should auto-progress to image upload step (if image exists)
      const arweaveStep = stepStatuses.arweave;
      if (
        arweaveStep &&
        arweaveStep.status === "idle" &&
        !arweaveStep.disabled
      ) {
        console.log(
          "Topic creation complete, auto-progressing to image upload..."
        );
        setTimeout(() => {
          handleArweaveUpload().catch((error) => {
            console.error("Auto-image upload error:", error);
            disableAutoProgression("Image upload error");
          });
        }, 1000);
      } else if (!arweaveStep) {
        // No image to upload, go directly to send identifier
        const sendIdentifierStep = stepStatuses.sendIdentifier;
        if (
          sendIdentifierStep &&
          sendIdentifierStep.status === "idle" &&
          !sendIdentifierStep.disabled
        ) {
          console.log(
            "Topic creation complete (no image), auto-progressing to send identifier..."
          );
          setTimeout(() => {
            handleSendIdentifier().catch((error: unknown) => {
              console.error("Auto-send identifier error:", error);
              disableAutoProgression("Send identifier error");
            });
          }, 1000);
        }
      }
    }
  }, [createdTopicId, stepStatuses.arweave?.status, stepStatuses.sendIdentifier?.status, autoProgressRef.current]);

  // Monitor image upload completion for auto-progression to send identifier
  useEffect(() => {
    if (
      autoProgressRef.current &&
      uploadedMediaId &&
      uploadedMediaId.trim() !== "" &&
      !identifierSent
    ) {
      // Check if we should auto-progress to send identifier step
      const sendIdentifierStep = stepStatuses.sendIdentifier;
      if (
        sendIdentifierStep &&
        sendIdentifierStep.status === "idle" &&
        !sendIdentifierStep.disabled
      ) {
        console.log(
          "Image upload complete, auto-progressing to send identifier..."
        );
        setTimeout(() => {
          handleSendIdentifier().catch((error: unknown) => {
            console.error("Auto-send identifier error:", error);
            disableAutoProgression("Send identifier error");
          });
        }, 1000);
      }
    }
  }, [uploadedMediaId, stepStatuses.sendIdentifier?.status, autoProgressRef.current, identifierSent]);

  // Monitor identifier sent completion for auto-progression to next profile step
  // Important: This useEffect also monitors the disabled state so it re-runs when steps are enabled
  useEffect(() => {
    if (
      autoProgressRef.current &&
      identifierSent
    ) {
      // Check for V2 first-group steps first
      const createGroupsListStep = stepStatuses.createGroupsListTopic;
      if (createGroupsListStep && createGroupsListStep.status === "idle" && !createGroupsListStep.disabled) {
        console.log(
          "Identifier sent, auto-progressing to create Groups list topic..."
        );
        setTimeout(() => {
          handleCreateGroupsListTopic().catch((error) => {
            console.error("Auto-create Groups list error:", error);
            disableAutoProgression("Create Groups list error");
          });
        }, 1000);
        return;
      }

      // Check for V2 subsequent group step
      const updateGroupsListStep = stepStatuses.updateGroupsList;
      if (updateGroupsListStep && updateGroupsListStep.status === "idle" && !updateGroupsListStep.disabled) {
        console.log(
          "Identifier sent, auto-progressing to update Groups list..."
        );
        setTimeout(() => {
          handleUpdateGroupsList().catch((error) => {
            console.error("Auto-update Groups list error:", error);
            disableAutoProgression("Update Groups list error");
          });
        }, 1000);
        return;
      }

      // Legacy V1 profile update step
      const updateStep = stepStatuses.updateProfile;
      if (updateStep && updateStep.status === "idle" && !updateStep.disabled) {
        console.log(
          "Identifier sent, auto-progressing to profile update..."
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
    identifierSent,
    stepStatuses.updateProfile?.status,
    stepStatuses.updateProfile?.disabled,
    stepStatuses.createGroupsListTopic?.status,
    stepStatuses.createGroupsListTopic?.disabled,
    stepStatuses.updateGroupsList?.status,
    stepStatuses.updateGroupsList?.disabled,
    autoProgressRef.current
  ]);

  // Monitor first-group: createGroupsListTopic completion -> auto-progress to sendToGroupsList
  // Important: Monitors disabled state so it re-runs when step becomes enabled
  useEffect(() => {
    if (
      autoProgressRef.current &&
      newGroupsListTopicId &&
      stepStatuses.sendToGroupsList?.status === "idle" &&
      !stepStatuses.sendToGroupsList?.disabled
    ) {
      console.log(
        "Groups list topic created, auto-progressing to send to Groups list..."
      );
      setTimeout(() => {
        handleSendToGroupsList().catch((error) => {
          console.error("Auto-send to Groups list error:", error);
          disableAutoProgression("Send to Groups list error");
        });
      }, 1000);
    }
  }, [
    newGroupsListTopicId,
    stepStatuses.sendToGroupsList?.status,
    stepStatuses.sendToGroupsList?.disabled,
    autoProgressRef.current
  ]);

  // Monitor first-group: sendToGroupsList completion -> auto-progress to updateProfileWithGroupsTopic
  // Important: Monitors disabled state so it re-runs when step becomes enabled
  useEffect(() => {
    if (
      autoProgressRef.current &&
      stepStatuses.sendToGroupsList?.status === "success" &&
      stepStatuses.updateProfileWithGroupsTopic?.status === "idle" &&
      !stepStatuses.updateProfileWithGroupsTopic?.disabled
    ) {
      console.log(
        "Send to Groups list complete, auto-progressing to update profile with topic ID..."
      );
      setTimeout(() => {
        handleUpdateProfileWithGroupsTopic().catch((error) => {
          console.error("Auto-update profile with Groups topic error:", error);
          disableAutoProgression("Update profile with Groups topic error");
        });
      }, 1000);
    }
  }, [
    stepStatuses.sendToGroupsList?.status,
    stepStatuses.updateProfileWithGroupsTopic?.status,
    stepStatuses.updateProfileWithGroupsTopic?.disabled,
    autoProgressRef.current
  ]);

  // Monitor image upload completion for auto-progression to profile update
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
          "Image upload complete, auto-progressing to profile update..."
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

  // Monitor for enabling next profile-related step when identifier is sent and image upload is complete
  useEffect(() => {
    const topicStep = stepStatuses.createTopic;
    const sendIdentifierStep = stepStatuses.sendIdentifier;
    const arweaveStep = stepStatuses.arweave;

    // Check if topic creation, identifier send, and image upload are complete (if needed)
    const topicComplete = topicStep && topicStep.status === "success";
    const identifierComplete = sendIdentifierStep && sendIdentifierStep.status === "success";
    const arweaveComplete = !arweaveStep || arweaveStep.status === "success";

    if (topicComplete && identifierComplete && arweaveComplete) {
      // V2 first-group: Enable createGroupsListTopic step
      const createGroupsListStep = stepStatuses.createGroupsListTopic;
      if (createGroupsListStep && createGroupsListStep.status === "idle" && createGroupsListStep.disabled) {
        console.log("Previous steps complete, enabling create Groups list topic step...");
        setStepStatuses((prev) => ({
          ...prev,
          createGroupsListTopic: { status: "idle" as const, disabled: false },
        }));
        return;
      }

      // V2 subsequent group: Enable updateGroupsList step
      const updateGroupsListStep = stepStatuses.updateGroupsList;
      if (updateGroupsListStep && updateGroupsListStep.status === "idle" && updateGroupsListStep.disabled) {
        console.log("Previous steps complete, enabling update Groups list step...");
        setStepStatuses((prev) => ({
          ...prev,
          updateGroupsList: { status: "idle" as const, disabled: false },
        }));
        return;
      }

      // V1 legacy: Enable updateProfile step
      const updateStep = stepStatuses.updateProfile;
      if (updateStep && updateStep.status === "idle" && updateStep.disabled) {
        console.log("Previous steps complete, enabling profile update step...");
        setStepStatuses((prev) => ({
          ...prev,
          updateProfile: { status: "idle" as const, disabled: false },
        }));
      }
    }
  }, [
    stepStatuses.createTopic?.status,
    stepStatuses.sendIdentifier?.status,
    stepStatuses.arweave?.status,
    stepStatuses.createGroupsListTopic?.disabled,
    stepStatuses.updateGroupsList?.disabled,
    stepStatuses.updateProfile?.disabled,
  ]);

  // Monitor for auto-progression to final profile update
  useEffect(() => {
    if (autoProgressRef.current) {
      const topicStep = stepStatuses.createTopic;
      const sendIdentifierStep = stepStatuses.sendIdentifier;
      const arweaveStep = stepStatuses.arweave;
      const updateStep = stepStatuses.updateProfile;

      // Check if topic creation, identifier send, and image upload are complete and profile update is ready
      const topicComplete = topicStep && topicStep.status === "success";
      const identifierComplete = sendIdentifierStep && sendIdentifierStep.status === "success";
      const arweaveComplete = !arweaveStep || arweaveStep.status === "success";

      if (
        topicComplete &&
        identifierComplete &&
        arweaveComplete &&
        updateStep &&
        updateStep.status === "idle" &&
        !updateStep.disabled
      ) {
        console.log(
          "All previous steps complete, auto-progressing to profile update..."
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
    stepStatuses.createTopic?.status,
    stepStatuses.sendIdentifier?.status,
    stepStatuses.arweave?.status,
    stepStatuses.updateProfile?.status,
    stepStatuses.updateProfile?.disabled,
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
   * Clears the current image selection and resets related states
   * Also removes the file from the file input and updates step statuses
   */
  const clearImage = () => {
    setImage(null);
    setImagePreview(null);
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
   * Handles file selection for group image
   * Validates file size, creates preview, and updates step statuses
   */
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    setImage(croppedFile);
    setImagePreview(URL.createObjectURL(croppedFile));
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
   * Finds failed steps and restarts auto-progression from the first error
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
    // Include V2 first-group and subsequent group steps
    const stepOrder = [
      "createTopic",
      "arweave",
      "sendIdentifier",
      // V2 first-group steps
      "createGroupsListTopic",
      "sendToGroupsList",
      "updateProfileWithGroupsTopic",
      // V2 subsequent group step
      "updateGroupsList",
      // V1 legacy step
      "updateProfile"
    ];

    // First, look for failed steps to retry
    const failedStep = stepOrder.find((stepName) => {
      const status = stepStatuses[stepName as keyof GroupCreationSteps];
      return status && status.status === "error" && !status.disabled;
    });

    if (failedStep) {
      console.log("Found failed step to retry:", failedStep);
      toast.info(`Auto-progression reset. Retrying ${failedStep}...`);

      // Start the failed step after a short delay
      setTimeout(() => {
        switch (failedStep) {
          case "createTopic":
            console.log("Retrying topic creation...");
            handleCreateTopic().catch((error) => {
              console.error("Auto-retry topic creation error:", error);
              disableAutoProgression("Topic creation retry error");
            });
            break;
          case "sendIdentifier":
            console.log("Retrying send identifier...");
            handleSendIdentifier().catch((error: unknown) => {
              console.error("Auto-retry send identifier error:", error);
              disableAutoProgression("Send identifier retry error");
            });
            break;
          case "arweave":
            console.log("Retrying image upload...");
            handleArweaveUpload().catch((error) => {
              console.error("Auto-retry image upload error:", error);
              disableAutoProgression("Image upload retry error");
            });
            break;
          case "createGroupsListTopic":
            console.log("Retrying create Groups list topic...");
            handleCreateGroupsListTopic().catch((error) => {
              console.error("Auto-retry create Groups list topic error:", error);
              disableAutoProgression("Create Groups list topic retry error");
            });
            break;
          case "sendToGroupsList":
            console.log("Retrying send to Groups list...");
            handleSendToGroupsList().catch((error) => {
              console.error("Auto-retry send to Groups list error:", error);
              disableAutoProgression("Send to Groups list retry error");
            });
            break;
          case "updateProfileWithGroupsTopic":
            console.log("Retrying update profile with Groups topic...");
            handleUpdateProfileWithGroupsTopic().catch((error) => {
              console.error("Auto-retry update profile with Groups topic error:", error);
              disableAutoProgression("Update profile with Groups topic retry error");
            });
            break;
          case "updateGroupsList":
            console.log("Retrying update Groups list...");
            handleUpdateGroupsList().catch((error) => {
              console.error("Auto-retry update Groups list error:", error);
              disableAutoProgression("Update Groups list retry error");
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
      }, 1000); // 1 second delay before starting
      return;
    }

    // If no failed steps, look for idle steps to start
    const idleStep = stepOrder.find((stepName) => {
      const status = stepStatuses[stepName as keyof GroupCreationSteps];
      return status && status.status === "idle" && !status.disabled;
    });

    if (idleStep) {
      console.log("Found idle step to start:", idleStep);
      toast.success(`Auto-progression reset. Starting ${idleStep}...`);

      setTimeout(() => {
        switch (idleStep) {
          case "createTopic":
            console.log("Starting topic creation...");
            handleCreateTopic().catch((error) => {
              console.error("Auto-start topic creation error:", error);
              disableAutoProgression("Topic creation start error");
            });
            break;
          case "sendIdentifier":
            console.log("Starting send identifier...");
            handleSendIdentifier().catch((error: unknown) => {
              console.error("Auto-start send identifier error:", error);
              disableAutoProgression("Send identifier start error");
            });
            break;
          case "arweave":
            console.log("Starting image upload...");
            handleArweaveUpload().catch((error) => {
              console.error("Auto-start image upload error:", error);
              disableAutoProgression("Image upload start error");
            });
            break;
          case "createGroupsListTopic":
            console.log("Starting create Groups list topic...");
            handleCreateGroupsListTopic().catch((error) => {
              console.error("Auto-start create Groups list topic error:", error);
              disableAutoProgression("Create Groups list topic start error");
            });
            break;
          case "sendToGroupsList":
            console.log("Starting send to Groups list...");
            handleSendToGroupsList().catch((error) => {
              console.error("Auto-start send to Groups list error:", error);
              disableAutoProgression("Send to Groups list start error");
            });
            break;
          case "updateProfileWithGroupsTopic":
            console.log("Starting update profile with Groups topic...");
            handleUpdateProfileWithGroupsTopic().catch((error) => {
              console.error("Auto-start update profile with Groups topic error:", error);
              disableAutoProgression("Update profile with Groups topic start error");
            });
            break;
          case "updateGroupsList":
            console.log("Starting update Groups list...");
            handleUpdateGroupsList().catch((error) => {
              console.error("Auto-start update Groups list error:", error);
              disableAutoProgression("Update Groups list start error");
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
        }, 120000); // 120 second timeout (2 minutes)
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
  // GROUP CREATION WORKFLOW FUNCTIONS
  // ========================================================================

  /**
   * Proceeds with group creation after validation and V2 migration check
   * Sets up the appropriate creation steps based on whether this is the first group or subsequent
   */
  const proceedWithGroupCreation = () => {
    setIsEditing(false);

    // Re-check if this is the first group (groupsListTopicId may have changed)
    const firstGroup = !groupsListTopicId || groupsListTopicId.trim() === "";

    // Set up steps based on what needs to be done
    const newStepStatuses: GroupCreationSteps = {
      createTopic: { status: "idle", disabled: false },
      sendIdentifier: { status: "idle", disabled: true },
    };

    if (image) {
      newStepStatuses.arweave = { status: "idle", disabled: true };
    }

    // For V2 profiles: Set up appropriate profile update steps
    if (isV2Profile(profileData)) {
      if (firstGroup) {
        // First group: need to create Groups list topic, send to it, then update profile
        newStepStatuses.createGroupsListTopic = { status: "idle", disabled: true };
        newStepStatuses.sendToGroupsList = { status: "idle", disabled: true };
        newStepStatuses.updateProfileWithGroupsTopic = { status: "idle", disabled: true };
      } else {
        // Subsequent group: just send to existing Groups list topic
        newStepStatuses.updateGroupsList = { status: "idle", disabled: true };
      }
    } else {
      // V1 profile backward compatibility (shouldn't reach here due to requireV2)
      newStepStatuses.updateProfile = { status: "idle", disabled: true };
    }

    setStepStatuses(newStepStatuses);
  };

  /**
   * Initiates the group creation process
   * Validates required fields, checks for V1 migration requirement, and sets up steps
   * V1 profiles are intercepted and required to migrate before proceeding
   */
  const handleStartCreation = () => {
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }

    if (name.trim().length > nameMaxLength) {
      toast.error(`Group name must be ${nameMaxLength} characters or fewer`);
      return;
    }

    if (description.trim().length > descriptionMaxLength) {
      toast.error(
        `Group description must be ${descriptionMaxLength} characters or fewer`
      );
      return;
    }

    if (image && image.size > maxSize) {
      toast.error("The group image file exceeds 100MB.");
      return;
    }

    // V1 → V2 Migration Interception
    // If user has V1 profile, show migration modal before proceeding
    migration.requireV2(() => {
      // This callback only runs after profile is V2
      // (either already was V2, or migration just completed)
      proceedWithGroupCreation();
    });
  };

  /**
   * Handles the creation of a new group topic
   * Updates step statuses during the process and handles success/error states
   */
  const handleCreateTopic = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      createTopic: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        const topicId = await createTopic(
          `Group: ${name}`,
          `Creating group topic for ${name}`,
          false // Don't set submit key - allow anyone to post messages
        );
        return topicId;
      },
      "Topic Creation",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          createTopic: { status: "error", disabled: false },
        }));

        // Stop auto-progression on error
        if (autoProgressRef.current) {
          console.log("Topic creation failed, stopping auto-progression");
          disableAutoProgression("Topic creation error");
        }
      }
    );

    if (result) {
      setCreatedTopicId(`${result}`);
      toast.success("Group topic created successfully.");

      // Enable arweave step if image exists, otherwise enable sendIdentifier
      setStepStatuses((prev) => {
        const newStatuses = {
          ...prev,
          createTopic: { status: "success" as const, disabled: true },
        };
        if (prev.arweave) {
          // Has image, enable arweave upload next
          newStatuses.arweave = { status: "idle" as const, disabled: false };
        } else {
          // No image, enable sendIdentifier next
          newStatuses.sendIdentifier = { status: "idle" as const, disabled: false };
        }
        return newStatuses;
      });

      // Auto-progression will be handled by useEffect hook monitoring createdTopicId
      console.log(
        "Topic creation complete, auto-progression will be handled by useEffect"
      );
    }
  };

  /**
   * Handles sending the group identifier as the first message in the group topic
   * This allows anyone accessing the topic to get group information
   */
  const handleSendIdentifier = async () => {
    if (!createdTopicId) {
      toast.error("Group topic ID is missing");
      return;
    }

    setStepStatuses((prev) => ({
      ...prev,
      sendIdentifier: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        // Create the group identifier message
        const identifierMessage = {
          Type: "GroupIdentifier",
          Name: name,
          Description: description,
          Media: uploadedMediaId || "",
        };

        // Send the identifier as the first message in the group topic
        const sendResult = await send(createdTopicId, identifierMessage, "");
        return sendResult;
      },
      "Send Identifier",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          sendIdentifier: { status: "error", disabled: false },
        }));

        // Stop auto-progression on error
        if (autoProgressRef.current) {
          console.log("Send identifier failed, stopping auto-progression");
          disableAutoProgression("Send identifier error");
        }
      }
    );

    if (result) {
      setIdentifierSent(true);
      toast.success("Group identifier sent successfully.");

      // After identifier is sent, profile update will be enabled by useEffect
      setStepStatuses((prev) => ({
        ...prev,
        sendIdentifier: { status: "success" as const, disabled: true },
      }));

      console.log(
        "Identifier sent, auto-progression will be handled by useEffect"
      );
    }
  };

  /**
   * Handles the upload of group image to Arweave
   * Updates step statuses during the process and handles success/error states
   */
  const handleArweaveUpload = async () => {
    if (!image) return;

    setStepStatuses((prev) => ({
      ...prev,
      arweave: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        const mediaId = await uploadToArweave(image);
        return mediaId;
      },
      "Image Upload",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          arweave: { status: "error", disabled: false },
        }));

        // Stop auto-progression on error
        if (autoProgressRef.current) {
          console.log("Image upload failed, stopping auto-progression");
          disableAutoProgression("Image upload error");
        }
      }
    );

    if (result) {
      setUploadedMediaId(`${result}`);
      toast.success("Group image uploaded to Arweave successfully.");

      // After arweave upload, enable sendIdentifier
      setStepStatuses((prev) => ({
        ...prev,
        arweave: { status: "success" as const, disabled: true },
        sendIdentifier: { status: "idle" as const, disabled: false },
      }));

      // Auto-progression will be handled by useEffect hook monitoring uploadedMediaId
      console.log(
        "Image upload complete, auto-progression will be handled by useEffect"
      );
    }
  };

  // ========================================================================
  // V2 FIRST-GROUP CREATION STEPS (3 separate wallet approvals)
  // ========================================================================

  /**
   * Step 1 of first-group creation: Creates the Groups list topic
   * This is the first of 3 wallet approvals for first-group creation
   */
  const handleCreateGroupsListTopic = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      createGroupsListTopic: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        const memo = "iBird Groups List";
        const newTopicId = await createTopic(memo, memo, false);
        
        if (!newTopicId) {
          throw new Error("Failed to create Groups list topic");
        }
        
        return newTopicId;
      },
      "Create Groups List Topic",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          createGroupsListTopic: { status: "error", disabled: false },
        }));

        if (autoProgressRef.current) {
          console.log("Create Groups list topic failed, stopping auto-progression");
          disableAutoProgression("Create Groups list topic error");
        }
      }
    );

    if (result) {
      const newTopicId = `${result}`;
      setNewGroupsListTopicId(newTopicId);
      toast.success("Groups list topic created successfully.");

      // Wait a moment for topic to propagate before enabling next step
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Enable sendToGroupsList step
      setStepStatuses((prev) => ({
        ...prev,
        createGroupsListTopic: { status: "success" as const, disabled: true },
        sendToGroupsList: { status: "idle" as const, disabled: false },
      }));

      console.log("Groups list topic created, auto-progression will be handled by useEffect");
    }
  };

  /**
   * Step 2 of first-group creation: Sends group data to the new Groups list topic
   * This is the second of 3 wallet approvals for first-group creation
   */
  const handleSendToGroupsList = async () => {
    if (!newGroupsListTopicId) {
      toast.error("Groups list topic ID is missing");
      return;
    }

    if (!createdTopicId) {
      toast.error("Group topic ID is missing");
      return;
    }

    setStepStatuses((prev) => ({
      ...prev,
      sendToGroupsList: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        // Create the group item
        const newGroup: GroupItem = {
          Name: name,
          Group: createdTopicId,
          Description: description,
          Media: uploadedMediaId || "",
        };

        // Send initial array with the new group to the Groups list topic
        const sendResult = await send(newGroupsListTopicId, [newGroup], "");
        return sendResult;
      },
      "Send to Groups List",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          sendToGroupsList: { status: "error", disabled: false },
        }));

        if (autoProgressRef.current) {
          console.log("Send to Groups list failed, stopping auto-progression");
          disableAutoProgression("Send to Groups list error");
        }
      }
    );

    if (result) {
      toast.success("Group added to Groups list.");

      // Enable updateProfileWithGroupsTopic step
      setStepStatuses((prev) => ({
        ...prev,
        sendToGroupsList: { status: "success" as const, disabled: true },
        updateProfileWithGroupsTopic: { status: "idle" as const, disabled: false },
      }));

      console.log("Send to Groups list complete, auto-progression will be handled by useEffect");
    }
  };

  /**
   * Step 3 of first-group creation: Updates profile with new Groups topic ID
   * This is the third of 3 wallet approvals for first-group creation
   */
  const handleUpdateProfileWithGroupsTopic = async () => {
    if (!newGroupsListTopicId) {
      toast.error("Groups list topic ID is missing");
      return;
    }

    setStepStatuses((prev) => ({
      ...prev,
      updateProfileWithGroupsTopic: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        const updateMessage = {
          Type: "Profile",
          Name: profileData?.Name || "",
          Bio: profileData?.Bio || "",
          Website: profileData?.Website || "",
          Channels: profileData?.Channels || "",
          Groups: newGroupsListTopicId,
          FollowingChannels: profileData?.FollowingChannels || "",
          FollowingGroups: profileData?.FollowingGroups || "",
          ExplorerMessages: profileData?.ExplorerMessages || "",
          BillboardAds: profileData?.BillboardAds || "",
          PrivateMessages: profileData?.PrivateMessages || "",
          Picture: profileData?.Picture || "",
          Banner: profileData?.Banner || "",
          ProfileVersion: profileData?.ProfileVersion || "2",
        };

        const sendResult = await send(userProfileTopicId, updateMessage, "");
        return sendResult;
      },
      "Update Profile with Groups Topic",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          updateProfileWithGroupsTopic: { status: "error", disabled: false },
        }));

        if (autoProgressRef.current) {
          console.log("Update profile with Groups topic failed, stopping auto-progression");
          disableAutoProgression("Update profile with Groups topic error");
        }
      }
    );

    if (result) {
      setStepStatuses((prev) => ({
        ...prev,
        updateProfileWithGroupsTopic: { status: "success" as const, disabled: true },
      }));
      toast.success("Group Created Successfully!");
      onClose();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      triggerRefresh();
    } else if (result === null) {
      console.log("User cancelled profile update with Groups topic");
      setStepStatuses((prev) => ({
        ...prev,
        updateProfileWithGroupsTopic: { status: "error", disabled: false },
      }));

      if (autoProgressRef.current) {
        console.log("User rejected transaction, stopping auto-progression");
        disableAutoProgression("User rejected transaction");
      }

      toast.warn("Group creation cancelled. You can retry manually.");
    }
  };

  // ========================================================================
  // V2 SUBSEQUENT GROUP CREATION (1 wallet approval)
  // ========================================================================

  /**
   * For subsequent groups: Sends updated list to existing Groups list topic
   * This is just 1 wallet approval since the topic already exists
   */
  const handleUpdateGroupsList = async () => {
    if (!createdTopicId) {
      toast.error("Group topic ID is missing");
      return;
    }

    if (!groupsListTopicId) {
      toast.error("Groups list topic ID is missing");
      return;
    }

    setStepStatuses((prev) => ({
      ...prev,
      updateGroupsList: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        // Create the new group object
        const newGroup: GroupItem = {
          Name: name,
          Group: createdTopicId,
          Description: description,
          Media: uploadedMediaId || "",
        };

        // Get current groups from the hook and add the new one
        const currentGroups = groupsList.items as GroupItem[];
        const updatedGroups = [...currentGroups, newGroup];

        // Send updated array to existing Groups list topic
        const sendResult = await send(groupsListTopicId, updatedGroups, "");
        return sendResult;
      },
      "Update Groups List",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          updateGroupsList: { status: "error", disabled: false },
        }));

        if (autoProgressRef.current) {
          console.log("Update Groups list failed, stopping auto-progression");
          disableAutoProgression("Update Groups list error");
        }
      }
    );

    if (result) {
      setStepStatuses((prev) => ({
        ...prev,
        updateGroupsList: { status: "success" as const, disabled: true },
      }));
      toast.success("Group Created Successfully!");
      onClose();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      triggerRefresh();
    } else if (result === null) {
      console.log("User cancelled Groups list update");
      setStepStatuses((prev) => ({
        ...prev,
        updateGroupsList: { status: "error", disabled: false },
      }));

      if (autoProgressRef.current) {
        console.log("User rejected transaction, stopping auto-progression");
        disableAutoProgression("User rejected transaction");
      }

      toast.warn("Group creation cancelled. You can retry manually.");
    }
  };

  // ========================================================================
  // V1 LEGACY PROFILE UPDATE (backward compatibility)
  // ========================================================================

  /**
   * Performs the final profile update by adding the new group to the user's profile
   * V2: Adds the group to the Groups list topic via groupsList.addItem()
   * V1: Rewrites the entire profile with the updated Groups array
   * Updates step statuses and handles success/error states using enhanced validation
   */
  const handleUpdateProfile = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      updateProfile: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        if (!createdTopicId) {
          throw new Error("Group topic ID is missing");
        }

        // Create the new group object
        const newGroup: GroupItem = {
          Name: name,
          Group: createdTopicId,
          Description: description,
          Media: uploadedMediaId || "",
        };

        // V2: Add group via groupsList hook
        if (profileData && isV2Profile(profileData)) {
          const addResult = await groupsList.addItem(newGroup);
          
          if (!addResult) {
            throw new Error("Failed to add group to Groups list topic");
          }
          
          return { success: true };
        }

        // V1: Get current groups array or initialize empty array, then rewrite profile
        const currentGroups = getArrayData(profileData?.Groups);
        const updatedGroups = [...currentGroups, newGroup];

        const updateMessage = {
          Type: "Profile",
          Name: profileData?.Name || "",
          Bio: profileData?.Bio || "",
          Website: profileData?.Website || "",
          Channels: getArrayData(profileData?.Channels),
          Groups: updatedGroups,
          FollowingChannels: getArrayData(profileData?.FollowingChannels),
          FollowingGroups: getArrayData(profileData?.FollowingGroups),
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

        // Check the transaction result using the same pattern as create_new_profile
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
      toast.success("Group Created Successfully");
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

      toast.warn("Group creation cancelled. You can retry manually.");
      return;
    }
  };

  /**
   * Renders a step with status indicators and action button
   * Used in the processing steps view
   */
  const renderStepButton = (
    step: keyof GroupCreationSteps,
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
              className={`w-2 h-2 rounded-full ${status.status === "success"
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
              className={`text-base font-medium font-mono ${status.status === "success"
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
                      flex items-center justify-center shadow-lg ${status.status === "success"
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
   * Renders the processing steps view showing creation progress
   * Displays preview of changes and step-by-step creation buttons
   */
  const renderProcessingSteps = () => (
    <div className="p-4 h-[80vh] flex flex-col">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-mono text-purple-400">
            Create New Group
          </h1>
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
                  // Include V2 first-group and subsequent group steps
                  const stepOrder = [
                    "createTopic",
                    "arweave",
                    "sendIdentifier",
                    // V2 first-group steps
                    "createGroupsListTopic",
                    "sendToGroupsList",
                    "updateProfileWithGroupsTopic",
                    // V2 subsequent group step
                    "updateGroupsList",
                    // V1 legacy step
                    "updateProfile"
                  ];

                  const nextStep = stepOrder.find((stepName) => {
                    const status =
                      stepStatuses[stepName as keyof GroupCreationSteps];
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
                        case "createTopic":
                          console.log(
                            "Auto-progression: Starting topic creation..."
                          );
                          handleCreateTopic().catch((error) => {
                            console.error("Auto-topic creation error:", error);
                            disableAutoProgression("Topic creation error");
                          });
                          break;
                        case "arweave":
                          console.log(
                            "Auto-progression: Starting image upload..."
                          );
                          handleArweaveUpload().catch((error) => {
                            console.error("Auto-image upload error:", error);
                            disableAutoProgression("Image upload error");
                          });
                          break;
                        case "sendIdentifier":
                          console.log(
                            "Auto-progression: Sending group identifier..."
                          );
                          handleSendIdentifier().catch((error: unknown) => {
                            console.error("Auto-send identifier error:", error);
                            disableAutoProgression("Send identifier error");
                          });
                          break;
                        case "createGroupsListTopic":
                          console.log(
                            "Auto-progression: Creating Groups list topic..."
                          );
                          handleCreateGroupsListTopic().catch((error) => {
                            console.error("Auto-create Groups list topic error:", error);
                            disableAutoProgression("Create Groups list topic error");
                          });
                          break;
                        case "sendToGroupsList":
                          console.log(
                            "Auto-progression: Sending to Groups list..."
                          );
                          handleSendToGroupsList().catch((error) => {
                            console.error("Auto-send to Groups list error:", error);
                            disableAutoProgression("Send to Groups list error");
                          });
                          break;
                        case "updateProfileWithGroupsTopic":
                          console.log(
                            "Auto-progression: Updating profile with Groups topic..."
                          );
                          handleUpdateProfileWithGroupsTopic().catch((error) => {
                            console.error("Auto-update profile with Groups topic error:", error);
                            disableAutoProgression("Update profile with Groups topic error");
                          });
                          break;
                        case "updateGroupsList":
                          console.log(
                            "Auto-progression: Updating Groups list..."
                          );
                          handleUpdateGroupsList().catch((error) => {
                            console.error("Auto-update Groups list error:", error);
                            disableAutoProgression("Update Groups list error");
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
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${autoProgress ? "bg-purple-500" : "bg-slate-600"
                } ${autoProgressDisabledByError
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer"
                }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${autoProgress ? "translate-x-5" : "translate-x-0.5"
                  }`}
              />
            </button>
            <span
              className={`text-xs font-mono px-2 py-1 rounded ${autoProgress
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

      {/* Wallet Approvals Warning Banner */}
      <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <p className="text-sm text-amber-400 font-mono">
          ⚠️ This will require {walletApprovals} wallet approval{walletApprovals > 1 ? "s" : ""}.
          {isFirstGroup && (
            <span className="block mt-1 text-xs text-amber-300/70">
              (First group - includes creating your Groups list)
            </span>
          )}
        </p>
      </div>

      {/* Group Information Preview */}
      <div className="mb-4 p-3 bg-slate-800/80 backdrop-blur-md rounded-xl border border-purple-400/30 shadow-lg shadow-purple-400/10 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          {imagePreview && (
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-purple-400/30">
              {image ? (
                <img
                  src={imagePreview}
                  alt="Group"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full">
                  <ReadMediaFile cid={imagePreview} />
                </div>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-mono font-bold text-white truncate bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {name}
            </h2>
            <p className="text-xs text-purple-400 font-mono">
              Topic ID: {createdTopicId || "Creating..."}
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
        {/* Create Group Topic Step */}
        {renderStepButton(
          "createTopic",
          "Create Group Topic",
          handleCreateTopic
        )}

        {/* Upload Group Image Step */}
        {renderStepButton("arweave", "Upload Group Image", handleArweaveUpload)}

        {/* Send Group Identifier Step */}
        {renderStepButton(
          "sendIdentifier",
          "Send Group Identifier",
          handleSendIdentifier
        )}

        {/* V2 First Group Steps (when Groups list topic doesn't exist) */}
        {renderStepButton(
          "createGroupsListTopic",
          "Create Groups List Topic",
          handleCreateGroupsListTopic
        )}
        {renderStepButton(
          "sendToGroupsList",
          "Add Group to List",
          handleSendToGroupsList
        )}
        {renderStepButton(
          "updateProfileWithGroupsTopic",
          "Update Profile",
          handleUpdateProfileWithGroupsTopic
        )}

        {/* V2 Subsequent Group Step (when Groups list topic exists) */}
        {renderStepButton(
          "updateGroupsList",
          "Update Groups List",
          handleUpdateGroupsList
        )}

        {/* V1 Legacy Update Profile Step (backward compatibility) */}
        {renderStepButton(
          "updateProfile",
          "Update Profile (Legacy)",
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
   * Renders the edit form view for creating group information
   * Includes inputs for name, description, and group image
   */
  const renderEditForm = () => (
    <div className="flex flex-col max-h-[80vh] bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-purple-400/50 flex-shrink-0">
        <h3 className="text-2xl font-mono text-purple-400 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Create New Group
        </h3>
        <p className="text-sm text-white/60 mt-1 font-light">
          Create a new group for community discussions
        </p>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Group Image Section */}
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              {imagePreview ? (
                <>
                  {/* Image Preview */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-800/50 mb-3 ring-2 ring-purple-400/30">
                    {image ? (
                      <img
                        src={imagePreview}
                        alt="Group Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full">
                        <ReadMediaFile cid={imagePreview} />
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex gap-2 justify-center">
                    <label
                      htmlFor="imageUpload"
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-gradient-to-r from-purple-400 to-pink-500 hover:scale-110 text-white cursor-pointer
                        transition-all duration-200 shadow-lg shadow-purple-400/25"
                      title="Change Image"
                    >
                      <MdOutlinePermMedia className="text-sm" />
                    </label>
                    <button
                      onClick={clearImage}
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white
                        transition-all duration-200"
                      title="Remove Image"
                    >
                      <RiDeleteBinLine className="text-sm" />
                    </button>
                  </div>
                </>
              ) : (
                // Upload new image button
                <label
                  htmlFor="imageUpload"
                  className="flex flex-col items-center gap-2 p-4 cursor-pointer rounded-xl
                    border-2 border-dashed border-purple-400/50 hover:border-purple-400
                    transition-all duration-200 w-full max-w-[240px] hover:bg-purple-400/5"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-400/10 flex items-center justify-center">
                    <MdOutlinePermMedia className="text-2xl text-purple-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-white text-sm">
                      Add Group Image
                    </p>
                    <p className="text-xs text-white/50">Up to 100MB</p>
                  </div>
                </label>
              )}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              id="imageUpload"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageChange}
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
                  border-2 transition-all duration-200 outline-none ${name.trim()
                    ? "border-green-400/50 focus:border-green-400 shadow-lg shadow-green-400/10"
                    : "border-purple-400/50 focus:border-purple-400 shadow-lg shadow-purple-400/10"
                  }`}
                placeholder="Your group name"
                maxLength={nameMaxLength}
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-white/50 font-light">
                  Max {nameMaxLength} characters
                </span>
                <span className="text-xs text-white/50 font-mono">
                  {name.length}/{nameMaxLength}
                </span>
              </div>
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
                Group Description
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
                  maxLength={descriptionMaxLength}
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
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-white/50 font-light">
                  Max {descriptionMaxLength} characters
                </span>
                <span className="text-xs text-white/50 font-mono">
                  {description.length}/{descriptionMaxLength}
                </span>
              </div>
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
              onClick={handleStartCreation}
              disabled={!name.trim()}
              className={`px-8 py-2.5 font-semibold rounded-full transition-all
                duration-200 hover:shadow-lg active:scale-98 font-mono ${!name.trim()
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-400 to-pink-500 hover:scale-105 text-white shadow-lg shadow-purple-400/25"
                }`}
            >
              Create Group
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

      {/* V1 → V2 Migration Modal */}
      {profileData && (
        <MigrationModal
          isOpen={migration.showMigrationModal}
          onClose={() => migration.setShowMigrationModal(false)}
          profileData={profileData}
          profileTopicId={userProfileTopicId}
          onMigrationComplete={() => {
            // After migration completes, proceed with the group creation
            proceedWithGroupCreation();
          }}
        />
      )}
    </div>
  );
};

export default CreateNewGroup;
