/**
 * EnhancedSpinner - A more sophisticated loading component with multiple variants
 * Features:
 * - Multiple spinner types (pulse, orbit, dots, bars)
 * - Customizable colors and sizes
 * - Loading messages and progress indicators
 * - Smooth animations and transitions
 */

import React from "react";

interface EnhancedSpinnerProps {
  variant?: "pulse" | "orbit" | "dots" | "bars" | "gradient";
  size?: "sm" | "md" | "lg" | "xl";
  color?: "purple" | "cyan" | "green" | "orange" | "red";
  message?: string;
  progress?: number; // 0-100 for progress bar
  className?: string;
}

const EnhancedSpinner: React.FC<EnhancedSpinnerProps> = ({
  variant = "pulse",
  size = "md",
  color = "purple",
  message,
  progress,
  className = "",
}) => {
  // Size configurations
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  // Color configurations
  const colorClasses = {
    purple: {
      primary: "text-purple-400",
      secondary: "text-purple-300",
      bg: "bg-purple-400",
      border: "border-purple-400",
      gradient: "from-purple-400 to-pink-500",
    },
    cyan: {
      primary: "text-cyan-400",
      secondary: "text-cyan-300",
      bg: "bg-cyan-400",
      border: "border-cyan-400",
      gradient: "from-cyan-400 to-blue-500",
    },
    green: {
      primary: "text-green-400",
      secondary: "text-green-300",
      bg: "bg-green-400",
      border: "border-green-400",
      gradient: "from-green-400 to-emerald-500",
    },
    orange: {
      primary: "text-orange-400",
      secondary: "text-orange-300",
      bg: "bg-orange-400",
      border: "border-orange-400",
      gradient: "from-orange-400 to-red-500",
    },
    red: {
      primary: "text-red-400",
      secondary: "text-red-300",
      bg: "bg-red-400",
      border: "border-red-400",
      gradient: "from-red-400 to-pink-500",
    },
  };

  const colors = colorClasses[color];
  const sizeClass = sizeClasses[size];

  // Render different spinner variants
  const renderSpinner = () => {
    switch (variant) {
      case "pulse":
        return (
          <div className={`${sizeClass} relative`}>
            <div
              className={`absolute inset-0 ${colors.bg}/20 rounded-full animate-ping`}
            />
            <div
              className={`absolute inset-0 ${colors.bg}/40 rounded-full animate-pulse`}
            />
            <div className={`w-full h-full ${colors.bg} rounded-full`} />
          </div>
        );

      case "orbit":
        return (
          <div className={`${sizeClass} relative`}>
            <div
              className={`w-full h-full border-4 border-transparent ${colors.border}/30 rounded-full animate-spin`}
            >
              <div
                className={`absolute top-0 left-1/2 w-2 h-2 ${colors.bg} rounded-full transform -translate-x-1/2 -translate-y-1`}
              />
            </div>
          </div>
        );

      case "dots":
        return (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 ${colors.bg} rounded-full animate-bounce`}
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        );

      case "bars":
        return (
          <div className="flex items-end gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-1 ${colors.bg} rounded-full animate-pulse`}
                style={{
                  height: `${12 + (i % 2) * 8}px`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        );

      case "gradient":
      default:
        return (
          <div className={`${sizeClass} relative`}>
            <div
              className={`w-full h-full border-4 border-transparent border-t-${color}-400 rounded-full animate-spin`}
            />
            <div
              className={`absolute inset-2 bg-gradient-to-r ${colors.gradient} rounded-full opacity-20 animate-pulse`}
            />
          </div>
        );
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* Spinner */}
      <div className="mb-3">{renderSpinner()}</div>

      {/* Loading message */}
      {message && (
        <p
          className={`text-sm font-mono ${colors.primary} animate-pulse text-center max-w-xs`}
        >
          {message}
        </p>
      )}

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="w-32 h-1 bg-slate-700 rounded-full mt-3 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-300 ease-out`}
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default EnhancedSpinner;
