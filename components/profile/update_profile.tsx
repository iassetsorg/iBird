/**
 * UpdateProfile is a React component that provides a form interface for users to update their profile information.
 * It handles:
 * - Profile picture upload to Arweave
 * - Basic profile information (name, bio, website)
 * - Two-step update process (upload picture, then update profile)
 * - Real-time status updates and error handling
 * - Enhanced error handling patterns following Next.js 15 best practices
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
import useGetProfile, { isV2Profile } from "../hooks/use_get_profile";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";

// Wallet Integration Imports
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";

// Component Imports
import EmojiPickerPopup from "../common/EmojiPickerPopup";
import ImageCropModal from "../common/ImageCropModal";
import ReadMediaFile from "../media/read_media_file";
import MigrationModal from "./migration_modal";
// ============================================================================
// TYPE DEFINITIONS & INTERFACES
// ============================================================================

/**
 * StepStatus Interface
 * Tracks the state of each step in the profile update process
 */
interface StepStatus {
  status: "idle" | "loading" | "success" | "error";
  disabled: boolean;
}

/**
 * ProfileUpdateSteps Interface
 * Manages the status of all steps in the profile update process
 */
interface ProfileUpdateSteps {
  arweave?: StepStatus;
  uploadBanner?: StepStatus;
  updateProfile: StepStatus;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const UpdateProfile = ({ onClose }: { onClose: () => void }) => {
  // ========================================================================
  // HOOKS & EXTERNAL DEPENDENCIES
  // ========================================================================

  const { data: accountId } = useAccountId();
  const { send } = useSendMessage();
  const { profileData } = useGetProfile(accountId || "");
  const userProfileTopicId = profileData ? profileData.ProfileTopic : "";
  const { uploadToArweave } = useUploadToArweave();
  const { triggerRefresh } = useRefreshTrigger();

  // V2 Migration - state for migration modal
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // ========================================================================
  // COMPONENT STATE MANAGEMENT
  // ========================================================================

  // Form input states
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [picture, setPicture] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploadedMediaId, setUploadedMediaId] = useState<string | null>(null);
  const [uploadedBannerMediaId, setUploadedBannerMediaId] = useState<
    string | null
  >(null);

  // UI control states
  const [isEditing, setIsEditing] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [showBannerCropper, setShowBannerCropper] = useState(false);
  const [tempBannerImage, setTempBannerImage] = useState<string | null>(null);

  // Auto-progression states
  const [autoProgress, setAutoProgress] = useState(false);
  const autoProgressRef = useRef(false);
  const [countdown, setCountdown] = useState(0);
  const [autoProgressDisabledByError, setAutoProgressDisabledByError] =
    useState(false);

  // Process tracking states
  const [stepStatuses, setStepStatuses] = useState<ProfileUpdateSteps>({
    arweave: picture ? { status: "idle", disabled: false } : undefined,
    uploadBanner: banner ? { status: "idle", disabled: false } : undefined,
    updateProfile: { status: "idle", disabled: true },
  });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const maxSize = 100 * 1024 * 1024; // 100 MB

  // ========================================================================
  // INITIALIZATION AND DATA LOADING
  // ========================================================================

  /**
   * Initializes form data with existing profile information when available
   * Populates name, bio, website, and profile picture from profileData
   */
  useEffect(() => {
    if (accountId && profileData) {
      setName(profileData.Name || "");
      setBio(profileData.Bio || "");
      setWebsite(profileData.Website || "");
      if (profileData.Picture) {
        setPicturePreview(profileData.Picture);
      }
      if (profileData.Banner) {
        setBannerPreview(profileData.Banner);
      }
    }
  }, [accountId, profileData]);

  // ========================================================================
  // AUTO-PROGRESSION STATE SYNCHRONIZATION
  // ========================================================================

  // Monitor picture upload completion for auto-progression to banner
  useEffect(() => {
    if (
      autoProgressRef.current &&
      uploadedMediaId &&
      uploadedMediaId.trim() !== ""
    ) {
      // Check if we should auto-progress to banner upload step
      const bannerStep = stepStatuses.uploadBanner;
      if (bannerStep && bannerStep.status === "idle" && !bannerStep.disabled) {
        console.log(
          "Picture upload complete, auto-progressing to banner upload..."
        );
        setTimeout(() => {
          handleBannerUpload().catch((error) => {
            console.error("Auto-banner upload error:", error);
            disableAutoProgression("Banner upload error");
          });
        }, 1000);
      }
    }
  }, [
    uploadedMediaId,
    stepStatuses.uploadBanner?.status,
    autoProgressRef.current,
  ]);

  // Monitor banner upload completion for auto-progression to profile update
  useEffect(() => {
    if (
      autoProgressRef.current &&
      uploadedBannerMediaId &&
      uploadedBannerMediaId.trim() !== ""
    ) {
      // Check if we should auto-progress to profile update step
      const updateStep = stepStatuses.updateProfile;
      if (updateStep && updateStep.status === "idle" && !updateStep.disabled) {
        console.log(
          "Banner upload complete, auto-progressing to profile update..."
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
    uploadedBannerMediaId,
    stepStatuses.updateProfile?.status,
    autoProgressRef.current,
  ]);

  // Monitor for final profile update when both uploads are complete
  useEffect(() => {
    const arweaveStep = stepStatuses.arweave;
    const bannerStep = stepStatuses.uploadBanner;
    const updateStep = stepStatuses.updateProfile;

    // Check if both uploads are complete and enable profile update
    const arweaveComplete = !arweaveStep || arweaveStep.status === "success";
    const bannerComplete = !bannerStep || bannerStep.status === "success";

    if (
      arweaveComplete &&
      bannerComplete &&
      updateStep &&
      updateStep.status === "idle" &&
      updateStep.disabled
    ) {
      console.log("Both uploads complete, enabling profile update step...");
      setStepStatuses((prev) => ({
        ...prev,
        updateProfile: { status: "idle" as const, disabled: false },
      }));
    }
  }, [
    stepStatuses.arweave?.status,
    stepStatuses.uploadBanner?.status,
    stepStatuses.updateProfile?.disabled,
  ]);

  // Monitor for auto-progression to final profile update
  useEffect(() => {
    if (autoProgressRef.current) {
      const arweaveStep = stepStatuses.arweave;
      const bannerStep = stepStatuses.uploadBanner;
      const updateStep = stepStatuses.updateProfile;

      // Check if both uploads are complete and profile update is ready
      const arweaveComplete = !arweaveStep || arweaveStep.status === "success";
      const bannerComplete = !bannerStep || bannerStep.status === "success";

      if (
        arweaveComplete &&
        bannerComplete &&
        updateStep &&
        updateStep.status === "idle" &&
        !updateStep.disabled
      ) {
        console.log(
          "All uploads complete, auto-progressing to profile update..."
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
    stepStatuses.arweave?.status,
    stepStatuses.uploadBanner?.status,
    stepStatuses.updateProfile?.status,
    stepStatuses.updateProfile?.disabled,
    autoProgressRef.current,
  ]);

  // ========================================================================
  // IMAGE HANDLING FUNCTIONS
  // ========================================================================

  /**
   * Handles emoji selection from the emoji picker
   * Adds the selected emoji to the bio text
   */
  const onEmojiClick = (emojiData: { emoji: string }) => {
    setBio((prevBio) => prevBio + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  /**
   * Clears the current profile picture selection and resets related states
   * Also removes the file from the file input and updates step statuses
   */
  const clearPicture = () => {
    setPicture(null);
    setPicturePreview(null);
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
   * Clears the current banner selection and resets related states
   */
  const clearBanner = () => {
    setBanner(null);
    setBannerPreview(null);
    setTempBannerImage(null);
    if (bannerInputRef.current) {
      bannerInputRef.current.value = "";
    }
    setStepStatuses((prev) => {
      const newStatuses = { ...prev };
      delete newStatuses.uploadBanner;
      return newStatuses;
    });
  };

  /**
   * Handles file selection for profile picture
   * Validates file size, creates preview, and updates step statuses
   */
  const handlePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
   * Handles file selection for banner image
   * Validates file size, creates preview, and updates step statuses
   */
  const handleBannerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) {
      if (bannerInputRef.current) {
        bannerInputRef.current.value = "";
      }
      return;
    }

    if (file.size > maxSize) {
      toast.error("The file exceeds 100MB.");
      if (bannerInputRef.current) {
        bannerInputRef.current.value = "";
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setTempBannerImage(reader.result as string);
      setShowBannerCropper(true);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Handles completion of image cropping using the ImageCropModal
   * Processes the cropped image and updates state
   */
  const handleImageCropComplete = (croppedFile: File) => {
    setPicture(croppedFile);
    setPicturePreview(URL.createObjectURL(croppedFile));
    setShowCropper(false);
    setTempImage(null);
  };

  /**
   * Handles completion of banner cropping
   * Processes the cropped banner and updates state
   */
  const handleBannerCropComplete = (croppedFile: File) => {
    setBanner(croppedFile);
    setBannerPreview(URL.createObjectURL(croppedFile));
    setShowBannerCropper(false);
    setTempBannerImage(null);
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
    const stepOrder = ["arweave", "uploadBanner", "updateProfile"];

    // First, look for failed steps to retry
    const failedStep = stepOrder.find((stepName) => {
      const status = stepStatuses[stepName as keyof ProfileUpdateSteps];
      return status && status.status === "error" && !status.disabled;
    });

    if (failedStep) {
      console.log("Found failed step to retry:", failedStep);
      toast.info(`Auto-progression reset. Retrying ${failedStep}...`);

      // Start the failed step after a short delay
      setTimeout(() => {
        switch (failedStep) {
          case "arweave":
            console.log("Retrying picture upload...");
            handleArweaveUpload().catch((error) => {
              console.error("Auto-retry picture upload error:", error);
              disableAutoProgression("Picture upload retry error");
            });
            break;
          case "uploadBanner":
            console.log("Retrying banner upload...");
            handleBannerUpload().catch((error) => {
              console.error("Auto-retry banner upload error:", error);
              disableAutoProgression("Banner upload retry error");
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
      const status = stepStatuses[stepName as keyof ProfileUpdateSteps];
      return status && status.status === "idle" && !status.disabled;
    });

    if (idleStep) {
      console.log("Found idle step to start:", idleStep);
      toast.success(`Auto-progression reset. Starting ${idleStep}...`);

      setTimeout(() => {
        switch (idleStep) {
          case "arweave":
            console.log("Starting picture upload...");
            handleArweaveUpload().catch((error) => {
              console.error("Auto-start picture upload error:", error);
              disableAutoProgression("Picture upload start error");
            });
            break;
          case "uploadBanner":
            console.log("Starting banner upload...");
            handleBannerUpload().catch((error) => {
              console.error("Auto-start banner upload error:", error);
              disableAutoProgression("Banner upload start error");
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
  // PROFILE UPDATE WORKFLOW FUNCTIONS
  // ========================================================================

  /**
   * Proceeds with the actual profile update after V1 migration check passes
   */
  const proceedWithProfileUpdate = () => {
    setIsEditing(false);

    // Set up steps based on what needs to be uploaded
    const newStepStatuses: ProfileUpdateSteps = {
      updateProfile: { status: "idle", disabled: true },
    };

    let hasUploads = false;

    if (picture) {
      newStepStatuses.arweave = { status: "idle", disabled: false };
      hasUploads = true;
    }

    if (banner) {
      newStepStatuses.uploadBanner = { status: "idle", disabled: false };
      hasUploads = true;
    }

    // If no uploads needed, enable profile update directly
    if (!hasUploads) {
      newStepStatuses.updateProfile = { status: "idle", disabled: false };
    }

    setStepStatuses(newStepStatuses);
  };

  /**
   * Initiates the profile update process
   * Validates required fields, checks for V1 migration, and sets up the appropriate update steps
   */
  const handleStartUpdate = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (picture && picture.size > maxSize) {
      toast.error("The profile picture file exceeds 100MB.");
      return;
    }

    if (banner && banner.size > maxSize) {
      toast.error("The banner file exceeds 100MB.");
      return;
    }

    // V2 Migration check: V1 users must migrate before updating profile
    if (profileData && !isV2Profile(profileData)) {
      console.log("V1 profile detected, showing migration modal before update");
      setPendingAction(() => proceedWithProfileUpdate);
      setShowMigrationModal(true);
      return;
    }

    // V2 user - proceed directly
    proceedWithProfileUpdate();
  };

  /**
   * Handles the upload of profile picture to Arweave
   * Updates step statuses during the process and handles success/error states
   */
  const handleArweaveUpload = async () => {
    if (!picture) return;

    setStepStatuses((prev) => ({
      ...prev,
      arweave: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        const mediaId = await uploadToArweave(picture);
        return mediaId;
      },
      "Picture Upload",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          arweave: { status: "error", disabled: false },
        }));

        // Stop auto-progression on error
        if (autoProgressRef.current) {
          console.log("Picture upload failed, stopping auto-progression");
          disableAutoProgression("Picture upload error");
        }
      }
    );

    if (result) {
      setUploadedMediaId(`${result}`);
      toast.success("Profile picture uploaded to Arweave successfully.");

      setStepStatuses((prev) => ({
        ...prev,
        arweave: { status: "success" as const, disabled: true },
      }));

      // Auto-progression will be handled by useEffect hook monitoring uploadedMediaId
      console.log(
        "Picture upload complete, auto-progression will be handled by useEffect"
      );
    }
  };

  /**
   * Handles the upload of banner to Arweave
   * Updates step statuses during the process and handles success/error states
   */
  const handleBannerUpload = async () => {
    if (!banner) return;

    setStepStatuses((prev) => ({
      ...prev,
      uploadBanner: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        const mediaId = await uploadToArweave(banner);
        return mediaId;
      },
      "Banner Upload",
      () => {
        setStepStatuses((prev) => ({
          ...prev,
          uploadBanner: { status: "error", disabled: false },
        }));

        // Stop auto-progression on error
        if (autoProgressRef.current) {
          console.log("Banner upload failed, stopping auto-progression");
          disableAutoProgression("Banner upload error");
        }
      }
    );

    if (result) {
      setUploadedBannerMediaId(`${result}`);
      toast.success("Banner uploaded to Arweave successfully.");

      setStepStatuses((prev) => ({
        ...prev,
        uploadBanner: { status: "success" as const, disabled: true },
      }));

      // Auto-progression will be handled by useEffect hook monitoring uploadedBannerMediaId
      console.log(
        "Banner upload complete, auto-progression will be handled by useEffect"
      );
    }
  };

  /**
   * Performs the final profile update by sending the update message
   * Updates step statuses and handles success/error states using enhanced validation
   * V2: Preserves topic IDs instead of arrays for V2 profiles
   * @returns {Promise<void>}
   */
  const handleUpdateProfile = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      updateProfile: { status: "loading", disabled: true },
    }));

    const result = await safeAsyncWrapper(
      async () => {
        // V2: Preserve topic IDs (strings) for V2 profiles, or empty arrays for V1
        // For V2 profiles, Channels/Groups/etc are topic ID strings
        // For V1 profiles, they are arrays - but we preserve whatever the current format is
        const updateMessage = {
          Type: "Profile",
          Name: name,
          Bio: bio,
          Website: website,
          // Preserve existing values - for V2 these are topic IDs (strings), for V1 these are arrays
          Channels: profileData?.Channels ?? "",
          Groups: profileData?.Groups ?? "",
          FollowingChannels: profileData?.FollowingChannels ?? "",
          FollowingGroups: profileData?.FollowingGroups ?? "",
          ExplorerMessages: profileData?.ExplorerMessages || "",
          BillboardAds: profileData?.BillboardAds || "",
          PrivateMessages: profileData?.PrivateMessages || "", // V2 field
          Picture: uploadedMediaId ? `${uploadedMediaId}` : picturePreview,
          Banner: uploadedBannerMediaId
            ? `${uploadedBannerMediaId}`
            : bannerPreview || profileData?.Banner || null,
          // Preserve existing profile version
          ProfileVersion: profileData?.ProfileVersion ?? "2",
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
      toast.success("Profile Updated Successfully");
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

      toast.warn("Profile update cancelled. You can retry manually.");
      return;
    }
  };

  /**
   * Renders a step with status indicators and action button
   * Used in the processing steps view
   */
  const renderStepButton = (
    step: keyof ProfileUpdateSteps,
    label: string,
    handler: () => void
  ) => {
    const status = stepStatuses[step];
    if (!status) return null;

    return (
      <div
        className="flex justify-between items-center p-4 rounded-lg transition-all duration-200 border border-cyan-400/20 shadow-lg shadow-cyan-400/5 bg-slate-800/20"
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
                  ? "bg-cyan-400 animate-pulse"
                  : status.disabled
                  ? "bg-gray-500"
                  : "bg-cyan-400"
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
            <p className="text-sm text-cyan-400/80 font-light animate-pulse">
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
                          : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-cyan-400/25"
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
          <h1 className="text-2xl font-mono text-cyan-400">
            Update Your Profile
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
                  const stepOrder = [
                    "arweave",
                    "uploadBanner",
                    "updateProfile",
                  ];

                  const nextStep = stepOrder.find((stepName) => {
                    const status =
                      stepStatuses[stepName as keyof ProfileUpdateSteps];
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
                            "Auto-progression: Starting picture upload..."
                          );
                          handleArweaveUpload().catch((error) => {
                            console.error("Auto-upload error:", error);
                            disableAutoProgression("Upload error");
                          });
                          break;
                        case "uploadBanner":
                          console.log(
                            "Auto-progression: Starting banner upload..."
                          );
                          handleBannerUpload().catch((error) => {
                            console.error("Auto-banner upload error:", error);
                            disableAutoProgression("Banner upload error");
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
                autoProgress ? "bg-cyan-500" : "bg-slate-600"
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
            <span
              className={`text-xs font-mono px-2 py-1 rounded ${
                autoProgress
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
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

      {/* Profile Information Preview - Compact */}
      <div className="mb-4 p-3 bg-slate-800/80 backdrop-blur-md rounded-xl border border-cyan-400/30 shadow-lg shadow-cyan-400/10 flex-shrink-0">
        {/* Banner Preview */}
        {bannerPreview && (
          <div className="w-full h-24 rounded-lg overflow-hidden bg-slate-800/50 mb-3 ring-1 ring-cyan-400/20">
            {banner ? (
              <img
                src={bannerPreview}
                alt="Banner Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full">
                <ReadMediaFile cid={bannerPreview} />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 mb-2">
          {picturePreview && (
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-cyan-400/30">
              {picture ? (
                <img
                  src={picturePreview}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full">
                  <ReadMediaFile cid={picturePreview} />
                </div>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-mono font-bold text-white truncate bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {name}
            </h2>
          </div>
        </div>
        {bio && (
          <p className="text-white/80 break-words text-sm leading-relaxed font-light line-clamp-2">
            {bio}
          </p>
        )}
        {website && (
          <a
            href={website.startsWith("http") ? website : `${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:text-cyan-300 text-xs mt-1 block transition-colors duration-200 font-light truncate"
          >
            {website}
          </a>
        )}
      </div>

      {/* Processing Steps - Scrollable */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {/* Upload Profile Picture Step */}
        {renderStepButton(
          "arweave",
          "Upload Profile Picture",
          handleArweaveUpload
        )}

        {/* Upload Banner Step */}
        {renderStepButton(
          "uploadBanner",
          "Upload Banner Image",
          handleBannerUpload
        )}

        {/* Update Profile Step */}
        {renderStepButton(
          "updateProfile",
          "Update Profile",
          handleUpdateProfile
        )}

        {/* Cancel Button */}
        <button
          onClick={onClose}
          className="w-full bg-slate-800 hover:bg-red-500/20 text-white py-2 mt-3 px-4 rounded-full border border-cyan-400/50 hover:border-red-400/50 transition-all duration-200 font-mono"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  /**
   * Renders the edit form view for updating profile information
   * Includes inputs for name, bio, website, and profile picture
   */
  const renderEditForm = () => (
    <div className="flex flex-col max-h-[80vh] bg-slate-900/80 backdrop-blur-md rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-cyan-400/50 flex-shrink-0">
        <h3 className="text-2xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          Update Profile
        </h3>
        <p className="text-sm text-white/60 mt-1 font-light">
          Update your profile information
        </p>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Banner Section - Full functionality */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-white/80 mb-1.5 font-mono">
              Banner Image
            </label>
            <div className="flex flex-col items-center">
              {bannerPreview ? (
                <>
                  {/* Banner Preview - Twitter-like 3:1 aspect ratio */}
                  <div className="w-full max-w-md h-32 rounded-xl overflow-hidden bg-slate-800/50 mb-3 ring-2 ring-cyan-400/30">
                    {banner ? (
                      <img
                        src={bannerPreview}
                        alt="Banner Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full">
                        <ReadMediaFile cid={bannerPreview} />
                      </div>
                    )}
                  </div>

                  {/* Banner Controls */}
                  <div className="flex gap-2 justify-center">
                    <label
                      htmlFor="bannerUpload"
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-110 text-white cursor-pointer
                        transition-all duration-200 shadow-lg shadow-cyan-400/25"
                      title="Change Banner"
                    >
                      <MdOutlinePermMedia className="text-sm" />
                    </label>
                    <button
                      onClick={clearBanner}
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white
                        transition-all duration-200"
                      title="Remove Banner"
                    >
                      <RiDeleteBinLine className="text-sm" />
                    </button>
                  </div>
                </>
              ) : (
                // Upload new banner button
                <label
                  htmlFor="bannerUpload"
                  className="flex flex-col items-center gap-2 p-4 cursor-pointer rounded-xl
                    border-2 border-dashed border-cyan-400/50 hover:border-cyan-400
                    transition-all duration-200 w-full hover:bg-cyan-400/5"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-400/10 flex items-center justify-center">
                    <MdOutlinePermMedia className="text-2xl text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-white text-sm">
                      Add Banner Image
                    </p>
                    <p className="text-xs text-white/50">
                      3:1 ratio recommended (like Twitter), up to 100MB
                    </p>
                  </div>
                </label>
              )}
            </div>

            {/* Hidden banner input */}
            <input
              type="file"
              id="bannerUpload"
              ref={bannerInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleBannerChange}
            />
          </div>

          {/* Profile Picture Section */}
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              {picturePreview ? (
                <>
                  {/* Image Preview - Smaller and more compact */}
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-800/50 mb-3 ring-2 ring-cyan-400/30">
                    {picture ? (
                      <img
                        src={picturePreview}
                        alt="Profile Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full">
                        <ReadMediaFile cid={picturePreview} />
                      </div>
                    )}
                  </div>

                  {/* Controls - More compact */}
                  <div className="flex gap-2 justify-center">
                    <label
                      htmlFor="pictureUpload"
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-110 text-white cursor-pointer
                        transition-all duration-200 shadow-lg shadow-cyan-400/25"
                      title="Change Picture"
                    >
                      <MdOutlinePermMedia className="text-sm" />
                    </label>
                    <button
                      onClick={clearPicture}
                      className="w-8 h-8 flex items-center justify-center rounded-full
                        bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white
                        transition-all duration-200"
                      title="Remove Picture"
                    >
                      <RiDeleteBinLine className="text-sm" />
                    </button>
                  </div>
                </>
              ) : (
                // Upload new picture button - More compact
                <label
                  htmlFor="pictureUpload"
                  className="flex flex-col items-center gap-2 p-4 cursor-pointer rounded-xl
                    border-2 border-dashed border-cyan-400/50 hover:border-cyan-400
                    transition-all duration-200 w-full max-w-[240px] hover:bg-cyan-400/5"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-400/10 flex items-center justify-center">
                    <MdOutlinePermMedia className="text-2xl text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-white text-sm">
                      Add Profile Picture
                    </p>
                    <p className="text-xs text-white/50">Up to 100MB</p>
                  </div>
                </label>
              )}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              id="pictureUpload"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handlePictureChange}
            />
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5 font-mono">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-white font-light
                  border-2 transition-all duration-200 outline-none ${
                    name.trim()
                      ? "border-green-400/50 focus:border-green-400 shadow-lg shadow-green-400/10"
                      : "border-cyan-400/50 focus:border-cyan-400 shadow-lg shadow-cyan-400/10"
                  }`}
                placeholder="Your display name"
                maxLength={50}
              />
              {name.trim() && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1 font-light">
                  <RiCheckLine className="text-sm" />
                  Name looks good!
                </p>
              )}
            </div>

            {/* Bio Input - Updated with emoji picker */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5 font-mono">
                Bio
              </label>
              <div className="relative">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-white font-light
                    border-2 border-cyan-400/50 focus:border-cyan-400 transition-all
                    duration-200 outline-none resize-none min-h-[100px] shadow-lg shadow-cyan-400/10"
                  placeholder="About yourself"
                  rows={4}
                  maxLength={160}
                />
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="absolute right-2 bottom-2 p-2 rounded-full
                    hover:bg-cyan-400/10 text-white/60 hover:text-cyan-400
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
            </div>

            {/* Website Input */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1.5 font-mono">
                Website
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 backdrop-blur-sm text-white font-light
                  border-2 border-cyan-400/50 focus:border-cyan-400 transition-all
                  duration-200 outline-none shadow-lg shadow-cyan-400/10"
                placeholder="apple.com"
                maxLength={100}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="border-t border-cyan-400/50 bg-slate-900/95 backdrop-blur-sm">
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
              disabled={!name.trim()}
              className={`px-8 py-2.5 font-semibold rounded-full transition-all
                duration-200 hover:shadow-lg active:scale-98 font-mono ${
                  !name.trim()
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-lg shadow-cyan-400/25"
                }`}
            >
              Update Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-md w-full mx-auto bg-slate-900/80 backdrop-blur-md rounded-2xl border border-cyan-400/50 text-white">
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

      {/* Banner Cropper Modal using common Modal component */}
      <ImageCropModal
        isOpen={showBannerCropper}
        onClose={() => {
          setShowBannerCropper(false);
          setTempBannerImage(null);
          if (bannerInputRef.current) {
            bannerInputRef.current.value = "";
          }
        }}
        tempImage={tempBannerImage || ""}
        onCropComplete={handleBannerCropComplete}
        aspectRatio={3}
        cropShape="rect"
        title="Crop Banner Image"
        description="Drag to move • Scroll to zoom • Twitter-like 3:1 ratio for optimal banner display"
      />

      {/* V2 Migration Modal - shown when V1 user tries to update profile */}
      {profileData && (
        <MigrationModal
          isOpen={showMigrationModal}
          onClose={() => {
            setShowMigrationModal(false);
            setPendingAction(null);
          }}
          profileData={profileData}
          profileTopicId={userProfileTopicId}
          onMigrationComplete={() => {
            setShowMigrationModal(false);
            // Execute the pending action after migration
            if (pendingAction) {
              pendingAction();
              setPendingAction(null);
            }
          }}
        />
      )}
    </div>
  );
};

export default UpdateProfile;
