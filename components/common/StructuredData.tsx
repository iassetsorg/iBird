import Head from "next/head";
import React from "react";

/**
 * StructuredData Component
 * Injects JSON-LD structured data for SEO and rich snippets
 * Helps search engines and AI systems understand the content
 */

interface OrganizationSchema {
    type: "Organization";
    name: string;
    description: string;
    url: string;
    logo?: string;
    sameAs?: string[];
}

interface WebSiteSchema {
    type: "WebSite";
    name: string;
    url: string;
    description: string;
    potentialAction?: {
        type: string;
        target: string;
        queryInput: string;
    };
}

interface SocialMediaPostingSchema {
    type: "SocialMediaPosting";
    headline?: string;
    articleBody: string;
    author: {
        type: string;
        name: string;
        url?: string;
    };
    datePublished: string;
    dateModified?: string;
    image?: string;
    url?: string;
    publisher: {
        type: string;
        name: string;
        logo?: string;
    };
}

interface WebPageSchema {
    type: "WebPage";
    name: string;
    description: string;
    url: string;
    isPartOf: {
        type: string;
        name: string;
        url: string;
    };
}

type SchemaType =
    | OrganizationSchema
    | WebSiteSchema
    | SocialMediaPostingSchema
    | WebPageSchema;

interface StructuredDataProps {
    schema: SchemaType;
}

/**
 * Converts internal schema type to JSON-LD format
 */
function generateJsonLd(schema: SchemaType): object {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ibird.io";

    switch (schema.type) {
        case "Organization":
            return {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: schema.name,
                description: schema.description,
                url: schema.url,
                logo: schema.logo || `${baseUrl}/icon.png`,
                sameAs: schema.sameAs || [],
            };

        case "WebSite":
            return {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: schema.name,
                url: schema.url,
                description: schema.description,
                potentialAction: schema.potentialAction
                    ? {
                        "@type": schema.potentialAction.type,
                        target: schema.potentialAction.target,
                        "query-input": schema.potentialAction.queryInput,
                    }
                    : undefined,
            };

        case "SocialMediaPosting":
            return {
                "@context": "https://schema.org",
                "@type": "SocialMediaPosting",
                headline: schema.headline || schema.articleBody.substring(0, 110),
                articleBody: schema.articleBody,
                author: {
                    "@type": schema.author.type,
                    name: schema.author.name,
                    url: schema.author.url,
                },
                datePublished: schema.datePublished,
                dateModified: schema.dateModified || schema.datePublished,
                image: schema.image,
                url: schema.url,
                publisher: {
                    "@type": schema.publisher.type,
                    name: schema.publisher.name,
                    logo: {
                        "@type": "ImageObject",
                        url: schema.publisher.logo || `${baseUrl}/icon.png`,
                    },
                },
                mainEntityOfPage: {
                    "@type": "WebPage",
                    "@id": schema.url,
                },
            };

        case "WebPage":
            return {
                "@context": "https://schema.org",
                "@type": "WebPage",
                name: schema.name,
                description: schema.description,
                url: schema.url,
                isPartOf: {
                    "@type": schema.isPartOf.type,
                    name: schema.isPartOf.name,
                    url: schema.isPartOf.url,
                },
            };

        default:
            return {};
    }
}

/**
 * StructuredData component that injects JSON-LD into the page head
 */
const StructuredData: React.FC<StructuredDataProps> = ({ schema }) => {
    const jsonLd = generateJsonLd(schema);

    return (
        <Head>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
        </Head>
    );
};

/**
 * Pre-configured structured data for common page types
 */
export const getOrganizationSchema = (): OrganizationSchema => ({
    type: "Organization",
    name: "iBird",
    description:
        "A decentralized social media platform built on the Hedera network. Share posts, create threads, and engage with content stored immutably on blockchain.",
    url: process.env.NEXT_PUBLIC_BASE_URL || "https://ibird.io",
    logo: `${process.env.NEXT_PUBLIC_BASE_URL || "https://ibird.io"}/icon.png`,
    sameAs: [],
});

export const getWebSiteSchema = (): WebSiteSchema => ({
    type: "WebSite",
    name: "iBird",
    url: process.env.NEXT_PUBLIC_BASE_URL || "https://ibird.io",
    description:
        "Decentralized social platform on Hedera. Post, share, and engage with blockchain-stored content.",
});

export const getWebPageSchema = (
    name: string,
    description: string,
    path: string
): WebPageSchema => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ibird.io";
    return {
        type: "WebPage",
        name,
        description,
        url: `${baseUrl}${path}`,
        isPartOf: {
            type: "WebSite",
            name: "iBird",
            url: baseUrl,
        },
    };
};

export const getPostSchema = (
    content: string,
    authorId: string,
    timestamp: string,
    postId: string,
    imageUrl?: string
): SocialMediaPostingSchema => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ibird.io";
    const date = new Date(parseFloat(timestamp) * 1000).toISOString();

    return {
        type: "SocialMediaPosting",
        headline: content.substring(0, 110),
        articleBody: content,
        author: {
            type: "Person",
            name: authorId,
            url: `${baseUrl}/profile?id=${authorId}`,
        },
        datePublished: date,
        dateModified: date,
        image: imageUrl,
        url: `${baseUrl}/post/${postId}`,
        publisher: {
            type: "Organization",
            name: "iBird",
            logo: `${baseUrl}/icon.png`,
        },
    };
};

export default StructuredData;
export type {
    OrganizationSchema,
    WebSiteSchema,
    SocialMediaPostingSchema,
    WebPageSchema,
    SchemaType,
};
