import ReadAd from "./read_ad";
import UserProfile from "../profile/user_profile";
import { FiRepeat } from "react-icons/fi";
import { formatTimestamp } from "../common/formatTimestamp";
import type { Message } from "../hooks/use_get_data";

interface ReadSharedAdProps {
    contentType?: string;
    source?: string;
    rePoster?: string;
    timestamp?: string;
}

const ReadSharedAd = ({
    contentType,
    source,
    rePoster,
    timestamp,
}: ReadSharedAdProps) => {
    const renderContent = () => {
        switch (contentType?.toLowerCase()) {
            case "ad":
                return source ? (
                    <ReadAd
                        message={
                            {
                                sequence_number: parseInt(source),
                                sender: "",
                                message_id: "",
                                Message: "",
                                consensus_timestamp: "",
                                Type: "Ad",
                            } as Message
                        }
                    />
                ) : null;
            default:
                return (
                    <div className="flex flex-col justify-center items-center py-6 rounded-xl bg-slate-800/50 border border-yellow-400/20">
                        <FiRepeat className="w-8 h-8 text-yellow-400 mb-2" />
                        <p className="text-sm text-yellow-300">Unsupported content type</p>
                    </div>
                );
        }
    };

    return (
        <div className="max-w-4xl mx-auto bg-background text-text group">
            {/* Repost Header with User Info and Timestamp */}
            <div className="bg-gradient-to-br from-slate-900 via-yellow-900/20 to-slate-900 backdrop-blur-xl rounded-t-2xl border-l border-r border-t border-yellow-400/30 px-3 sm:px-6 py-3 sm:py-4 group-hover:-translate-y-[1px] transition-transform">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="transform-gpu group-hover:scale-[1.02] transition-transform">
                            <UserProfile userAccountId={rePoster || ""} />
                        </div>
                        <div className="flex items-center text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-lg group-hover:scale-[1.02] transition-transform group-hover:bg-yellow-400/20">
                            <FiRepeat className="w-4 h-4 mr-2 group-hover:rotate-[12deg] transition-transform" />
                            <span className="text-sm font-mono font-medium">Shared Ad</span>
                        </div>
                    </div>
                    <span className="text-xs sm:text-sm text-yellow-400/60 font-mono group-hover:text-yellow-400/80 transition-colors">
                        {formatTimestamp(timestamp || "")}
                    </span>
                </div>
            </div>

            {/* Main Content */}
            <div className="bg-gradient-to-b from-slate-900/60 to-slate-800/60 backdrop-blur-sm rounded-b-2xl border-l border-r border-b border-yellow-400/30 group-hover:bg-slate-900/70 transition-colors">
                <div className="pt-2 group-hover:translate-y-[1px] transition-transform">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default ReadSharedAd;
