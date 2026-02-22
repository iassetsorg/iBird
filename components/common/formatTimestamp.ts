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

    // Twitter-style date formatting
    const now = new Date();
    const currentYear = now.getFullYear();
    const messageYear = date.getFullYear();

    // Calculate time difference
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    // Less than 1 minute: show as "now" or time
    if (diffMins < 1) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // Less than 1 hour: show minutes ago (e.g., "30m")
    if (diffMins < 60) {
      return `${diffMins}m`;
    }

    // Less than 24 hours: show hours ago (e.g., "4h")
    if (diffHours < 24) {
      return `${diffHours}h`;
    }

    // More than 24 hours but same year: show "Month Day" (e.g., "Feb 21")
    if (messageYear === currentYear) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Previous years: show "Month Day, Year" (e.g., "Mar 3, 2025")
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return timestamp;
  }
};
