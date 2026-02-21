/**
 * ResponsiveLayout - A responsive container component for groups and channels
 * Features:
 * - Mobile-first responsive design
 * - Adaptive grid layouts
 * - Enhanced spacing and typography
 * - Consistent breakpoints across the app
 */

import React from "react";

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  variant?: "list" | "grid" | "masonry";
  spacing?: "tight" | "normal" | "loose";
  className?: string;
}

const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  variant = "list",
  spacing = "normal",
  className = "",
}) => {
  // Spacing configurations
  const spacingClasses = {
    tight: "gap-2 p-4",
    normal: "gap-4 p-6",
    loose: "gap-6 p-8",
  };

  // Layout variant configurations
  const variantClasses = {
    list: "flex flex-col",
    grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
    masonry: "columns-1 sm:columns-2 lg:columns-3 xl:columns-4 space-y-4",
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Responsive container */}
      <div
        className={`
        ${variantClasses[variant]}
        ${spacingClasses[spacing]}
        transition-all duration-300
      `}
      >
        {children}
      </div>
    </div>
  );
};

export default ResponsiveLayout;
