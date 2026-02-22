import React from "react";

const LoadingSpinner: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50">
      <div className="flex flex-col items-center">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full animate-spin border-4 border-cyan-400/20 border-t-cyan-400"></div>
          <div className="absolute inset-2 rounded-full animate-spin border-4 border-purple-400/20 border-r-purple-400" style={{ animationDirection: "reverse", animationDuration: "1.5s" }}></div>
        </div>
        <p className="text-cyan-400 font-mono animate-pulse">Loading iBird...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
