import { useEffect } from "react";
import { useCarousel } from "./hooks/useCarousel";
import { useOutfitGeneration } from "./hooks/useOutfitGeneration";
import { useClothingItems } from "./hooks/useClothingItems";
import { useTheme } from "./hooks/useTheme";
import { useModelImage } from "./hooks/useModelImage";
import { useNanoAndTransfer } from "./hooks/useNanoAndTransfer";
import { useOutfitControls } from "./hooks/useOutfitControls";
import { rateLimiter } from "./services/rateLimiter";

// Import components
import { ClothingCarousel } from "./components/ClothingCarousel";
import { ControlButtons } from "./components/ControlButtons";
import { OutfitPreview } from "./components/OutfitPreview";
import { NanoWindow } from "./components/NanoWindow";
import { OutfitTransferWindow } from "./components/OutfitTransferWindow";

function App() {
  // Theme management
  const { isDarkMode, toggleTheme } = useTheme();

  // Configure rate limiter
  useEffect(() => {
    rateLimiter.updateConfig({
      cooldownMs: 2000,
      maxCalls: 10,
      windowMs: 60000,
    });
  }, []);

  // Initialize carousels (need to initialize before passing to hooks)
  const topsCarousel = useCarousel(0, "tops");
  const bottomsCarousel = useCarousel(0, "bottoms");
  const shoesCarousel = useCarousel(0, "shoes");

  // Clothing items management
  const {
    topsList,
    bottomsList,
    shoesList,
    isLoading: isLoadingItems,
    isUploading,
    handleFileUpload,
    handleUrlUpload,
    handleDeleteItem,
    handleImageError,
  } = useClothingItems(topsCarousel, bottomsCarousel, shoesCarousel);

  // Update carousel lengths when lists change
  useEffect(() => {
    topsCarousel.setLength(topsList.length);
  }, [topsList.length, topsCarousel]);

  useEffect(() => {
    bottomsCarousel.setLength(bottomsList.length);
  }, [bottomsList.length, bottomsCarousel]);

  useEffect(() => {
    shoesCarousel.setLength(shoesList.length);
  }, [shoesList.length, shoesCarousel]);

  // Model image management
  const { modelImageUrl, handleModelUpload, handleResetModel } = useModelImage();

  // Outfit generation
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

  // Outfit generation controls
  const {
    generationProgress,
    handleRandom,
    handleSelect,
    rateLimitStatus,
    canGenerateNow,
  } = useOutfitControls({
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
  });

  // Nano Banana and Outfit Transfer features
  const {
    showNanoWindow,
    setShowNanoWindow,
    nanoText,
    setNanoText,
    handleNanoStyle,
    showOutfitTransferWindow,
    setShowOutfitTransferWindow,
    handleOutfitTransfer,
  } = useNanoAndTransfer({
    hasApiKey,
    canGenerate,
    generateNanoOutfit,
    generateOutfitTransfer,
    modelImageUrl,
  });

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
                onImageError={(itemId) => handleImageError("tops", itemId)}
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
                onImageError={(itemId) => handleImageError("bottoms", itemId)}
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
                onImageError={(itemId) => handleImageError("shoes", itemId)}
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
    </>
  );
}

export default App;
