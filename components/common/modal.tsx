"use client";

import React, { FC, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

/**
 * Modal is a reusable React component that displays content in an overlay dialog.
 * Features:
 * - Backdrop with opacity
 * - Centered content
 * - Optional close button
 * - Scrollable content area
 * - Responsive design
 * - Next.js 15 compatible with 'use client' directive
 */

/**
 * Props interface for the Modal component
 * @property {boolean} isOpen - Controls the visibility of the modal
 * @property {() => void} onClose - Callback function when modal is closed
 * @property {React.ReactNode} children - Content to be displayed inside the modal
 * @property {boolean} hideCloseButton - Optional flag to hide the close button
 * @property {() => void} onCloseClick - Optional additional callback for close button click
 * @property {boolean} removeZIndex - Optional flag to remove the z-index behavior
 */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  hideCloseButton?: boolean;
  onCloseClick?: () => void;
  removeZIndex?: boolean;
}

const Modal: FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  hideCloseButton = false,
  onCloseClick,
  removeZIndex = false,
}) => {
  // Track modal state internally
  const [modalOpen, setModalOpen] = useState(isOpen);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync internal state with prop
  useEffect(() => {
    setModalOpen(isOpen);
  }, [isOpen]);

  /**
   * Handles the modal closing action
   * Executes both the required onClose and optional onCloseClick callbacks
   */
  const closeModal = useCallback(() => {
    setModalOpen(false);
    onClose();
    if (onCloseClick) {
      onCloseClick();
    }
  }, [onClose, onCloseClick]);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && modalOpen) {
        closeModal();
      }
    };

    if (modalOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [modalOpen, closeModal]);

  /**
   * Handle backdrop click to close modal
   */
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  };

  // Don't render anything on server-side or if not mounted
  if (!mounted || !modalOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center ${
        !removeZIndex ? "z-[99999]" : "z-[10]"
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Semi-transparent backdrop */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm"></div>
      </div>

      {/* Modal container with positioning */}
      <div
        className={`relative max-w-3xl mx-auto ${
          !removeZIndex ? "z-[100000]" : "z-[11]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-transparent rounded-lg shadow-xl text-text overflow-hidden">
          {/* Animated close button with hover effects */}
          {!hideCloseButton && (
            <div
              className={`absolute top-4 right-4 ${
                !removeZIndex ? "z-[100001]" : "z-[12]"
              }`}
            >
              <button
                type="button"
                className="group relative text-cyan-100 rounded-full w-8 h-8 bg-slate-800/80 hover:bg-red-500 border border-cyan-400/50 hover:border-red-400/70 text-cyan-100 hover:text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 backdrop-blur-sm hover:scale-110 shadow-lg shadow-cyan-400/20 flex items-center justify-center"
                onClick={closeModal}
                aria-label="Close modal"
              >
                <span className="sr-only">Close</span>
                {/* Animated X icon */}
                <svg
                  className="h-4 w-4 transform group-hover:rotate-90 transition-transform duration-300"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18"></path>
                  <path d="M6 6l12 12"></path>
                </svg>
                {/* Gradient background for hover effect */}
                <div className="absolute inset-0 rounded-full group-hover:bg-gradient-to-tr from-red-600 to-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"></div>
              </button>
            </div>
          )}
          {/* Scrollable content area with max height */}
          <div className="overflow-y-auto max-h-[calc(100vh-2rem)]">
            <div className="relative">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
