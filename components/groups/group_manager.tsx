/**
 * GroupManager is a component that manages group list and view states.
 * Features:
 * - Navigation between group list and individual group views
 * - Group creation functionality
 * - Message viewing and sending in groups
 * - State management for navigation
 */

import React, { useState } from "react";
import GroupList from "./group_list";
import GroupView from "./group_view";
import CreateNewGroup from "./create_new_group";
import Modal from "../common/modal";
import { toast } from "react-toastify";

/**
 * Group Interface
 */
interface Group {
  Name: string;
  Group: string;
  Description: string;
  Media: string;
}

/**
 * GroupManager component handles navigation between group list and view states
 */
function GroupManager() {
  // State management for navigation
  const [currentView, setCurrentView] = useState<"list" | "view">("list");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  /**
   * Handle group selection from list
   */
  const handleGroupClick = (group: Group) => {
    setSelectedGroup(group);
    setCurrentView("view");
  };

  /**
   * Handle navigation back to group list
   */
  const handleBackToList = () => {
    setCurrentView("list");
    setSelectedGroup(null);
  };

  /**
   * Handle successful group creation
   */
  const handleGroupCreated = () => {
    setShowCreateGroup(false);
    toast.success("Group created successfully!");
    // Refresh the group list by triggering a re-render
    setCurrentView("list");
  };

  return (
    <div className="h-full w-full bg-slate-900/80 backdrop-blur-md">
      {/* Group List View */}
      {currentView === "list" && (
        <div className="h-full p-6">
          <GroupList showCreateButton={true} onGroupClick={handleGroupClick} />
        </div>
      )}

      {/* Group View */}
      {currentView === "view" && selectedGroup && (
        <GroupView
          groupId={selectedGroup.Group}
          groupName={selectedGroup.Name}
          groupMedia={selectedGroup.Media}
          onBack={handleBackToList}
        />
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <Modal
          isOpen={showCreateGroup}
          onClose={() => setShowCreateGroup(false)}
        >
          <CreateNewGroup onClose={handleGroupCreated} />
        </Modal>
      )}
    </div>
  );
}

export default GroupManager;
