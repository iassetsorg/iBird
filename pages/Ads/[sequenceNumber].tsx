/**
 * Shared Ad Page
 * Allows users to view an ad via shareable URL: /Ads/[sequenceNumber]
 * This page renders the shared ad in a modal with proper SEO
 */

import React from "react";
import Modal from "../../components/common/modal";
import { useRouter } from "next/router";
import ReadAd from "../../components/billboard/read_ad";
import SEOHead from "../../components/common/SEOHead";
import type { Message } from "../../components/hooks/use_get_data";

function ReadSharedAd() {
    const router = useRouter();

    // Extract sequence number from URL parameters
    const sequenceNumber = router.query.sequenceNumber as string | undefined;

    // Default SEO configuration for ad
    const seoConfig = {
        title: "Ad - iBird",
        description: "View this ad on iBird",
    };

    /**
     * Handles modal close action
     * Navigates user to the main app page
     */
    const closeModal = () => {
        router.push("/app");
    };

    return (
        <>
            <SEOHead seoConfig={seoConfig} />
            <Modal isOpen={true} onClose={closeModal}>
                <div className="bg-gradient-to-br from-slate-900 via-yellow-900/20 to-slate-900 backdrop-blur-xl p-4 sm:p-6 rounded-2xl border border-yellow-400/30 shadow-2xl shadow-yellow-400/20 max-w-4xl max-h-[90vh] overflow-y-auto">
                    {sequenceNumber ? (
                        <ReadAd
                            message={
                                {
                                    sequence_number: parseInt(sequenceNumber),
                                    sender: "",
                                    message_id: "",
                                    Message: "",
                                    consensus_timestamp: "",
                                    Type: "Ad",
                                } as Message
                            }
                        />
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-yellow-400/80 font-mono">Ad not found</p>
                        </div>
                    )}
                </div>
            </Modal>
        </>
    );
}

export default function SharedAdPage() {
    return <ReadSharedAd />;
}
