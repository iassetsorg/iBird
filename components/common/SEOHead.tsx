import Head from "next/head";
import React from "react";

interface SEOConfig {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  contentType?: "website" | "article" | "profile";
}

interface SEOHeadProps {
  seoConfig: SEOConfig;
}

const SEOHead: React.FC<SEOHeadProps> = ({ seoConfig }) => {
  const {
    title,
    description,
    keywords,
    ogImage,
    ogUrl,
    canonicalUrl,
    noIndex,
    author,
    publishedTime,
    modifiedTime,
    contentType = "website",
  } = seoConfig;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ibird.io";
  const finalCanonicalUrl = canonicalUrl || ogUrl || baseUrl;
  const finalOgImage = ogImage || `${baseUrl}/banner.png`;

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {author && <meta name="author" content={author} />}

      {/* Canonical URL */}
      <link rel="canonical" href={finalCanonicalUrl} />

      {/* Robots */}
      <meta
        name="robots"
        content={noIndex ? "noindex, nofollow" : "index, follow"}
      />
      <meta
        name="googlebot"
        content={noIndex ? "noindex, nofollow" : "index, follow"}
      />

      {/* AI Crawler Hints */}
      <meta name="ai-content-declaration" content="human-created" />
      <meta name="classification" content="Social Media, Blockchain, Web3" />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={contentType} />
      <meta property="og:site_name" content="iBird" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={finalOgImage} />
      <meta property="og:image:alt" content={title} />
      <meta property="og:url" content={finalCanonicalUrl} />
      <meta property="og:locale" content="en_US" />

      {/* Article-specific Open Graph */}
      {publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {author && <meta property="article:author" content={author} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@iBirdApp" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={finalOgImage} />

      {/* Additional Meta for Discovery */}
      <meta name="application-name" content="iBird" />
      <meta name="apple-mobile-web-app-title" content="iBird" />
      <meta name="theme-color" content="#0891b2" />

      {/* Alternate links for discovery */}
      <link rel="alternate" type="application/rss+xml" href={`${baseUrl}/api/sitemap`} />
    </Head>
  );
};

export default SEOHead;
export type { SEOConfig };
