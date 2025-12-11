import { useState, useCallback } from "react";
import { RateLimitResult } from "../types";

interface UseNanoAndTransferProps {
  hasApiKey: boolean;
  canGenerate: () => RateLimitResult;
  generateNanoOutfit: (occasion: string, modelImageUrl: string) => Promise<void>;
  generateOutfitTransfer: (file: File, modelImageUrl: string) => Promise<void>;
  modelImageUrl: string;
}

/**
 * Custom hook to manage Nano Banana styling and Outfit Transfer features
 */
export function useNanoAndTransfer({
  hasApiKey,
  canGenerate,
  generateNanoOutfit,
  generateOutfitTransfer,
  modelImageUrl,
}: UseNanoAndTransferProps) {
  const [showNanoWindow, setShowNanoWindow] = useState<boolean>(false);
  const [nanoText, setNanoText] = useState<string>("");
  const [showOutfitTransferWindow, setShowOutfitTransferWindow] = useState<boolean>(false);

  // Handle nano banana styling
  const handleNanoStyle = useCallback(async () => {
    if (!nanoText.trim()) {
      alert("Please enter what you want to wear to!");
      return;
    }

    if (!hasApiKey) {
      alert("Google API key required for styling");
      return;
    }

    const rateLimitCheck: RateLimitResult = canGenerate();
    if (!rateLimitCheck.allowed) {
      alert(`Rate limited: ${rateLimitCheck.reason}`);
      return;
    }

    // Close the popup immediately when user clicks "Style Me!"
    setShowNanoWindow(false);
    const occasionText = nanoText;
    setNanoText(""); // Clear the text

    try {
      await generateNanoOutfit(occasionText, modelImageUrl);
    } catch (error: any) {
      console.error("Error in nano styling:", error);
      // Error handling is already done in the hook
    }
  }, [nanoText, hasApiKey, canGenerate, generateNanoOutfit, modelImageUrl]);

  // Handle outfit transfer
  const handleOutfitTransfer = useCallback(
    async (file: File) => {
      if (!hasApiKey) {
        alert("Google API key required for outfit transfer");
        return;
      }

      const rateLimitCheck: RateLimitResult = canGenerate();
      if (!rateLimitCheck.allowed) {
        alert(`Rate limited: ${rateLimitCheck.reason}`);
        return;
      }

      try {
        await generateOutfitTransfer(file, modelImageUrl);
      } catch (error: any) {
        // Error handling is already done in the hook
      }
    },
    [hasApiKey, canGenerate, generateOutfitTransfer, modelImageUrl]
  );

  return {
    showNanoWindow,
    setShowNanoWindow,
    nanoText,
    setNanoText,
    handleNanoStyle,
    showOutfitTransferWindow,
    setShowOutfitTransferWindow,
    handleOutfitTransfer,
  };
}

