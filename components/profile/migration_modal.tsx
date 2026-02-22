"use client";

/**
 * migration_modal.tsx
 * UI component for V1 → V2 profile migration.
 * Uses the same step-by-step UI pattern as create_new_profile.tsx
 * 
 * @module MigrationModal
 */

import React, { useEffect, useState, useRef } from "react";
import { RiCheckLine, RiRefreshLine, RiCloseLine, RiArrowUpLine } from "react-icons/ri";
import { ProfileData, hasArrayData } from "../hooks/use_get_profile";
import useProfileMigration, { 
  MigrationStep,
  StepStatus,
} from "../hooks/use_profile_migration";
import { useRefreshTrigger } from "../hooks/use_refresh_trigger";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileData: ProfileData;
  profileTopicId: string;
  onMigrationComplete?: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * MigrationModal Component
 * Displays migration progress with step-by-step UI
 * Follows the same UI patterns as create_new_profile.tsx
 */
const MigrationModal: React.FC<MigrationModalProps> = ({
  isOpen,
  onClose,
  profileData,
  profileTopicId,
  onMigrationComplete,
}) => {
  const { triggerRefresh } = useRefreshTrigger();
  const [hasStarted, setHasStarted] = useState(false);
  const autoProgressRef = useRef(false);
  const [countdown] = useState(0);

  // Use the migration hook
  const {
    needsMigration,
    stepStatuses,
    totalSteps,
    completedCount,
    autoProgress,
    setAutoProgress,
    autoProgressDisabledByError,
    startMigration,
    retryStep,
    resetMigration,
  } = useProfileMigration(profileData, profileTopicId, () => {
    // Called when migration completes
    triggerRefresh();
    if (onMigrationComplete) {
      onMigrationComplete();
    }
  });

  // Sync autoProgressRef with autoProgress
  useEffect(() => {
    autoProgressRef.current = autoProgress;
  }, [autoProgress]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setHasStarted(false);
      resetMigration();
    }
  }, [isOpen, resetMigration]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // If profile is already V2, show success message
  if (!needsMigration) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="max-w-md w-full mx-auto bg-slate-900/80 backdrop-blur-md rounded-2xl border border-green-400/50 text-white p-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <RiCheckLine className="text-3xl text-green-400" />
            </div>
            <h3 className="text-xl font-mono text-green-400 mb-2">
              Profile Already Upgraded!
            </h3>
            <p className="text-white/80 mb-6 font-light">
              Your profile is already using the V2 format. No migration needed.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-green-500 hover:bg-green-400 text-white transition-colors duration-200 font-mono"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Gets step label for display
   */
  const getStepLabel = (step: MigrationStep): string => {
    switch (step) {
      case "createChannelsTopic":
        return "Create Channels List Topic";
      case "createGroupsTopic":
        return "Create Groups List Topic";
      case "createFollowingChannelsTopic":
        return "Create Following Channels Topic";
      case "createFollowingGroupsTopic":
        return "Create Following Groups Topic";
      case "updateProfile":
        return "Update Profile to V2";
      default:
        return step;
    }
  };

  /**
   * Gets the handler for a step
   */
  const getStepHandler = (step: MigrationStep) => {
    return () => retryStep(step);
  };

  /**
   * Renders a step with status indicators and action button
   * Same pattern as create_new_profile.tsx
   */
  const renderStepButton = (
    step: MigrationStep,
    label: string,
    status: StepStatus | undefined
  ) => {
    if (!status) return null;

    const handler = getStepHandler(step);

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
          {status.status === "success" && countdown > 0 && autoProgressRef.current && (
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
            ) : autoProgressRef.current && !status.disabled ? (
              <>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-1.5" />
                <span className="text-sm">Auto</span>
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
   * Handles starting the migration
   */
  const handleStartMigration = async () => {
    setHasStarted(true);
    await startMigration();
  };

  /**
   * Renders the pre-migration info screen
   */
  const renderPreMigrationInfo = () => (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
          <RiArrowUpLine className="text-2xl text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-mono text-amber-400">
            Profile Upgrade Required
          </h2>
          <p className="text-sm text-white/60 font-light">
            One-time upgrade to V2 format
          </p>
        </div>
      </div>

      {/* Explanation */}
      <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-cyan-400/20">
        <p className="text-white/80 font-light mb-4">
          Your profile needs to be upgraded to the new V2 format before you can 
          continue. This is a one-time process that will:
        </p>
        <ul className="space-y-2 text-sm text-white/70 font-light">
          {hasArrayData(profileData.Channels) && (
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Move your {(profileData.Channels as unknown[]).length} channel(s) to a dedicated topic
            </li>
          )}
          {hasArrayData(profileData.Groups) && (
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Move your {(profileData.Groups as unknown[]).length} group(s) to a dedicated topic
            </li>
          )}
          {hasArrayData(profileData.FollowingChannels) && (
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Move your {(profileData.FollowingChannels as unknown[]).length} followed channel(s) to a dedicated topic
            </li>
          )}
          {hasArrayData(profileData.FollowingGroups) && (
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Move your {(profileData.FollowingGroups as unknown[]).length} followed group(s) to a dedicated topic
            </li>
          )}
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Update your profile to V2 format
          </li>
        </ul>
      </div>

      {/* Transaction count warning */}
      <div className="mb-6 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
        <p className="text-sm text-amber-400 font-mono">
          ⚠️ This will require up to {totalSteps} wallet approval{totalSteps > 1 ? "s" : ""}.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleStartMigration}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 
            text-white rounded-lg transition-all duration-200 font-mono font-medium 
            shadow-lg shadow-cyan-400/25"
        >
          Start Upgrade
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg 
            transition-colors duration-200 font-mono"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  /**
   * Renders the migration progress view
   */
  const renderMigrationProgress = () => (
    <div className="p-4 h-[70vh] flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-mono text-cyan-400">
            Upgrading Your Profile
          </h1>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700/50 text-white/60 hover:text-white transition-colors"
          >
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
          <div 
            className="h-full bg-gradient-to-r from-cyan-400 to-green-400 transition-all duration-500"
            style={{ width: `${(completedCount / totalSteps) * 100}%` }}
          />
        </div>
        <p className="text-sm text-white/60 font-mono">
          Step {completedCount} of {totalSteps}
        </p>

        {/* Auto-progress toggle */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-white/60 font-mono">Auto-progress</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newValue = !autoProgress;
                setAutoProgress(newValue);
                
                // If enabling auto-progress, start from first available step
                if (newValue) {
                  const stepOrder: MigrationStep[] = [
                    "createChannelsTopic",
                    "createGroupsTopic",
                    "createFollowingChannelsTopic",
                    "createFollowingGroupsTopic",
                    "updateProfile",
                  ];
                  
                  const nextStep = stepOrder.find(step => {
                    const status = stepStatuses[step];
                    return status && status.status === "idle" && !status.disabled;
                  });
                  
                  if (nextStep) {
                    setTimeout(() => retryStep(nextStep), 500);
                  }
                }
              }}
              disabled={autoProgressDisabledByError}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                autoProgress ? "bg-cyan-500" : "bg-slate-600"
              } ${autoProgressDisabledByError ? "opacity-50 cursor-not-allowed" : ""}`}
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
            {autoProgressDisabledByError && (
              <button
                onClick={() => {
                  setAutoProgress(true);
                  // Find first failed step and retry
                  const stepOrder: MigrationStep[] = [
                    "createChannelsTopic",
                    "createGroupsTopic",
                    "createFollowingChannelsTopic",
                    "createFollowingGroupsTopic",
                    "updateProfile",
                  ];
                  
                  const failedStep = stepOrder.find(step => {
                    const status = stepStatuses[step];
                    return status && status.status === "error" && !status.disabled;
                  });
                  
                  if (failedStep) {
                    setTimeout(() => retryStep(failedStep), 500);
                  }
                }}
                className="text-xs font-mono px-2 py-1 rounded bg-amber-500/20 text-amber-400 
                  border border-amber-500/30 hover:bg-amber-500/30 transition-colors duration-200"
              >
                Retry
              </button>
            )}
          </div>
        </div>
        {autoProgressDisabledByError && (
          <div className="text-xs text-amber-400/80 font-mono mt-1">
            Auto-progression disabled due to error. Click &quot;Retry&quot; to restart.
          </div>
        )}
      </div>

      {/* Profile preview */}
      <div className="mb-4 p-3 bg-slate-800/80 backdrop-blur-md rounded-xl border border-cyan-400/30 shadow-lg shadow-cyan-400/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          {profileData.Picture && (
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-cyan-400/30">
              <img
                src={profileData.Picture.startsWith("ar://") 
                  ? `https://arweave.net/${profileData.Picture.replace("ar://", "")}`
                  : profileData.Picture}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-mono font-bold text-white truncate bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {profileData.Name || "Your Profile"}
            </h2>
            <p className="text-xs text-white/60 font-mono">
              Upgrading to V2...
            </p>
          </div>
        </div>
      </div>

      {/* Processing Steps - Scrollable */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {stepStatuses.createChannelsTopic && 
          renderStepButton(
            "createChannelsTopic",
            getStepLabel("createChannelsTopic"),
            stepStatuses.createChannelsTopic
          )}
        
        {stepStatuses.createGroupsTopic && 
          renderStepButton(
            "createGroupsTopic",
            getStepLabel("createGroupsTopic"),
            stepStatuses.createGroupsTopic
          )}
        
        {stepStatuses.createFollowingChannelsTopic && 
          renderStepButton(
            "createFollowingChannelsTopic",
            getStepLabel("createFollowingChannelsTopic"),
            stepStatuses.createFollowingChannelsTopic
          )}
        
        {stepStatuses.createFollowingGroupsTopic && 
          renderStepButton(
            "createFollowingGroupsTopic",
            getStepLabel("createFollowingGroupsTopic"),
            stepStatuses.createFollowingGroupsTopic
          )}
        
        {renderStepButton(
          "updateProfile",
          getStepLabel("updateProfile"),
          stepStatuses.updateProfile
        )}

        {/* Cancel button */}
        <button
          onClick={onClose}
          className="w-full bg-slate-800 hover:bg-red-500/20 text-white py-2 mt-3 px-4 
            rounded-full border border-cyan-400/50 hover:border-red-400/50 
            transition-all duration-200 font-mono"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="max-w-md w-full mx-auto bg-slate-900/90 backdrop-blur-md sm:rounded-2xl border-y sm:border border-cyan-400/50 text-white shadow-2xl shadow-cyan-400/20">
        {hasStarted ? renderMigrationProgress() : renderPreMigrationInfo()}
      </div>
    </div>
  );
};

export default MigrationModal;
