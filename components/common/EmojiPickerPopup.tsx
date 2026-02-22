import React from "react";
import EmojiPicker, { Theme, EmojiClickData } from "emoji-picker-react";
import Modal from "./modal";
import { RiCloseLine } from "react-icons/ri";
interface EmojiPickerPopupProps {
  onEmojiClick: (emojiData: EmojiClickData, event?: MouseEvent) => void;
  onClose: () => void;
}

const EmojiPickerPopup: React.FC<EmojiPickerPopupProps> = ({
  onEmojiClick,
  onClose,
}) => {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .EmojiPickerReact {
            --epr-bg-color: rgba(15, 23, 42, 0.9) !important;
            --epr-text-color: #ffffff !important;
            --epr-hover-bg-color: rgba(168, 85, 247, 0.2) !important;
            --epr-emoji-size: 28px !important;
          }
          .EmojiPickerReact.epr-dark-theme {
            --epr-bg-color: rgba(15, 23, 42, 0.9) !important;
            --epr-text-color: #ffffff !important;
            --epr-hover-bg-color: rgba(168, 85, 247, 0.2) !important;
          }
          .EmojiPickerReact ::-webkit-scrollbar {
            width: 8px;
          }
          .EmojiPickerReact ::-webkit-scrollbar-track {
            background: rgba(15, 23, 42, 0.9);
          }
          .EmojiPickerReact ::-webkit-scrollbar-thumb {
            background: rgba(168, 85, 247, 0.5);
            border-radius: 4px;
          }
          .EmojiPickerReact ::-webkit-scrollbar-thumb:hover {
            background: rgba(168, 85, 247, 0.7);
          }
        `,
        }}
      />
      <Modal
        isOpen={true}
        onClose={onClose}
        hideCloseButton={true}
      >
        <div className="relative max-w-md mx-auto">
          {/* Emoji Picker Container */}
          <div className="relative border-y sm:border border-purple-400/30 sm:rounded-2xl shadow-2xl shadow-purple-400/20 overflow-hidden backdrop-blur-md">
            {/* Animated Background - same as Hero */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 animate-gradient-shift bg-[length:400%_400%]" />

            {/* Cyber Grid Overlay */}
            <div className="absolute inset-0 bg-cyber-grid bg-cyber-grid opacity-20" />

            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-purple-400/20 rounded-2xl blur-xl opacity-30" />

            <div className="relative z-20">
              <div className="relative z-30 bg-slate-900/90 rounded-xl overflow-hidden">
                {/* Wrapper for EmojiPicker + Close Button */}
                <div className="relative">
                  <EmojiPicker
                    searchPlaceholder="Search emojis..."
                    width={320}
                    height={400}
                    onEmojiClick={onEmojiClick}
                    lazyLoadEmojis
                    skinTonesDisabled
                    theme={Theme.DARK}
                  />

                  {/* Close button aligned with search input */}
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-5 flex items-center justify-center z-10  group  rounded-full w-7 h-7 bg-secondary/50 hover:bg-red-500 text-text/50 hover:text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500/50 backdrop-blur-sm hover:scale-110 text-white "
                  >
                    <RiCloseLine
                      className="text-xl transform transition-transform 
                group-hover:rotate-90 duration-200"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default EmojiPickerPopup;
