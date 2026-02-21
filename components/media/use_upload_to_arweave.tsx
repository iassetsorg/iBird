/**
 * useUploadToArweave is a custom React hook that handles file uploads to Arweave storage.
 * Features:
 * - Progress tracking
 * - Error handling
 * - Upload status management
 * - Arweave ID retrieval
 */

/**
 * Custom hook for managing file uploads to Arweave storage
 * Returns an object containing:
 * - uploadToArweave: Function to handle file upload
 * - uploading: Boolean indicating upload status
 * - progress: Number indicating upload progress (0-100)
 * - error: String containing error message if any
 * - arweaveId: String containing the Arweave transaction ID after successful upload
 */

import { useState, useCallback } from "react";
import { createData, ArweaveSigner } from "arbundles";

const useUploadToArweave = () => {
  // State management for upload process
  const [uploading, setUploading] = useState(false); // Track upload status
  const [progress, setProgress] = useState(0); // Track upload progress
  const [error, setError] = useState<string | null>(null); // Store error messages
  const [arweaveId, setArweaveId] = useState<string | null>(null); // Store Arweave ID

  /**
   * Main upload function that handles the file upload process
   * @param {File} file - The file to be uploaded to Arweave
   * @returns {Promise<string>} - Returns the Arweave URL in format "ar://{id}"
   * @throws {Error} - Throws error if upload fails
   */
  const uploadToArweave = useCallback(async (file: File) => {
    try {
      setUploading(true);
      setProgress(0);
      setError(null);

      // Wallet key for signing - read from environment variable
      const walletKeyJson = process.env.ARWEAVE_WALLET_KEY;
      
      if (!walletKeyJson) {
        throw new Error("ARWEAVE_WALLET_KEY environment variable not configured");
      }
      
      let walletKey;
      try {
        walletKey = JSON.parse(walletKeyJson);
      } catch {
        throw new Error("Invalid ARWEAVE_WALLET_KEY JSON format");
      }

      if (!walletKey) {
        throw new Error("Wallet key not configured");
      }

      // Set progress to indicate upload has started
      setProgress(25);

      // Create Arweave signer
      const signer = new ArweaveSigner(walletKey);

      // Read file as buffer
      const fileBuffer = await file.arrayBuffer();
      setProgress(50);

      // Create data-item with file content
      const dataItem = createData(new Uint8Array(fileBuffer), signer, {
        tags: [
          {
            name: "Content-Type",
            value: file.type || "application/octet-stream",
          },
          { name: "File-Name", value: file.name },
          { name: "File-Size", value: file.size.toString() },
          { name: "Upload-Timestamp", value: Date.now().toString() },
        ],
      });

      // Sign the data-item
      await dataItem.sign(signer);
      setProgress(75);

      // Upload to ArDrive Turbo API
      const response = await fetch("https://upload.ardrive.io/v1/tx", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          Accept: "application/json",
        },
        body: new Uint8Array(dataItem.getRaw()),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const id = result.id;

      // Set final state
      setArweaveId(id);
      setProgress(100);
      setUploading(false);

      return `ar://${id}`; // Return the Arweave URL
    } catch (error) {
      // Handle and store error state
      setError(
        (error as Error).message ||
          "An error occurred while uploading to Arweave"
      );
      setProgress(0);
      setUploading(false);
      throw error; // Rethrow for caller handling
    }
  }, []);

  // Return hook interface
  return { uploadToArweave, uploading, arweaveId, error, progress };
};

export default useUploadToArweave;
