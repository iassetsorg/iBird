/**
 * Custom hook to fetch and manage ASSET token balance for a Hedera account.
 * Uses MirrorNode API to retrieve token balances with proper BigInt precision handling.
 *
 * @returns Object with balance, loading state, error, and helper functions
 */
import { useState, useEffect, useCallback } from "react";
import { useAccountId } from "@buidlerlabs/hashgraph-react-wallets";

// Default ASSET Token IDs
const MAINNET_ASSET_TOKEN_ID = "0.0.1991880";
const TESTNET_ASSET_TOKEN_ID = process.env.NEXT_PUBLIC_TOKEN_ID || "0.0.7361419";

// ASSET Token Configuration - reads from environment variables
const ASSET_TOKEN_CONFIG = {
    mainnet: {
        tokenId: process.env.NEXT_PUBLIC_MAINNET_ASSET_TOKEN_ID || MAINNET_ASSET_TOKEN_ID,
        mirrorNodeUrl: "https://mainnet.mirrornode.hedera.com/api/v1",
        saucerSwapUrl: `https://www.saucerswap.finance/swap/HBAR/${process.env.NEXT_PUBLIC_MAINNET_ASSET_TOKEN_ID || MAINNET_ASSET_TOKEN_ID}`,
    },
    testnet: {
        tokenId: TESTNET_ASSET_TOKEN_ID,
        mirrorNodeUrl: "https://testnet.mirrornode.hedera.com/api/v1",
        saucerSwapUrl: `https://www.saucerswap.finance/swap/HBAR/${TESTNET_ASSET_TOKEN_ID}`,
    },
};

// Posting fee requirements (in ASSET tokens - human readable)
// Read from environment variables with defaults
export const POSTING_FEES = {
    explorer: parseInt(process.env.NEXT_PUBLIC_EXPLORER_FEE || "1000", 10),
    billboard: parseInt(process.env.NEXT_PUBLIC_BILLBOARD_FEE || "10000", 10),
} as const;

// Token decimals for ASSET (6 decimals based on tip.tsx multiplier of 1_000_000)
const ASSET_DECIMALS = 6;

interface AssetBalanceState {
    rawBalance: bigint;
    displayBalance: string;
    isLoading: boolean;
    error: string | null;
    hasEnoughForExplorer: boolean;
    hasEnoughForBillboard: boolean;
}

interface UseAssetBalanceReturn extends AssetBalanceState {
    refetch: () => Promise<void>;
    checkBalance: (requiredAmount: number) => boolean;
    getAssetTokenId: () => string;
    getSaucerSwapUrl: () => string;
}

/**
 * Converts a raw token balance (in the smallest denomination) to a human-readable format.
 * Uses BigInt for guaranteed precision.
 * @param rawBalance - The raw balance amount (as a string, number, or BigInt)
 * @param decimals - The token's precision
 * @returns The human-readable balance as a number
 */
function scaleTokenBalance(rawBalance: string | number | bigint, decimals: number): number {
    let balanceBigInt: bigint;

    if (typeof rawBalance === "bigint") {
        balanceBigInt = rawBalance;
    } else if (typeof rawBalance === "number") {
        balanceBigInt = BigInt(Math.floor(rawBalance));
    } else {
        balanceBigInt = BigInt(rawBalance);
    }

    const divisor = BigInt(10) ** BigInt(decimals);

    // Calculate integer part and fractional part
    const integerPart = balanceBigInt / divisor;
    const fractionalPartRaw = balanceBigInt % divisor;

    // Pad fractional part with leading zeros to match the decimal length
    const fractionalPartPadded = fractionalPartRaw.toString().padStart(decimals, "0");

    // Combine and return as number
    return parseFloat(`${integerPart}.${fractionalPartPadded}`);
}

/**
 * Gets the current network configuration
 */
function getNetworkConfig() {
    const network = process.env.NEXT_PUBLIC_NETWORK || "mainnet";
    return network === "mainnet" ? ASSET_TOKEN_CONFIG.mainnet : ASSET_TOKEN_CONFIG.testnet;
}

/**
 * Custom hook to manage ASSET token balance
 */
const useAssetBalance = (): UseAssetBalanceReturn => {
    const { data: accountId } = useAccountId();

    const [state, setState] = useState<AssetBalanceState>({
        rawBalance: BigInt(0),
        displayBalance: "0",
        isLoading: false,
        error: null,
        hasEnoughForExplorer: false,
        hasEnoughForBillboard: false,
    });

    /**
     * Fetches all token associations and balances for a given account ID.
     */
    const fetchAccountTokens = async (accountIdStr: string, baseUrl: string) => {
        const url = `${baseUrl}/accounts/${accountIdStr}/tokens`;

        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error("Rate limit exceeded. Please try again later.");
            }
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (data.tokens && Array.isArray(data.tokens)) {
            return data.tokens;
        }

        return [];
    };

    /**
     * Fetches specific metadata (like decimals) for a token ID (fallback).
     */
    const fetchTokenMetadata = async (tokenId: string, baseUrl: string): Promise<number | null> => {
        const url = `${baseUrl}/tokens/${tokenId}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                return null;
            }

            const data = await response.json();

            if (data && data.decimals !== undefined) {
                return data.decimals;
            }

            return null;
        } catch {
            console.warn(`Failed to retrieve metadata for token ${tokenId}.`);
            return null;
        }
    };

    /**
     * Main function to fetch ASSET token balance
     */
    const fetchAssetBalance = useCallback(async () => {
        if (!accountId) {
            setState((prev) => ({
                ...prev,
                rawBalance: BigInt(0),
                displayBalance: "0",
                isLoading: false,
                error: null,
                hasEnoughForExplorer: false,
                hasEnoughForBillboard: false,
            }));
            return;
        }

        const config = getNetworkConfig();

        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
            // Fetch all tokens for the account
            const tokenList = await fetchAccountTokens(accountId, config.mirrorNodeUrl);

            // Find ASSET token in the list
            const assetToken = tokenList.find(
                (token: { token_id: string }) => token.token_id === config.tokenId
            );

            if (!assetToken) {
                // User doesn't have ASSET token associated or has 0 balance
                setState({
                    rawBalance: BigInt(0),
                    displayBalance: "0",
                    isLoading: false,
                    error: null,
                    hasEnoughForExplorer: false,
                    hasEnoughForBillboard: false,
                });
                return;
            }

            const rawBalance = assetToken.balance;
            let decimals = assetToken.decimals;

            // Fallback: fetch decimals from token metadata if not in response
            if (decimals === undefined || decimals === null) {
                decimals = await fetchTokenMetadata(config.tokenId, config.mirrorNodeUrl);
            }

            // Use known decimals if metadata fetch failed
            if (decimals === null || decimals === undefined) {
                decimals = ASSET_DECIMALS;
            }

            // Scale the balance using BigInt for precision
            const rawBalanceBigInt = BigInt(rawBalance);
            const displayBalanceNum = scaleTokenBalance(rawBalanceBigInt, decimals);

            setState({
                rawBalance: rawBalanceBigInt,
                displayBalance: displayBalanceNum.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                }),
                isLoading: false,
                error: null,
                hasEnoughForExplorer: displayBalanceNum >= POSTING_FEES.explorer,
                hasEnoughForBillboard: displayBalanceNum >= POSTING_FEES.billboard,
            });
        } catch (error) {
            console.error("Error fetching ASSET balance:", error);
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error.message : "Failed to fetch balance",
            }));
        }
    }, [accountId]);

    /**
     * Check if user has enough balance for a specific amount
     */
    const checkBalance = useCallback(
        (requiredAmount: number): boolean => {
            const rawBalanceBigInt = state.rawBalance;
            const decimals = ASSET_DECIMALS;
            const displayBalance = scaleTokenBalance(rawBalanceBigInt, decimals);
            return displayBalance >= requiredAmount;
        },
        [state.rawBalance]
    );

    /**
     * Get ASSET token ID for current network
     */
    const getAssetTokenId = useCallback((): string => {
        return getNetworkConfig().tokenId;
    }, []);

    /**
     * Get SaucerSwap URL for buying ASSET
     */
    const getSaucerSwapUrl = useCallback((): string => {
        return getNetworkConfig().saucerSwapUrl;
    }, []);

    // Fetch balance on mount and when accountId changes
    useEffect(() => {
        fetchAssetBalance();
    }, [fetchAssetBalance]);

    return {
        ...state,
        refetch: fetchAssetBalance,
        checkBalance,
        getAssetTokenId,
        getSaucerSwapUrl,
    };
};

export default useAssetBalance;
