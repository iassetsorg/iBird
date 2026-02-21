/**
 * Profile Page - Next.js page component for user profile management
 *
 * This page provides a complete profile management interface including:
 * - Viewing existing profile information
 * - Creating a new profile if none exists
 * - Updating existing profile information
 * - Displaying user's media and activity
 *
 * The page integrates with Hedera Hashgraph for decentralized profile storage
 * and uses Arweave for media storage.
 */

import React from "react";
import Profile from "../components/profile/profile";

/**
 * Profile Page Component
 *
 * This is the main page component that renders the Profile component.
 * It serves as the entry point for the /profile route in the Next.js application.
 *
 * @returns {JSX.Element} The rendered profile page
 */
const ProfilePage: React.FC = () => {
  return <Profile />;
};

export default ProfilePage;
