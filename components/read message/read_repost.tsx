import ReadPost from "./read_post";
import ReadThread from "./read_thread";
import ReadPoll from "./read_poll";
import UserProfile from "../profile/user_profile";
import { FiRepeat } from "react-icons/fi";
import { formatTimestamp } from "../common/formatTimestamp";
import type { Message } from "../hooks/use_get_data";

interface ReadRepostProps {
  contentType?: string;
  source?: string;
  rePoster?: string;
  timestamp?: string;
}

const ReadRepost = ({
  contentType,
  source,
  rePoster,
  timestamp,
}: ReadRepostProps) => {
  const renderContent = () => {
    switch (contentType?.toLowerCase()) {
      case "post":
        return source ? (
          <ReadPost
            message={
              {
                sequence_number: parseInt(source),
                sender: "",
                message_id: "",
                Message: "",
                consensus_timestamp: "",
                Type: "Post",
              } as Message
            }
          />
        ) : null;
      case "thread":
        return source ? <ReadThread topicId={source} /> : null;
      case "poll":
        return source ? <ReadPoll topicId={source} /> : null;
      default:
        return (
          <div className="flex flex-col justify-center items-center py-6 rounded-xl bg-slate-800/50 border border-cyan-400/20">
            <FiRepeat className="w-8 h-8 text-cyan-400 mb-2" />
            <p className="text-sm text-cyan-300">Unsupported content type</p>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-background text-text group">
      {/* Repost Header with User Info and Timestamp - Mobile optimized */}
      <div className="bg-gradient-to-br from-slate-900 via-cyan-900/20 to-slate-900 backdrop-blur-xl sm:rounded-t-2xl border-y sm:border-l sm:border-r sm:border-t border-cyan-400/30 px-3 sm:px-6 py-3 sm:py-4 group-hover:-translate-y-[1px] transition-transform">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="transform-gpu group-hover:scale-[1.02] transition-transform">
              <UserProfile userAccountId={rePoster || ""} />
            </div>
            <div className="flex items-center text-cyan-400 bg-cyan-400/10 px-3 py-1.5 rounded-lg group-hover:scale-[1.02] transition-transform group-hover:bg-cyan-400/20">
              <FiRepeat className="w-4 h-4 mr-2 group-hover:rotate-[12deg] transition-transform" />
              <span className="text-sm font-mono font-medium">Reposted</span>
            </div>
          </div>
          <span className="text-xs sm:text-sm text-cyan-400/60 font-mono group-hover:text-cyan-400/80 transition-colors">
            {formatTimestamp(timestamp || "")}
          </span>
        </div>
      </div>

      {/* Main Content - Mobile optimized */}
      <div className="bg-gradient-to-b from-slate-900/60 to-slate-800/60 backdrop-blur-sm sm:rounded-b-2xl border-b sm:border-l sm:border-r sm:border-b border-cyan-400/30 group-hover:bg-slate-900/70 transition-colors">
        <div className="pt-0 sm:pt-2 group-hover:translate-y-[1px] transition-transform">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ReadRepost;
