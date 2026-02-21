import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Sitemap API Route
 * Generates a dynamic XML sitemap by fetching messages from Hedera Mirror Node
 * This helps search engines discover and index content on iBird
 */

interface HederaMessage {
    consensus_timestamp: string;
    sequence_number: number;
    message: string;
}

interface ParsedMessage {
    type: string;
    timestamp: string;
    id: string;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://ibird.io";
    const network = process.env.NEXT_PUBLIC_NETWORK || "mainnet";
    const explorerTopicId = process.env.NEXT_PUBLIC_EXPLORER_ID || "0.0.10214045";

    const mirrorNodeUrl =
        network === "mainnet"
            ? "https://mainnet.mirrornode.hedera.com"
            : "https://testnet.mirrornode.hedera.com";

    try {
        // Fetch recent messages from Hedera Mirror Node
        const response = await fetch(
            `${mirrorNodeUrl}/api/v1/topics/${explorerTopicId}/messages?order=desc&limit=100`
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch from Mirror Node: ${response.status}`);
        }

        const data = await response.json();
        const messages: ParsedMessage[] = [];

        // Parse messages to extract type and create URLs
        for (const msg of data.messages as HederaMessage[]) {
            try {
                const decodedMessage = Buffer.from(msg.message, "base64").toString(
                    "utf-8"
                );
                const parsed = JSON.parse(decodedMessage);

                if (parsed.Type) {
                    messages.push({
                        type: parsed.Type,
                        timestamp: msg.consensus_timestamp,
                        id: msg.sequence_number.toString(),
                    });
                }
            } catch {
                // Skip invalid messages
                continue;
            }
        }

        // Generate XML sitemap
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static Pages -->
  <url>
    <loc>${baseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/app</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/profile</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/how-it-works</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <!-- Dynamic Content from Hedera -->
  ${messages
                .map((msg) => {
                    const lastmod = new Date(
                        parseFloat(msg.timestamp) * 1000
                    ).toISOString();
                    const urlPath =
                        msg.type === "Post"
                            ? `/post/${msg.id}`
                            : msg.type === "Thread"
                                ? `/thread/${msg.id}`
                                : msg.type === "Poll"
                                    ? `/poll/${msg.id}`
                                    : null;

                    if (!urlPath) return "";

                    return `
  <url>
    <loc>${baseUrl}${urlPath}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
                })
                .join("")}
</urlset>`;

        // Set proper headers for XML
        res.setHeader("Content-Type", "application/xml");
        res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600"); // Cache for 1 hour
        res.status(200).send(sitemap);
    } catch (error) {
        console.error("Sitemap generation error:", error);

        // Return a basic sitemap on error
        const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/app</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

        res.setHeader("Content-Type", "application/xml");
        res.status(200).send(fallbackSitemap);
    }
}
