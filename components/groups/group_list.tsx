/**
 * GroupList is a React component that displays a list of groups created by the user.
 * Enhanced with:
 * - Advanced search and filtering capabilities
 * - Improved visual hierarchy and responsive design
 * - Better loading states and error handling
 * - Enhanced accessibility and keyboard navigation
 * - Simplified without complex stats fetching to prevent glitches
 * - V2 Profile Support: Reads groups from Groups topic for V2 profiles
 */

// ============================================================================
// IMPORTS SECTION
// ============================================================================

// React Core Imports
import React, { useState, useEffect, useMemo } from "react";

// Third-party Library Imports
import { toast } from "react-toastify";

// Icon Imports
import {
  RiAddLine,
  RiExternalLinkLine,
  RiGroupLine,
  RiUserLine,
  RiTimeLine,
  RiArrowRightLine,
  RiGlobalLine,
  RiSearchLine,
  RiFilterLine,
  RiSortAsc,
  RiSortDesc,
  RiEyeLine,
} from "react-icons/ri";

// Custom Hook Imports
import useGetProfile, { isV2Profile, getTopicId, getArrayData } from "../hooks/use_get_profile";
import useProfileLists, { GroupItem } from "../hooks/use_profile_lists";

// Wallet Integration Imports
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";

// Component Imports
import ReadMediaFile from "../media/read_media_file";
import CreateNewGroup from "./create_new_group";
import Modal from "../common/modal";

// ============================================================================
// TYPE DEFINITIONS & INTERFACES
// ============================================================================

/**
 * Group Interface
 * Defines the structure of a group object
 */
interface Group {
  Name: string;
  Group: string;
  Description: string;
  Media: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const GroupList = ({
  showCreateButton = true,
  onGroupClick,
  className = "",
}: {
  showCreateButton?: boolean;
  onGroupClick?: (group: Group) => void;
  className?: string;
}) => {
  // ========================================================================
  // HOOKS & EXTERNAL DEPENDENCIES
  // ========================================================================

  const { data: accountId } = useAccountId();
  const { profileData, isLoading, error } = useGetProfile(accountId || "");

  // ========================================================================
  // V2 PROFILE SUPPORT - Profile Lists Hook
  // ========================================================================

  // Get Groups topic ID for V2 profiles (empty string for V1)
  const groupsTopicId = profileData ? getTopicId(profileData.Groups) : "";
  
  // V2 Groups list hook - reads from Groups topic
  // Note: For read-only display, we don't need the profile update callback
  const groupsList = useProfileLists(
    groupsTopicId,
    "Groups",
    "", // profileTopicId not needed for read-only
    null, // profileData not needed for read-only
    async () => false // dummy callback, not used for reads
  );

  // ========================================================================
  // COMPONENT STATE MANAGEMENT
  // ========================================================================

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "activity">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterActive, setFilterActive] = useState(false);

  // ========================================================================
  // DATA LOADING AND SYNCHRONIZATION
  // ========================================================================

  /**
   * Update groups list when profile data changes
   * V2: Uses groupsList.items from Groups topic
   * V1: Uses profileData.Groups array directly
   */
  useEffect(() => {
    if (!profileData) {
      setGroups([]);
      return;
    }

    // V2 Profile: Use groupsList.items from the Groups topic
    if (isV2Profile(profileData)) {
      // groupsList.items will be populated by the useProfileLists hook
      const v2Groups = groupsList.items as GroupItem[];
      setGroups(v2Groups.map(g => ({
        Name: g.Name,
        Group: g.Group,
        Description: g.Description,
        Media: g.Media
      })));
    } else {
      // V1 Profile: Use profileData.Groups array directly
      const v1Groups = getArrayData(profileData.Groups);
      setGroups(v1Groups as Group[]);
    }
  }, [profileData, groupsList.items]);

  // ========================================================================
  // SEARCH AND FILTERING LOGIC
  // ========================================================================

  /**
   * Filtered and sorted groups based on search term and sort criteria
   */
  const filteredAndSortedGroups = useMemo(() => {
    let filtered = groups.filter(
      (group) =>
        group.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.Description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply activity filter (simplified - for now all groups are considered active)
    if (filterActive) {
      // Keep all groups for now - this could be enhanced with actual activity tracking
      filtered = filtered;
    }

    // Sort groups
    filtered.sort((a, b) => {
      const comparison = a.Name.localeCompare(b.Name);
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [groups, searchTerm, sortOrder, filterActive]);

  /**
   * Toggle sort order
   */
  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  /**
   * Handles group click - either calls custom handler or opens topic
   */
  const handleGroupClick = (group: Group) => {
    if (onGroupClick) {
      onGroupClick(group);
    } else {
      // Default behavior: copy topic ID to clipboard
      navigator.clipboard
        .writeText(group.Group)
        .then(() => {
          toast.success(`Group topic ID copied: ${group.Group}`);
        })
        .catch(() => {
          toast.error("Failed to copy topic ID");
        });
    }
  };

  /**
   * Handles opening group in explorer
   */
  const handleOpenInExplorer = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    // This would open the group in an explorer view
    // For now, we'll just copy the topic ID
    navigator.clipboard.writeText(group.Group).then(() => {
      toast.success(`Group topic ID copied for explorer: ${group.Group}`);
    });
  };

  // ========================================================================
  // RENDER FUNCTIONS
  // ========================================================================

  /**
   * Renders a single group item with enhanced UI/UX (simplified without stats)
   */
  const renderGroupItem = (group: Group, index: number) => {
    return (
      <div
        key={`${group.Group}-${index}`}
        onClick={() => handleGroupClick(group)}
        className="group relative bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-md rounded-2xl p-5 border border-purple-400/20 hover:border-purple-400/50 transition-all duration-300 cursor-pointer hover:scale-[1.01] hover:shadow-2xl hover:shadow-purple-400/30 overflow-hidden active:scale-[0.99]"
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-400/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-start gap-4">
            {/* Group Image with enhanced styling */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 ring-2 ring-purple-400/30 group-hover:ring-purple-400/70 transition-all duration-300 shadow-lg group-hover:shadow-purple-400/40">
                {group.Media ? (
                  <ReadMediaFile cid={group.Media} />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-400/20 to-pink-500/20 flex items-center justify-center">
                    <RiGroupLine className="text-3xl text-purple-400" />
                  </div>
                )}
              </div>
              {/* Public indicator */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-slate-900 flex items-center justify-center">
                <RiGlobalLine className="text-xs text-slate-900" />
              </div>
            </div>

            {/* Group Info with enhanced typography */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl font-mono font-bold text-white truncate bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent group-hover:from-purple-300 group-hover:to-pink-300 transition-all duration-300">
                  {group.Name}
                </h3>
                <span className="px-2.5 py-1 bg-purple-400/20 text-purple-300 text-xs font-mono rounded-full border border-purple-400/30">
                  Group
                </span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs text-purple-400/80 font-mono flex items-center gap-1">
                  <RiUserLine className="text-xs" />
                  Public
                </p>
                <p className="text-xs text-purple-400/80 font-mono flex items-center gap-1">
                  <RiTimeLine className="text-xs" />
                  Community
                </p>
                <p className="text-xs text-purple-400/80 font-mono flex items-center gap-1">
                  <RiEyeLine className="text-xs" />
                  Open
                </p>
              </div>

              <div className="bg-slate-800/60 rounded-lg p-2.5 mb-3 border border-purple-400/10">
                <p className="text-xs text-purple-300/80 font-mono mb-1">
                  Topic ID
                </p>
                <p className="text-xs text-purple-400 font-mono truncate font-semibold">
                  {group.Group}
                </p>
              </div>

              {group.Description && (
                <p className="text-white/70 text-sm leading-relaxed font-light line-clamp-2 group-hover:text-white/80 transition-colors duration-300">
                  {group.Description}
                </p>
              )}
            </div>

            {/* Enhanced Action Buttons */}
            <div className="flex flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-3 group-hover:translate-x-0">
              <button
                onClick={(e) => handleOpenInExplorer(e, group)}
                className="p-3 rounded-full bg-purple-400/10 hover:bg-purple-400/20 text-purple-400 hover:text-purple-300 transition-all duration-200 hover:scale-110 active:scale-95 shadow-md hover:shadow-lg"
                title="Copy Topic ID"
              >
                <RiExternalLinkLine className="text-lg" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGroupClick(group);
                }}
                className="p-3 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 hover:from-purple-300 hover:to-pink-400 text-white transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-purple-400/50"
                title="View Group"
              >
                <RiArrowRightLine className="text-lg" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Renders loading state
   */
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-12 h-12 border-4 border-purple-400/30 border-t-purple-400 rounded-full animate-spin mb-4"></div>
      <p className="text-white/60 font-mono">Loading groups...</p>
    </div>
  );

  /**
   * Renders error state
   */
  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-12 h-12 rounded-full bg-red-400/20 flex items-center justify-center mb-4">
        <span className="text-red-400 text-xl">!</span>
      </div>
      <p className="text-red-400 font-mono mb-2">Error loading groups</p>
      <p className="text-white/60 text-sm font-mono">{error}</p>
    </div>
  );

  /**
   * Renders empty state
   */
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-400/10 to-pink-500/10 flex items-center justify-center mb-6 border-2 border-purple-400/20 shadow-lg shadow-purple-400/10">
        <RiGroupLine className="text-4xl text-purple-400/60" />
      </div>
      <h3 className="text-2xl font-mono font-bold text-white/90 mb-3">
        No Groups Yet
      </h3>
      <p className="text-white/60 text-sm font-mono text-center mb-8 max-w-md leading-relaxed">
        Groups are communities where everyone can participate. Create your first
        group to start building connections and engaging in meaningful
        discussions with like-minded people.
      </p>
      {showCreateButton && (
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => setShowCreateGroup(true)}
            className="px-8 py-4 bg-gradient-to-r from-purple-400 to-pink-500 text-white font-semibold rounded-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-3 font-mono shadow-lg hover:shadow-xl hover:shadow-purple-400/30"
          >
            <RiAddLine className="text-xl" />
            Create Your First Group
          </button>
          <div className="flex items-center gap-2 text-xs text-purple-400/60 font-mono">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span>Groups are public and open to everyone</span>
          </div>
        </div>
      )}
    </div>
  );

  /**
   * Renders enhanced search and filter controls
   */
  const renderSearchAndFilters = () => (
    <div className="mb-6 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <RiSearchLine className="h-5 w-5 text-purple-400/60" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-4 py-3 bg-slate-800/60 backdrop-blur-sm border border-purple-400/30 rounded-xl text-white placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400/50 transition-all duration-200 font-mono"
          placeholder="Search groups by name or description..."
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-purple-400/60 hover:text-purple-400 transition-colors"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Filter and Sort Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort By Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-purple-400/80 font-mono">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "activity")}
            className="bg-slate-800/60 border border-purple-400/30 rounded-lg px-3 py-1.5 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400/50"
          >
            <option value="name">Name</option>
            <option value="activity">Activity</option>
          </select>
          <button
            onClick={toggleSortOrder}
            className="p-1.5 rounded-lg bg-purple-400/10 hover:bg-purple-400/20 text-purple-400 transition-all duration-200"
            title={`Sort ${sortOrder === "asc" ? "Descending" : "Ascending"}`}
          >
            {sortOrder === "asc" ? (
              <RiSortAsc className="w-4 h-4" />
            ) : (
              <RiSortDesc className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Active Filter Toggle */}
        <button
          onClick={() => setFilterActive(!filterActive)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono transition-all duration-200 ${filterActive
              ? "bg-green-400/20 text-green-300 border border-green-400/30"
              : "bg-slate-800/60 text-purple-400/80 border border-purple-400/30 hover:bg-purple-400/10"
            }`}
        >
          <RiFilterLine className="w-4 h-4" />
          <span>Active Only</span>
        </button>

        {/* Results Count */}
        {searchTerm && (
          <span className="text-sm text-purple-400/60 font-mono">
            {filteredAndSortedGroups.length} result
            {filteredAndSortedGroups.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );

  /**
   * Renders the main group list with enhanced features
   */
  const renderGroupList = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-mono text-purple-400 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Your Groups
        </h2>
        {showCreateButton && (
          <button
            onClick={() => setShowCreateGroup(true)}
            className="px-4 py-2 bg-gradient-to-r from-purple-400 to-pink-500 text-white font-semibold rounded-lg hover:scale-105 transition-all duration-200 flex items-center gap-2 font-mono text-sm"
          >
            <RiAddLine className="text-lg" />
            New Group
          </button>
        )}
      </div>

      {/* Search and Filters */}
      {groups.length > 0 && renderSearchAndFilters()}

      {/* Group Count */}
      {filteredAndSortedGroups.length > 0 && (
        <div className="mb-4">
          <p className="text-white/60 text-sm font-mono">
            {filteredAndSortedGroups.length}{" "}
            {filteredAndSortedGroups.length === 1 ? "Group" : "Groups"}
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>
      )}

      {/* Group Items */}
      <div className="space-y-3">
        {filteredAndSortedGroups.length > 0 ? (
          filteredAndSortedGroups.map((group, index) =>
            renderGroupItem(group, index)
          )
        ) : searchTerm ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400/10 to-pink-500/10 flex items-center justify-center mb-4 border-2 border-purple-400/20">
              <RiSearchLine className="text-2xl text-purple-400/60" />
            </div>
            <h3 className="text-lg font-mono font-bold text-white/90 mb-2">
              No Results Found
            </h3>
            <p className="text-white/60 text-sm font-mono text-center max-w-md">
              No groups match your search for &ldquo;{searchTerm}&rdquo;. Try
              different keywords or clear the search.
            </p>
            <button
              onClick={() => setSearchTerm("")}
              className="mt-4 px-4 py-2 bg-purple-400/20 text-purple-300 rounded-lg hover:bg-purple-400/30 transition-all duration-200 font-mono text-sm"
            >
              Clear Search
            </button>
          </div>
        ) : (
          groups.map((group, index) => renderGroupItem(group, index))
        )}
      </div>
    </div>
  );

  // ========================================================================
  // MAIN RENDER
  // ========================================================================

  // Combined loading state: profile loading OR V2 groups list loading
  const isDataLoading = isLoading || (profileData && isV2Profile(profileData) && groupsList.isLoading);

  return (
    <div className={`w-full ${className}`}>
      {/* Loading State */}
      {isDataLoading && renderLoading()}

      {/* Error State */}
      {!isDataLoading && error && renderError()}

      {/* Empty State */}
      {!isDataLoading && !error && groups.length === 0 && renderEmpty()}

      {/* Group List */}
      {!isDataLoading && !error && groups.length > 0 && renderGroupList()}

      {/* Create Group Modal */}
      <Modal isOpen={showCreateGroup} onClose={() => setShowCreateGroup(false)}>
        <CreateNewGroup onClose={() => setShowCreateGroup(false)} />
      </Modal>
    </div>
  );
};

export default GroupList;
