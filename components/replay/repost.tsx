import { useState } from "react";
import useSendMessage from "../hooks/use_send_message";
import { useWalletContext } from "../wallet/WalletContext";
import ConnectModal from "../wallet/ConnectModal";
import { BiRepost } from "react-icons/bi";
import { toast } from "react-toastify";
import { RiCheckLine, RiRefreshLine } from "react-icons/ri";
import useGetProfile from "../hooks/use_get_profile";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";
import eventService from "../services/event_service";
import Modal from "../common/modal";

const explorerTopic = process.env.NEXT_PUBLIC_EXPLORER_TOPIC || "";

interface RepostProps {
  contentType: string;
  source: string;
}

interface StepStatus {
  status: "idle" | "loading" | "success" | "error";
  disabled: boolean;
}

/**
 * Interface for transaction receipt
 */
interface TransactionReceipt {
  result: {
    toString(): string;
  };
}

interface StepStatuses {
  explorer: StepStatus;
  profile: StepStatus;
}

export default function Repost({ contentType, source }: RepostProps) {
  const { send } = useSendMessage();
  const { isConnected } = useWalletContext();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isRepostModalOpen, setIsRepostModalOpen] = useState(false);
  const { data: accountId } = useAccountId();
  const { profileData } = useGetProfile(accountId || "");
  const profileId = profileData ? profileData.ProfileTopic : "";

  const [stepStatuses, setStepStatuses] = useState<StepStatuses>({
    explorer: { status: "idle", disabled: false },
    profile: { status: "idle", disabled: true },
  });

  const handleExplorerRepost = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      explorer: { status: "loading", disabled: true },
    }));

    try {
      const repostMessage = {
        Type: "Repost",
        ContentType: contentType,
        Source: source,
      };

      const rePost = await send(explorerTopic, repostMessage, "");

      if (
        (rePost?.receipt as TransactionReceipt)?.result?.toString() ===
        "SUCCESS"
      ) {
        toast.success(`Repost sent to explorer successfully.`);
        setStepStatuses((prev) => ({
          ...prev,
          explorer: { status: "success", disabled: true },
          profile: { status: "idle", disabled: false },
        }));
      } else {
        throw new Error("Explorer repost failed");
      }
    } catch {
      toast.error("Failed to repost to explorer.");
      setStepStatuses((prev) => ({
        ...prev,
        explorer: { status: "error", disabled: false },
      }));
    }
  };

  const handleProfileRepost = async () => {
    setStepStatuses((prev) => ({
      ...prev,
      profile: { status: "loading", disabled: true },
    }));

    try {
      const repostMessage = {
        Type: "Repost",
        ContentType: contentType,
        Source: source,
      };

      const rePost = await send(profileId, repostMessage, "");

      if (
        (rePost?.receipt as TransactionReceipt)?.result?.toString() ===
        "SUCCESS"
      ) {
        toast.success(`Repost sent to your profile successfully.`);
        setStepStatuses((prev) => ({
          ...prev,
          profile: { status: "success", disabled: true },
        }));
        setIsRepostModalOpen(false);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        eventService.emit("refreshExplorer");
      } else {
        throw new Error("Profile repost failed");
      }
    } catch {
      toast.error("Failed to repost to your profile.");
      setStepStatuses((prev) => ({
        ...prev,
        profile: { status: "error", disabled: false },
      }));
    }
  };

  const RepostModal = () => (
    <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-xl w-full max-w-md p-4 sm:p-6 rounded-2xl border border-cyan-400/30 shadow-2xl shadow-cyan-400/20">
      <h2 className="text-xl sm:text-2xl font-mono text-cyan-400 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-4 sm:mb-6">
        Repost Content
      </h2>

      <div className="space-y-3">
        {/* Explorer Step - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 rounded-xl transition-all duration-200 border border-cyan-400/20 shadow-lg shadow-cyan-400/5 bg-slate-800/20">
          <div className="flex-1 pr-0 sm:pr-4 mb-3 sm:mb-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  stepStatuses.explorer.status === "success"
                    ? "bg-green-400"
                    : stepStatuses.explorer.status === "error"
                    ? "bg-red-400"
                    : stepStatuses.explorer.status === "loading"
                    ? "bg-cyan-400 animate-pulse"
                    : "bg-cyan-400"
                }`}
              />
              <h3
                className={`text-sm sm:text-base font-medium font-mono ${
                  stepStatuses.explorer.status === "success"
                    ? "text-green-400"
                    : stepStatuses.explorer.status === "error"
                    ? "text-red-400"
                    : stepStatuses.explorer.disabled
                    ? "text-gray-500"
                    : "text-white"
                }`}
              >
                Send To Explorer
              </h3>
            </div>
            {stepStatuses.explorer.status === "error" && (
              <p className="text-xs sm:text-sm text-red-400/80 font-light">
                Request failed. Please try again.
              </p>
            )}
            {stepStatuses.explorer.status === "loading" && (
              <p className="text-xs sm:text-sm text-cyan-400/80 font-light animate-pulse">
                Processing...
              </p>
            )}
            {stepStatuses.explorer.status === "success" && (
              <p className="text-xs sm:text-sm text-green-400/80 font-light">
                Completed successfully
              </p>
            )}
          </div>
          <button
            onClick={handleExplorerRepost}
            disabled={
              stepStatuses.explorer.disabled ||
              stepStatuses.explorer.status === "loading"
            }
            className={`px-4 py-2 sm:px-6 rounded-full transition-all duration-200 font-medium min-w-[80px] sm:min-w-[100px]
              flex items-center justify-center shadow-lg ${
                stepStatuses.explorer.status === "success"
                  ? "bg-green-500 text-white shadow-green-500/25 cursor-default"
                  : stepStatuses.explorer.status === "loading"
                  ? "bg-slate-700 text-white animate-pulse cursor-not-allowed"
                  : stepStatuses.explorer.status === "error"
                  ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/25"
                  : stepStatuses.explorer.disabled
                  ? "bg-slate-700/60 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-cyan-400/25"
              }`}
          >
            {stepStatuses.explorer.status === "loading" ? (
              <span className="text-xs sm:text-sm">Processing...</span>
            ) : stepStatuses.explorer.status === "success" ? (
              <>
                <RiCheckLine className="mr-1" />
                <span className="text-xs sm:text-sm">Done</span>
              </>
            ) : stepStatuses.explorer.status === "error" ? (
              <>
                <RiRefreshLine className="mr-1" />
                <span className="text-xs sm:text-sm">Retry</span>
              </>
            ) : (
              <span className="text-xs sm:text-sm">Start</span>
            )}
          </button>
        </div>

        {/* Profile Step - Mobile optimized */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 rounded-xl transition-all duration-200 border border-cyan-400/20 shadow-lg shadow-cyan-400/5 bg-slate-800/20">
          <div className="flex-1 pr-0 sm:pr-4 mb-3 sm:mb-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  stepStatuses.profile.status === "success"
                    ? "bg-green-400"
                    : stepStatuses.profile.status === "error"
                    ? "bg-red-400"
                    : stepStatuses.profile.status === "loading"
                    ? "bg-cyan-400 animate-pulse"
                    : "bg-cyan-400"
                }`}
              />
              <h3
                className={`text-sm sm:text-base font-medium font-mono ${
                  stepStatuses.profile.status === "success"
                    ? "text-green-400"
                    : stepStatuses.profile.status === "error"
                    ? "text-red-400"
                    : stepStatuses.profile.disabled
                    ? "text-gray-500"
                    : "text-white"
                }`}
              >
                Send To Your Profile
              </h3>
            </div>
            {stepStatuses.profile.status === "error" && (
              <p className="text-xs sm:text-sm text-red-400/80 font-light">
                Request failed. Please try again.
              </p>
            )}
            {stepStatuses.profile.status === "loading" && (
              <p className="text-xs sm:text-sm text-cyan-400/80 font-light animate-pulse">
                Processing...
              </p>
            )}
            {stepStatuses.profile.status === "success" && (
              <p className="text-xs sm:text-sm text-green-400/80 font-light">
                Completed successfully
              </p>
            )}
          </div>
          <button
            onClick={handleProfileRepost}
            disabled={
              stepStatuses.profile.disabled ||
              stepStatuses.profile.status === "loading"
            }
            className={`px-4 py-2 sm:px-6 rounded-full transition-all duration-200 font-medium min-w-[80px] sm:min-w-[100px]
              flex items-center justify-center shadow-lg ${
                stepStatuses.profile.status === "success"
                  ? "bg-green-500 text-white shadow-green-500/25 cursor-default"
                  : stepStatuses.profile.status === "loading"
                  ? "bg-slate-700 text-white animate-pulse cursor-not-allowed"
                  : stepStatuses.profile.status === "error"
                  ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/25"
                  : stepStatuses.profile.disabled
                  ? "bg-slate-700/60 text-slate-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-400 to-blue-500 hover:scale-105 text-white shadow-cyan-400/25"
              }`}
          >
            {stepStatuses.profile.status === "loading" ? (
              <span className="text-xs sm:text-sm">Processing...</span>
            ) : stepStatuses.profile.status === "success" ? (
              <>
                <RiCheckLine className="mr-1" />
                <span className="text-xs sm:text-sm">Done</span>
              </>
            ) : stepStatuses.profile.status === "error" ? (
              <>
                <RiRefreshLine className="mr-1" />
                <span className="text-xs sm:text-sm">Retry</span>
              </>
            ) : (
              <span className="text-xs sm:text-sm">Start</span>
            )}
          </button>
        </div>
      </div>

      <button
        onClick={() => setIsRepostModalOpen(false)}
        className="w-full bg-slate-800 hover:bg-red-500/20 text-white py-2 mt-4 sm:mt-6 px-4 rounded-full border border-cyan-400/50 hover:border-red-400/50 transition-all duration-200 font-mono text-sm sm:text-base"
      >
        Cancel
      </button>
    </div>
  );

  const handleRepostClick = () => {
    if (!isConnected) {
      setIsConnectModalOpen(true);
      return;
    }
    setIsRepostModalOpen(true);
  };

  return (
    <div>
      <button
        className="group flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-400/20 hover:from-cyan-400/30 hover:to-blue-400/30 text-cyan-400 hover:text-cyan-300 transition-all duration-300 border border-cyan-400/30 hover:border-cyan-400/50 shadow-lg shadow-cyan-400/15 hover:shadow-xl hover:shadow-cyan-400/25 hover:scale-[1.05] active:scale-[0.95] backdrop-blur-sm"
        onClick={handleRepostClick}
        title="Repost this content"
      >
        <BiRepost className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:animate-pulse" />
        <span className="hidden sm:inline text-xs sm:text-sm font-mono font-medium">
          Repost
        </span>
      </button>
      {isConnectModalOpen && (
        <ConnectModal
          isOpen={isConnectModalOpen}
          onClose={() => setIsConnectModalOpen(false)}
        />
      )}
      <Modal
        isOpen={isRepostModalOpen}
        onClose={() => setIsRepostModalOpen(false)}
      >
        <RepostModal />
      </Modal>
    </div>
  );
}
