export const formatTimestamp = (timestamp: string): string => {
  if (!timestamp) return "";

  try {
    // Hedera consensus_timestamp format: "seconds.nanoseconds" (e.g., "1701555500.123456789")
    const parts = timestamp.split(".");
    const seconds = parseInt(parts[0], 10);
    const nanoseconds = parts[1] ? parseInt(parts[1], 10) : 0;

    // Convert to milliseconds: seconds * 1000 + nanoseconds / 1,000,000
    const timestampInMs = seconds * 1000 + Math.floor(nanoseconds / 1000000);
    const date = new Date(timestampInMs);

    // Format the date
    return date.toLocaleString();
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return timestamp;
  }
};
