import { useState, useEffect, useCallback } from "react";
import { useCarousel } from "./hooks/useCarousel";
import { useOutfitGeneration } from "./hooks/useOutfitGeneration";
import {
  addClothingItem,
  getClothingItems,
  deleteClothingItem,
  ClothingItem as SupabaseClothingItem,
} from "./lib/supabase";
import { rateLimiter } from "./services/rateLimiter";
import { LocalClothingItem, RateLimitResult } from "./types";
import { fetchImageAsFile, promptForImageUrl } from "./utils/imageUrlHandler";

// Import components
import { ClothingCarousel } from "./components/ClothingCarousel";
import { ControlButtons } from "./components/ControlButtons";
import { OutfitPreview } from "./components/OutfitPreview";
import { NanoWindow } from "./components/NanoWindow";
import { OutfitTransferWindow } from "./components/OutfitTransferWindow";

// Debug logger (no-op in production)
const debugLog = (...args: any[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

function App() {
  const [previewTop, setPreviewTop] = useState<number>(0);
  const [previewBottom, setPreviewBottom] = useState<number>(0);
  const [previewShoes, setPreviewShoes] = useState<number>(0);
  const [topsList, setTopsList] = useState<LocalClothingItem[]>([]);
  const [bottomsList, setBottomsList] = useState<LocalClothingItem[]>([]);
  const [shoesList, setShoesList] = useState<LocalClothingItem[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [showNanoWindow, setShowNanoWindow] = useState<boolean>(false);
  const [nanoText, setNanoText] = useState<string>("");
  const [showOutfitTransferWindow, setShowOutfitTransferWindow] =
    useState<boolean>(false);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(true);
  const [modelImageUrl, setModelImageUrl] = useState<string>("/assets/model.png");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    // Check localStorage first, then system preference
    const saved = localStorage.getItem("theme");
    if (saved) {
      return saved === "dark";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Apply theme to body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      document.body.classList.remove("light-mode");
    } else {
      document.body.classList.add("light-mode");
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // Toggle theme handler
  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Load clothing items from Supabase on component mount
  useEffect(() => {
      const loadClothingItems = async () => {
      setIsLoadingItems(true);
      try {
        debugLog("Loading clothing items from Supabase...");

        const [supabaseTops, supabaseBottoms, supabaseShoes] = await Promise.all([
          getClothingItems("tops"),
          getClothingItems("bottoms"),
          getClothingItems("shoes"),
        ]);

        debugLog("Loaded from Supabase:", {
          tops: supabaseTops.length,
          bottoms: supabaseBottoms.length,
          shoes: supabaseShoes.length,
        });

        // Convert Supabase items to local format
        const convertedTops: LocalClothingItem[] = supabaseTops.map(
          (item: SupabaseClothingItem) => ({
            id: item.id,
            name: item.name,
            imageUrl: item.image_url,
            offset: {
              x: 0,
              y: -20,
              scale: 1.0,
              zIndex: 10,
            },
          })
        );

        const convertedBottoms: LocalClothingItem[] = supabaseBottoms.map(
          (item: SupabaseClothingItem) => ({
            id: item.id,
            name: item.name,
            imageUrl: item.image_url,
            offset: {
              x: 0,
              y: 50,
              scale: 1.0,
              zIndex: 9,
            },
          })
        );

        const convertedShoes: LocalClothingItem[] = supabaseShoes.map(
          (item: SupabaseClothingItem) => ({
            id: item.id,
            name: item.name,
            imageUrl: item.image_url,
            offset: {
              x: 0,
              y: 120,
              scale: 1.0,
              zIndex: 8,
            },
          })
        );

        // Always set the lists, even if empty
        // this is so that you can see this
        setTopsList(convertedTops);
        setBottomsList(convertedBottoms);
        setShoesList(convertedShoes);

        debugLog(
          `Set ${convertedTops.length} tops, ${convertedBottoms.length} bottoms, and ${convertedShoes.length} shoes`
        );
      } catch (error) {
        console.error("Error loading clothing items from Supabase:", error);
        // Fall back to empty arrays if database fails
        setTopsList([]);
        setBottomsList([]);
        setShoesList([]);
        debugLog("Falling back to empty arrays due to database error");
      } finally {
        setIsLoadingItems(false);
      }
    };

    loadClothingItems();
  }, []); // Empty dependency array - only run once on mount

  // Configure rate limiter for better user experience
  useEffect(() => {
    // Reduce cooldown to 2 seconds for better user experience
    rateLimiter.updateConfig({
      cooldownMs: 2000, // 2 seconds instead of 10 seconds
      maxCalls: 10, // Increase max calls to 10 per minute
      windowMs: 60000, // Keep 1 minute window
    });
  }, []);

  // Debug logging to identify why tops/bottoms/shoes aren't showing
  debugLog("App render - tops:", topsList);
  debugLog("App render - bottoms:", bottomsList);
  debugLog("App render - shoes:", shoesList);
  debugLog("App render - tops.length:", topsList.length);
  debugLog("App render - bottoms.length:", bottomsList.length);
  debugLog("App render - shoes.length:", shoesList.length);

  const topsCarousel = useCarousel(topsList.length, "tops");
  const bottomsCarousel = useCarousel(bottomsList.length, "bottoms");
  const shoesCarousel = useCarousel(shoesList.length, "shoes");
  const {
    generatedImage,
    isGenerating,
    error,
    generateOutfit,
    generateNanoOutfit,
    generateOutfitTransfer,
    clearGeneratedImage,
    canGenerate,
  } = useOutfitGeneration();

  // Check if API key is configured
  const hasApiKey = Boolean(
    import.meta.env.VITE_GOOGLE_API_KEY &&
      import.meta.env.VITE_GOOGLE_API_KEY !== "your_google_api_key_here"
  );

  // Test connection function

  // Debug data mismatch function

  // Handle model image upload
  const handleModelUpload = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        // Create a data URL for immediate preview
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          setModelImageUrl(dataUrl);
          debugLog("Model image uploaded:", file.name);
        };
        reader.readAsDataURL(file);
      }
    };

    input.click();
  }, []);

  // Reset model to default
  const handleResetModel = useCallback(() => {
    setModelImageUrl("/assets/model.png");
    debugLog("Model image reset to default");
  }, []);

  // Handle file upload (from drag-drop or file picker)
  const handleFileUpload = useCallback(
    async (category: "tops" | "bottoms" | "shoes", droppedFiles?: FileList) => {
      // Helper function to process files
      const processFiles = async (files: FileList) => {
        debugLog("Files to upload:", files.length);

        if (files && files.length > 0) {
          setIsUploading(true);

          try {
            const uploadPromises = Array.from(files).map(
              async (file, index) => {
                const currentLength =
                  category === "tops"
                    ? topsList.length
                    : category === "bottoms"
                    ? bottomsList.length
                    : shoesList.length;
                const nextNumber = currentLength + index + 1;
                const categoryLabel =
                  category === "tops"
                    ? "Top"
                    : category === "bottoms"
                    ? "Bottom"
                    : "Shoe";
                const name = `${categoryLabel} ${nextNumber}`;

                debugLog(`Attempting to upload: ${name}`);

                const newItem = await addClothingItem(name, category, file);

                const newClothingItem: LocalClothingItem = {
                  id: newItem.id,
                  name: newItem.name,
                  imageUrl: newItem.image_url,
                  offset: {
                    x: 0,
                    y: category === "tops" ? -20 : category === "bottoms" ? 50 : 120,
                    scale: 1.0,
                    zIndex: category === "tops" ? 10 : category === "bottoms" ? 9 : 8,
                  },
                };

                return newClothingItem;
              }
            );

            // Wait for all uploads to complete
            const newItems = await Promise.all(uploadPromises);

            if (category === "tops") {
              setTopsList((prev) => [...prev, ...newItems]);
            } else if (category === "bottoms") {
              setBottomsList((prev) => [...prev, ...newItems]);
            } else {
              setShoesList((prev) => [...prev, ...newItems]);
            }

            debugLog(
              `Added ${newItems.length} new ${category}:`,
              newItems.map((item) => item.name)
            );
          } catch (error) {
            console.error(`Error uploading ${category}:`, error);
            alert(`Failed to upload some ${category}. Please try again.`);
          } finally {
            setIsUploading(false);
          }
        }
      };

      // If files were dropped, process them directly
      if (droppedFiles) {
        await processFiles(droppedFiles);
      } else {
        // Otherwise, show file picker
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true; // Allow multiple file selection

        input.onchange = async (event) => {
          const files = (event.target as HTMLInputElement).files;
          if (files) {
            await processFiles(files);
          }
        };

        input.click();
      }
    },
    [topsList.length, bottomsList.length, shoesList.length]
  );

  // Handle URL-based upload
  const handleUrlUpload = useCallback(
    async (category: "tops" | "bottoms" | "shoes") => {
      // Prompt user for URL
      const url = promptForImageUrl(category);
      
      if (!url) {
        return; // User cancelled or invalid URL
      }

      setIsUploading(true);

      try {
        debugLog(`Attempting to fetch image from URL: ${url}`);
        
        // Fetch the image as a File object
        const file = await fetchImageAsFile(url);
        
        const currentLength =
          category === "tops"
            ? topsList.length
            : category === "bottoms"
            ? bottomsList.length
            : shoesList.length;
        const nextNumber = currentLength + 1;
        const categoryLabel =
          category === "tops"
            ? "Top"
            : category === "bottoms"
            ? "Bottom"
            : "Shoe";
        const name = `${categoryLabel} ${nextNumber}`;

        debugLog(`Uploading image from URL as: ${name}`);

        // Use the existing addClothingItem function
        const newItem = await addClothingItem(name, category, file);

        const newClothingItem: LocalClothingItem = {
          id: newItem.id,
          name: newItem.name,
          imageUrl: newItem.image_url,
          offset: {
            x: 0,
            y: category === "tops" ? -20 : category === "bottoms" ? 50 : 120,
            scale: 1.0,
            zIndex: category === "tops" ? 10 : category === "bottoms" ? 9 : 8,
          },
        };

        // Add to the appropriate list
        if (category === "tops") {
          setTopsList((prev) => [...prev, newClothingItem]);
        } else if (category === "bottoms") {
          setBottomsList((prev) => [...prev, newClothingItem]);
        } else {
          setShoesList((prev) => [...prev, newClothingItem]);
        }

        debugLog(`Successfully added ${name} from URL`);
      } catch (error) {
        console.error(`Error uploading from URL:`, error);
        alert(
          `Failed to load image from URL. Please make sure:\n` +
          `1. The URL is publicly accessible\n` +
          `2. The URL points to a valid image file\n` +
          `3. CORS is enabled on the image server\n\n` +
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } finally {
        setIsUploading(false);
      }
    },
    [topsList.length, bottomsList.length, shoesList.length]
  );

  // Handle delete item
  const handleDeleteItem = useCallback(
    async (category: "tops" | "bottoms" | "shoes", itemId: string, currentIndex: number) => {
      if (!confirm("Are you sure you want to delete this item?")) {
        return;
      }

      try {
        debugLog(`Deleting item ${itemId} from ${category}`);
        
        // Delete from Supabase
        await deleteClothingItem(itemId);

        // Update local state
        if (category === "tops") {
          setTopsList((prev) => {
            const newList = prev.filter((item) => item.id !== itemId);
            // Adjust carousel index if needed
            if (currentIndex >= newList.length && newList.length > 0) {
              topsCarousel.setIndex(newList.length - 1);
            } else if (newList.length === 0) {
              topsCarousel.setIndex(0);
            }
            return newList;
          });
        } else if (category === "bottoms") {
          setBottomsList((prev) => {
            const newList = prev.filter((item) => item.id !== itemId);
            if (currentIndex >= newList.length && newList.length > 0) {
              bottomsCarousel.setIndex(newList.length - 1);
            } else if (newList.length === 0) {
              bottomsCarousel.setIndex(0);
            }
            return newList;
          });
        } else {
          setShoesList((prev) => {
            const newList = prev.filter((item) => item.id !== itemId);
            if (currentIndex >= newList.length && newList.length > 0) {
              shoesCarousel.setIndex(newList.length - 1);
            } else if (newList.length === 0) {
              shoesCarousel.setIndex(0);
            }
            return newList;
          });
        }

        debugLog(`Successfully deleted item from ${category}`);
      } catch (error) {
        console.error(`Error deleting item:`, error);
        alert(`Failed to delete item. Please try again.`);
      }
    },
    [topsCarousel, bottomsCarousel, shoesCarousel]
  );

  // Handle random selection
  const handleRandom = useCallback(() => {
    if (topsList.length === 0 || bottomsList.length === 0) {
      debugLog("Cannot select random outfit - no items available");
      return;
    }

    const randomTop = Math.floor(Math.random() * topsList.length);
    const randomBottom = Math.floor(Math.random() * bottomsList.length);

    // Update the carousel indices to show the random items
    topsCarousel.setIndex(randomTop);
    bottomsCarousel.setIndex(randomBottom);

    // Also randomize shoes if available
    if (shoesList.length > 0) {
      const randomShoes = Math.floor(Math.random() * shoesList.length);
      shoesCarousel.setIndex(randomShoes);
      debugLog("Random outfit selected:", {
        top: topsList[randomTop].id,
        bottom: bottomsList[randomBottom].id,
        shoes: shoesList[randomShoes].id,
      });
    } else {
      debugLog("Random outfit selected:", {
        top: topsList[randomTop].id,
        bottom: bottomsList[randomBottom].id,
      });
    }
  }, [topsList, bottomsList, shoesList, topsCarousel, bottomsCarousel, shoesCarousel]);

  // Handle select button - generate outfit with rate limiting
  const handleSelect = useCallback(async () => {
    if (!hasApiKey) {
      debugLog("API key not configured, skipping outfit generation");
      return;
    }

    const rateLimitCheck: RateLimitResult = canGenerate();
    if (!rateLimitCheck.allowed) {
      console.warn("🚫 Rate limit check failed:", rateLimitCheck.reason);
      if (rateLimitCheck.waitTime) {
        debugLog(
          `⏰ Please wait ${Math.ceil(
            rateLimitCheck.waitTime / 1000
          )} seconds before trying again`
        );
      }
      return;
    }

    const topItem = topsList[previewTop];
    const bottomItem = bottomsList[previewBottom];
    const shoeItem = shoesList.length > 0 ? shoesList[previewShoes] : undefined;

    if (topItem && bottomItem) {
      debugLog("🤖 Generating outfit with:", {
        top: topItem.id,
        bottom: bottomItem.id,
        shoes: shoeItem?.id || "none",
      });

      // Reset progress and start generation
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
      }, 200); // Update every 200ms
    } else {
      // Reset progress when generation stops
      setGenerationProgress(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isGenerating]);

  // Update preview when carousel changes
  useEffect(() => {
    setPreviewTop(topsCarousel.index);
  }, [topsCarousel.index]);

  useEffect(() => {
    setPreviewBottom(bottomsCarousel.index);
  }, [bottomsCarousel.index]);

  // Get current rate limit status for button state
  const rateLimitStatus: RateLimitResult = canGenerate();
  const canGenerateNow = hasApiKey && rateLimitStatus.allowed;

  // Log rate limit status periodically
  useEffect(() => {
    if (!hasApiKey) return;
    if (!import.meta.env.DEV) return;

    const logStatus = () => {
      const status: RateLimitResult = canGenerate();
      if (status.allowed) {
        debugLog("✅ API calls available - ready to generate");
      } else {
        debugLog("⏳ API rate limited:", status.reason);
      }
    };

    // Log initial status
    logStatus();

    // Log status every 30 seconds
    const interval = setInterval(logStatus, 30000);

    return () => clearInterval(interval);
  }, [canGenerate, hasApiKey]);

  // Helper function to handle image load errors
  const handleImageError = useCallback((imageUrl: string) => {
    console.error("Failed to load image:", imageUrl);
  }, []);

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
      debugLog("Nano styling with occasion:", occasionText);

      // Use the hook's generateNanoOutfit method
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
        debugLog("Starting outfit transfer with file:", file.name);
        await generateOutfitTransfer(file, modelImageUrl);
      } catch (error: any) {
        console.error("Error in outfit transfer:", error);
        // Error handling is already done in the hook
      }
    },
    [hasApiKey, canGenerate, generateOutfitTransfer, modelImageUrl]
  );
  return (
    <>
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        aria-label="Toggle theme"
      >
        {isDarkMode ? "☀️" : "🌙"}
      </button>

      <div className="window fullscreen">
        <div className="window-body" style={{ padding: 0 }}>
          <div className="main-container">
          {/* Left Column - Selection Area */}
          <div className="left-column">
            <ClothingCarousel
              items={topsList}
              carousel={topsCarousel}
              category="tops"
              onImageError={handleImageError}
              isLoading={isLoadingItems}
              onUploadFile={(files) => handleFileUpload("tops", files)}
              onUploadFromUrl={() => handleUrlUpload("tops")}
              onDeleteItem={(itemId, index) => handleDeleteItem("tops", itemId, index)}
              isUploading={isUploading}
            />

            <ClothingCarousel
              items={bottomsList}
              carousel={bottomsCarousel}
              category="bottoms"
              onImageError={handleImageError}
              isLoading={isLoadingItems}
              onUploadFile={(files) => handleFileUpload("bottoms", files)}
              onUploadFromUrl={() => handleUrlUpload("bottoms")}
              onDeleteItem={(itemId, index) => handleDeleteItem("bottoms", itemId, index)}
              isUploading={isUploading}
            />

            <ClothingCarousel
              items={shoesList}
              carousel={shoesCarousel}
              category="shoes"
              onImageError={handleImageError}
              isLoading={isLoadingItems}
              onUploadFile={(files) => handleFileUpload("shoes", files)}
              onUploadFromUrl={() => handleUrlUpload("shoes")}
              onDeleteItem={(itemId, index) => handleDeleteItem("shoes", itemId, index)}
              isUploading={isUploading}
            />

            <ControlButtons
              hasApiKey={hasApiKey}
              canGenerateNow={canGenerateNow}
              rateLimitStatus={rateLimitStatus}
              onRandom={handleRandom}
              onSelect={handleSelect}
              onNanoBananify={() => setShowNanoWindow(true)}
              onOutfitTransfer={() => setShowOutfitTransferWindow(true)}
            />
          </div>

          <OutfitPreview
            hasApiKey={hasApiKey}
            isGenerating={isGenerating}
            generationProgress={generationProgress}
            error={error}
            generatedImage={generatedImage}
            onClearGeneratedImage={clearGeneratedImage}
            modelImageUrl={modelImageUrl}
            onUploadModel={handleModelUpload}
            onResetModel={handleResetModel}
          />
        </div>
      </div>

      <NanoWindow
        show={showNanoWindow}
        nanoText={nanoText}
        onClose={() => setShowNanoWindow(false)}
        onTextChange={setNanoText}
        onStyle={handleNanoStyle}
      />

      <OutfitTransferWindow
        show={showOutfitTransferWindow}
        onClose={() => setShowOutfitTransferWindow(false)}
        onUploadImage={handleOutfitTransfer}
      />
      </div>
    </>
  );
}

export default App;
