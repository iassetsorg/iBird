/**
 * ReadMediaFile is a component that handles the display of different media types from IPFS or Arweave.
 * Features:
 * - Supports multiple media types (images, videos, audio)
 * - Handles IPFS and Arweave URLs
 * - Responsive media display with Next.js 15 optimizations
 * - Error handling with fallback UI
 */

"use client";

import React, { useEffect, useState } from "react";

/**
 * Props interface for ReadMediaFile
 * @property {string | null} cid - Content Identifier for IPFS or Arweave
 */
interface Props {
  cid: string | null;
}

/**
 * Utility function to convert CID to accessible URL
 * @param {string} cid - Content Identifier (IPFS or Arweave format)
 * @returns {string | null} - Converted URL or null if format is unsupported
 */
const getMediaURL = (cid: string): string | null => {
  if (cid.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${cid.slice("ipfs://".length)}`;
  } else if (cid.startsWith("ar://")) {
    return `https://arweave.net/${cid.slice("ar://".length)}`;
  }
  console.error("Unsupported CID format:", cid);
  return null;
};

/**
 * Component for displaying media content from IPFS or Arweave
 * Automatically detects and renders appropriate media player based on file type
 */
const ReadMediaFile: React.FC<Props> = ({ cid }) => {
  // State to hold the rendered media element
  const [mediaElement, setMediaElement] = useState<React.JSX.Element | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [objectURL, setObjectURL] = useState<string | null>(null);

  useEffect(() => {
    console.log("ReadMediaFile useEffect triggered with cid:", cid);
    
    if (!cid) {
      console.log("No CID provided, setting loading to false");
      setIsLoading(false);
      return;
    }

    const url = getMediaURL(cid);
    console.log("Generated URL:", url);
    
    if (!url) {
      console.log("Invalid URL, setting loading to false");
      setIsLoading(false);
      return;
    }

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log("Timeout reached, forcing loading to false");
      setIsLoading(false);
    }, 5000);

    /**
     * Fetches media content and determines its type for appropriate rendering
     * @param {string} url - The URL of the media content
     */
    const determineMediaTypeAndRender = async (url: string) => {
      try {
        console.log("Starting to fetch media from:", url);
        setIsLoading(true);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch media: ${response.status} ${response.statusText}`
          );
        }

        const blob = await response.blob();
        const mimeType = blob.type;
        console.log("Blob received, type:", mimeType, "size:", blob.size);

        // Create object URL for media content
        const newObjectURL = URL.createObjectURL(blob);
        console.log("Object URL created:", newObjectURL);
        setObjectURL(newObjectURL);

        // Clear timeout since we're handling loading state
        clearTimeout(timeoutId);

        // Render different elements based on media type
        if (mimeType.startsWith("image/")) {
          console.log("Setting image element for profile");
          // Simple direct image approach
          setMediaElement(
            <img 
              src={newObjectURL} 
              alt="Profile Picture" 
              className="w-full h-full object-cover rounded-xl"
              onLoad={() => {
                console.log("Profile image loaded successfully!");
                setIsLoading(false);
              }}
              onError={(e) => {
                console.error("Profile image failed to load:", e);
                setIsLoading(false);
              }}
            />
          );
          // Force loading to false as backup
          setTimeout(() => setIsLoading(false), 100);
        } else if (mimeType.startsWith("video/")) {
          // Video player with native HTML5 video and aspect ratio preservation
          setMediaElement(
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black">
              <video
                src={newObjectURL}
                controls
                className="w-full h-full object-contain"
                playsInline
                onLoadedData={() => setIsLoading(false)}
                onError={() => {
                  setMediaElement(
                    <div className="w-full p-4 text-center bg-red-50 text-red-700 rounded-lg border border-red-200">
                      Failed to load video content
                    </div>
                  );
                  setIsLoading(false);
                }}
              >
                Your browser does not support the video element.
              </video>
            </div>
          );
        } else if (mimeType.startsWith("audio/")) {
          // Audio player with modern styling
          setMediaElement(
            <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 1.414A4.978 4.978 0 0118 12a4.978 4.978 0 01-.929 2.243 1 1 0 01-1.414-1.414A2.978 2.978 0 0016 12a2.978 2.978 0 00-.343-1.657 1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Audio File
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {mimeType}
                  </p>
                </div>
              </div>
              <audio
                controls
                className="w-full h-10"
                onLoadedData={() => setIsLoading(false)}
                onError={() => {
                  setMediaElement(
                    <div className="w-full p-4 text-center bg-red-50 text-red-700 rounded-lg border border-red-200">
                      Failed to load audio content
                    </div>
                  );
                  setIsLoading(false);
                }}
              >
                <source src={newObjectURL} type={mimeType} />
                Your browser does not support the audio element.
              </audio>
            </div>
          );
        } else {
          // Unsupported media type
          setMediaElement(
            <div className="w-full p-6 text-center bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
              <div className="flex items-center justify-center gap-2 mb-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-medium">Unsupported Media Type</span>
              </div>
              <p className="text-sm">File type: {mimeType || "Unknown"}</p>
              <a
                href={newObjectURL}
                download
                className="inline-block mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                Download File
              </a>
            </div>
          );
          setIsLoading(false);
        }
      } catch (error) {
        // Error state with user feedback
        console.error("Error fetching media:", error);
        clearTimeout(timeoutId);
        setMediaElement(
          <div className="w-full p-6 text-center bg-red-50 text-red-700 rounded-lg border border-red-200">
            <div className="flex items-center justify-center gap-2 mb-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8.707-3.293a1 1 0 00-1.414 1.414L9.586 10l-1.707 1.707a1 1 0 101.414 1.414L11 11.414l1.707 1.707a1 1 0 001.414-1.414L12.414 10l1.707-1.707a1 1 0 00-1.414-1.414L11 8.586 9.293 6.879z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">Failed to Load Media</span>
            </div>
            <p className="text-sm mb-3">
              {error instanceof Error
                ? error.message
                : "An error occurred while loading the media content"}
            </p>
            <button
              onClick={() => window.open(url, "_blank")}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Open in New Tab
            </button>
          </div>
        );
        setIsLoading(false);
      }
    };

    determineMediaTypeAndRender(url);

    // Cleanup function to revoke object URL and clear timeout
    return () => {
      clearTimeout(timeoutId);
      if (objectURL) {
        URL.revokeObjectURL(objectURL);
      }
    };
  }, [cid]);

  // Loading state
  if (isLoading && cid) {
    return (
      <div className="media-preview w-full">
        <div className="w-full p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="inline-flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-gray-600 dark:text-gray-400">
              Loading media content...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!cid) {
    return (
      <div className="media-preview w-full">
        <div className="w-full p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
            <span>No media content available</span>
          </div>
        </div>
      </div>
    );
  }

  // Container with consistent width and media element
  return <div className="media-preview w-full">{mediaElement}</div>;
};

export default ReadMediaFile;
