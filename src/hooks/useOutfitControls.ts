import { useState, useEffect, useCallback } from "react";
import { LocalClothingItem, RateLimitResult } from "../types";

interface CarouselControls {
  index: number;
  setIndex: (index: number) => void;
}

interface UseOutfitControlsProps {
  topsList: LocalClothingItem[];
  bottomsList: LocalClothingItem[];
  shoesList: LocalClothingItem[];
  topsCarousel: CarouselControls;
  bottomsCarousel: CarouselControls;
  shoesCarousel: CarouselControls;
  hasApiKey: boolean;
  canGenerate: () => RateLimitResult;
  generateOutfit: (
    topItem: LocalClothingItem,
    bottomItem: LocalClothingItem,
    modelImageUrl: string,
    shoeItem?: LocalClothingItem
  ) => Promise<void>;
  isGenerating: boolean;
  modelImageUrl: string;
}

/**
 * Custom hook to manage outfit generation controls (random, select)
 */
export function useOutfitControls({
  topsList,
  bottomsList,
  shoesList,
  topsCarousel,
  bottomsCarousel,
  shoesCarousel,
  hasApiKey,
  canGenerate,
  generateOutfit,
  isGenerating,
  modelImageUrl,
}: UseOutfitControlsProps) {
  const [previewTop, setPreviewTop] = useState<number>(0);
  const [previewBottom, setPreviewBottom] = useState<number>(0);
  const [previewShoes, setPreviewShoes] = useState<number>(0);
  const [generationProgress, setGenerationProgress] = useState<number>(0);

  // Update preview when carousel changes
  useEffect(() => {
    setPreviewTop(topsCarousel.index);
  }, [topsCarousel.index]);

  useEffect(() => {
    setPreviewBottom(bottomsCarousel.index);
  }, [bottomsCarousel.index]);

  useEffect(() => {
    setPreviewShoes(shoesCarousel.index);
  }, [shoesCarousel.index]);

  // Progress animation effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isGenerating) {
      setGenerationProgress(0);

      interval = setInterval(() => {
        setGenerationProgress((prev) => {
          // Gradually increase progress, slowing down as it approaches 95%
          const increment = Math.max(1, Math.floor((100 - prev) * 0.1));
          const newProgress = Math.min(prev + increment, 95);
          return newProgress;
        });
      }, 200);
    } else {
      setGenerationProgress(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isGenerating]);

  // Handle random selection
  const handleRandom = useCallback(() => {
    if (topsList.length === 0 || bottomsList.length === 0) {
      return;
    }

    const randomTop = Math.floor(Math.random() * topsList.length);
    const randomBottom = Math.floor(Math.random() * bottomsList.length);

    topsCarousel.setIndex(randomTop);
    bottomsCarousel.setIndex(randomBottom);

    if (shoesList.length > 0) {
      const randomShoes = Math.floor(Math.random() * shoesList.length);
      shoesCarousel.setIndex(randomShoes);
    }
  }, [topsList, bottomsList, shoesList, topsCarousel, bottomsCarousel, shoesCarousel]);

  // Handle select button - generate outfit with rate limiting
  const handleSelect = useCallback(async () => {
    if (!hasApiKey) {
      return;
    }

    const rateLimitCheck: RateLimitResult = canGenerate();
    if (!rateLimitCheck.allowed) {
      return;
    }

    const topItem = topsList[previewTop];
    const bottomItem = bottomsList[previewBottom];
    const shoeItem = shoesList.length > 0 ? shoesList[previewShoes] : undefined;

    if (topItem && bottomItem) {
      setGenerationProgress(0);
      await generateOutfit(topItem, bottomItem, modelImageUrl, shoeItem);
    }
  }, [
    canGenerate,
    generateOutfit,
    hasApiKey,
    previewTop,
    previewBottom,
    previewShoes,
    topsList,
    bottomsList,
    shoesList,
    modelImageUrl,
  ]);

  // Get current rate limit status
  const rateLimitStatus: RateLimitResult = canGenerate();
  const canGenerateNow = hasApiKey && rateLimitStatus.allowed;

  return {
    previewTop,
    previewBottom,
    previewShoes,
    generationProgress,
    handleRandom,
    handleSelect,
    rateLimitStatus,
    canGenerateNow,
  };
}

