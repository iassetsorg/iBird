import React from "react";

interface LinkAndHashtagReaderProps {
  message: string;
}

const LinkAndHashtagReader: React.FC<LinkAndHashtagReaderProps> = ({
  message,
}) => {
  // Simple implementation that just returns the message
  // In a real implementation, this would parse and render links and hashtags
  return <span>{message}</span>;
};

export default LinkAndHashtagReader;
