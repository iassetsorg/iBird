"use client";

import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Area } from "react-easy-crop";
import { getCroppedImg } from "../utils/cropImage";
import { RiCheckLine } from "react-icons/ri";
import { toast } from "react-toastify";
import Modal from "./modal";

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  tempImage: string;
  onCropComplete: (croppedFile: File) => void;
  aspectRatio?: number;
  cropShape?: "rect" | "round";
  title?: string;
  description?: string;
}

/**
 * Dedicated Image Cropping Modal Component
 * Uses the common Modal component for consistent styling and behavior
 */
const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  onClose,
  tempImage,
  onCropComplete,
  aspectRatio = 1,
  cropShape = "round",
  title = "Crop Profile Picture",
  description = "Drag to move • Scroll to zoom • Perfect your profile picture",
}) => {
  // Cropping states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Resets crop settings to default values
   */
  const resetCrop = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  /**
   * Callback for when crop area changes (React Easy Crop)
   */
  const onCropAreaComplete = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  /**
   * Handles completion of image cropping
   */
  const handleCropComplete = async () => {
    if (!tempImage || !croppedAreaPixels) {
      toast.error("Unable to crop image. Please try again.");
      return;
    }

    setIsProcessing(true);

    try {
      const croppedFile = await getCroppedImg(tempImage, croppedAreaPixels);
      onCropComplete(croppedFile);
      toast.success("Image cropped successfully!");
      onClose();
      resetCrop();
    } catch (error) {
      console.error("Crop error:", error);
      toast.error("Failed to crop image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handles modal close
   */
  const handleClose = () => {
    resetCrop();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} hideCloseButton={false}>
      <div className="bg-slate-900 border border-cyan-400/50 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col h-[85vh]">
        {/* Header - Fixed */}
        <div className="px-6 py-3 border-b border-cyan-400/30 flex-shrink-0">
          <h3 className="text-lg font-semibold text-cyan-400 mb-1 font-mono bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {title}
          </h3>
          <p className="text-xs text-white/60 font-light">{description}</p>
        </div>

        {/* Content Area - No scrolling */}
        <div className="flex-1 flex flex-col p-4">
          {/* Crop Area with React Easy Crop */}
          <div className="relative bg-slate-800/50 rounded-xl overflow-hidden flex-1 mb-3">
            <Cropper
              image={tempImage}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropAreaComplete}
              cropShape={cropShape}
              showGrid={aspectRatio !== 1}
              style={{
                containerStyle: {
                  background: "transparent",
                },
                mediaStyle: {
                  borderRadius: "12px",
                },
                cropAreaStyle: {
                  border: "3px solid #22d3ee",
                  boxShadow: "0 0 30px rgba(34, 211, 238, 0.4)",
                },
              }}
            />
          </div>

          {/* Zoom Control - Compact */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-white/60 font-mono min-w-[40px]">
              Zoom
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 
                [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg
                [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full 
                [&::-moz-range-thumb]:bg-cyan-400 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            />
            <span className="text-xs text-cyan-400 font-mono min-w-[40px] text-right">
              {zoom.toFixed(1)}x
            </span>
          </div>

          {/* Instructions - Compact */}
          <div className="p-2 bg-cyan-400/5 rounded-lg border border-cyan-400/20 mb-3">
            <div className="flex items-center gap-2 text-xs text-cyan-400/80">
              <span className="text-cyan-400">💡</span>
              <span className="font-light">
                <strong className="font-mono text-cyan-400">Tip:</strong> Drag
                to move, scroll to zoom
              </span>
            </div>
          </div>
        </div>

        {/* Controls - Always visible at bottom */}
        <div className="px-4 py-3 bg-slate-900/95 backdrop-blur-sm flex-shrink-0 border-t border-cyan-400/30">
          <div className="flex justify-center gap-3">
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="px-5 py-2 rounded-lg bg-slate-700 hover:bg-red-500/20 text-white
                border border-slate-600 hover:border-red-400/50 transition-all duration-200 font-mono text-xs
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleCropComplete}
              disabled={!croppedAreaPixels || isProcessing}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 
                hover:scale-105 text-white font-medium transition-all duration-200
                flex items-center gap-1 font-mono shadow-lg shadow-green-500/25 text-xs
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isProcessing ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RiCheckLine className="text-sm" />
                  Apply Crop
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ImageCropModal;
