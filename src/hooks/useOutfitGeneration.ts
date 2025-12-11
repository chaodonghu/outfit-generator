import { useState, useCallback, useEffect, useRef } from "react";
import {
  outfitGenerator,
  OutfitGenerationResult,
} from "../services/outfitGenerator";
import { imageComposer } from "../services/imageComposer";
import { rateLimiter } from "../services/rateLimiter";
import type {
  ClothingItem,
  RateLimitResult,
  UseOutfitGenerationReturn,
} from "../types";

export function useOutfitGeneration(): UseOutfitGenerationReturn {
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiRequired, setApiRequired] = useState<boolean>(false);
  const [isComposite, setIsComposite] = useState<boolean>(false);

  const inFlightRef = useRef(false); // synchronous guard against rapid double-clicks
  const cacheRef = useRef<Map<string, { url: string; isComposite: boolean }>>(
    new Map()
  );

  // Check API key availability
  useEffect(() => {
    const hasValidApiKey = Boolean(
      import.meta.env.VITE_GOOGLE_API_KEY &&
        import.meta.env.VITE_GOOGLE_API_KEY !== "your_google_api_key_here"
    );
    setApiRequired(!hasValidApiKey);
  }, []);

  const canGenerate = useCallback((): RateLimitResult => {
    return rateLimiter.canMakeCall();
  }, []);

  const generateOutfit = useCallback(
    async (top: ClothingItem, bottom: ClothingItem, modelImageUrl?: string, shoes?: ClothingItem) => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;

      // Use item IDs and model URL for cache key
      const modelKey = modelImageUrl || "default";
      const shoesKey = shoes ? `::${shoes.id}` : "";
      const key = `outfit::${top.id}::${bottom.id}${shoesKey}::${modelKey}`;
      if (cacheRef.current.has(key)) {
        const cached = cacheRef.current.get(key)!;
        setGeneratedImage(cached.url);
        setIsComposite(cached.isComposite);
        setError(null);
        inFlightRef.current = false;
        return;
      }

      // Check rate limit first
      const rateLimitCheck = canGenerate();
      if (!rateLimitCheck.allowed) {
        setError(rateLimitCheck.reason || "Rate limit exceeded");
        setGeneratedImage(null);
        setIsComposite(false);
        inFlightRef.current = false;
        return;
      }

      setIsGenerating(true);
      setError(null);
      setIsComposite(false);

      try {
        // Record the API call
        rateLimiter.recordCall();

        // Try AI generation first
        const result: OutfitGenerationResult =
          await outfitGenerator.generateOutfit(
            top.imageUrl,
            bottom.imageUrl,
            modelImageUrl || "/assets/model.png",
            top.id,
            bottom.id,
            shoes?.imageUrl,
            shoes?.id
          );

        if (result.success && result.imageUrl) {
          setGeneratedImage(result.imageUrl);
          setIsComposite(false);
          cacheRef.current.set(key, {
            url: result.imageUrl,
            isComposite: false,
          });
        } else {
          // Fallback to composite image
          const compositeResult = await imageComposer.createComposite(
            top.imageUrl,
            bottom.imageUrl
          );

          if (compositeResult.success && compositeResult.imageUrl) {
            setGeneratedImage(compositeResult.imageUrl);
            setIsComposite(true);
            setError("Using composite image (AI generation unavailable)");
            cacheRef.current.set(key, {
              url: compositeResult.imageUrl,
              isComposite: true,
            });
          } else {
            throw new Error(
              compositeResult.error || "Failed to create composite image"
            );
          }
        }
      } catch (err) {
        setError("Failed to generate outfit. Please try again.");
        setGeneratedImage(null);
        setIsComposite(false);
      } finally {
        setIsGenerating(false);
        inFlightRef.current = false;
      }
    },
    [canGenerate]
  );

  const generateNanoOutfit = useCallback(
    async (occasion: string, modelImageUrl?: string) => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;

      // Use occasion and model URL for cache key
      const modelKey = modelImageUrl || "default";
      const key = `nano::${occasion}::${modelKey}`;
      if (cacheRef.current.has(key)) {
        const cached = cacheRef.current.get(key)!;
        setGeneratedImage(cached.url);
        setIsComposite(false); // Nano outfits are always AI-generated
        setError(null);
        inFlightRef.current = false;
        return;
      }

      // Check rate limit first
      const rateLimitCheck = canGenerate();
      if (!rateLimitCheck.allowed) {
        setError(rateLimitCheck.reason || "Rate limit exceeded");
        setGeneratedImage(null);
        setIsComposite(false);
        inFlightRef.current = false;
        return;
      }

      setIsGenerating(true);
      setError(null);
      setIsComposite(false);

      try {
        // Record the API call
        rateLimiter.recordCall();

        // Call the nano outfit generator
        const result: OutfitGenerationResult =
          await outfitGenerator.generateNanoOutfit(
            occasion,
            modelImageUrl || "/assets/model.png"
          );

        if (result.success && result.imageUrl) {
          setGeneratedImage(result.imageUrl);
          setIsComposite(false);
          cacheRef.current.set(key, {
            url: result.imageUrl,
            isComposite: false,
          });
        } else {
          throw new Error(result.error || "Failed to generate nano outfit");
        }
      } catch (err) {
        setError("Failed to generate nano outfit. Please try again.");
        setGeneratedImage(null);
        setIsComposite(false);
      } finally {
        setIsGenerating(false);
        inFlightRef.current = false;
      }
    },
    [canGenerate]
  );

  const generateOutfitTransfer = useCallback(
    async (inspirationFile: File, modelImageUrl?: string) => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;

      // Create a temporary URL for the file
      const inspirationUrl = URL.createObjectURL(inspirationFile);

      // Use file name, size, and model URL for cache key
      const modelKey = modelImageUrl || "default";
      const key = `transfer::${inspirationFile.name}::${inspirationFile.size}::${modelKey}`;
      if (cacheRef.current.has(key)) {
        const cached = cacheRef.current.get(key)!;
        setGeneratedImage(cached.url);
        setIsComposite(false); // Transfer outfits are always AI-generated
        setError(null);
        inFlightRef.current = false;
        URL.revokeObjectURL(inspirationUrl);
        return;
      }

      // Check rate limit first
      const rateLimitCheck = canGenerate();
      if (!rateLimitCheck.allowed) {
        setError(rateLimitCheck.reason || "Rate limit exceeded");
        setGeneratedImage(null);
        setIsComposite(false);
        inFlightRef.current = false;
        URL.revokeObjectURL(inspirationUrl);
        return;
      }

      setIsGenerating(true);
      setError(null);
      setIsComposite(false);

      try {
        // Record the API call
        rateLimiter.recordCall();

        // Call the outfit transfer generator
        const result: OutfitGenerationResult =
          await outfitGenerator.generateOutfitTransfer(
            inspirationUrl,
            modelImageUrl || "/assets/model.png"
          );

        if (result.success && result.imageUrl) {
          setGeneratedImage(result.imageUrl);
          setIsComposite(false);
          cacheRef.current.set(key, {
            url: result.imageUrl,
            isComposite: false,
          });
        } else {
          throw new Error(result.error || "Failed to transfer outfit");
        }
      } catch (err) {
        setError("Failed to transfer outfit. Please try again.");
        setGeneratedImage(null);
        setIsComposite(false);
      } finally {
        setIsGenerating(false);
        inFlightRef.current = false;
        URL.revokeObjectURL(inspirationUrl);
      }
    },
    [canGenerate]
  );

  const clearGeneratedImage = useCallback(() => {
    setGeneratedImage(null);
    setIsComposite(false);
    setError(null);
  }, []);

  return {
    generatedImage,
    isGenerating,
    error,
    apiRequired,
    isComposite,
    generateOutfit,
    generateNanoOutfit,
    generateOutfitTransfer,
    clearGeneratedImage,
    canGenerate,
  };
}
