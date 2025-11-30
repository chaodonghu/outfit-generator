interface OutfitPreviewProps {
  hasApiKey: boolean;
  isGenerating: boolean;
  generationProgress: number;
  error: string | null;
  generatedImage: string | null;
  onClearGeneratedImage: () => void;
  modelImageUrl: string;
  onUploadModel: () => void;
  onResetModel: () => void;
}

export function OutfitPreview({
  hasApiKey,
  isGenerating,
  generationProgress,
  error,
  generatedImage,
  onClearGeneratedImage,
  modelImageUrl,
  onUploadModel,
  onResetModel,
}: OutfitPreviewProps) {
  const isDefaultModel = modelImageUrl === "/assets/model.png";
  return (
    <div className="right-column">
      <div className="outfit-preview">
        {/* Show progress indicator when generating */}
        {hasApiKey && isGenerating && (
          <div
            style={{
              position: "absolute",
              bottom: "24px",
              left: "50%",
              transform: "translateX(-50%)",
              width: "80%",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <div className="progress-indicator" style={{ width: "100%" }}>
              <div
                className="progress-indicator-bar"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
            <div style={{ fontSize: "12px", color: "var(--macos-text-secondary)" }}>
              Generating outfit... {generationProgress}%
            </div>
          </div>
        )}

        {/* Show model image when not generating and no generated image */}
        {!isGenerating && !generatedImage && (
          <>
            <img
              src={modelImageUrl}
              alt="Model"
              style={{
                maxWidth: "90%",
                maxHeight: "90%",
                objectFit: "contain",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: "8px",
              }}
            >
              <button
                onClick={onUploadModel}
                style={{
                  padding: "8px 16px",
                  fontSize: "12px",
                }}
                title="Upload custom model image"
              >
                Upload Model
              </button>
              {!isDefaultModel && (
                <button
                  onClick={onResetModel}
                  style={{
                    padding: "8px 16px",
                    fontSize: "12px",
                  }}
                  title="Reset to default model"
                >
                  Reset
                </button>
              )}
            </div>
          </>
        )}

        {!hasApiKey && (
          <div className="api-key-message">
            <p>⚠️ Google API key required</p>
            <p style={{ fontSize: "12px" }}>
              Please set VITE_GOOGLE_API_KEY in your .env file
            </p>
          </div>
        )}

        {hasApiKey && error && !error.includes("composite") && (
          <div className="error-message">
            <p>Error: {error}</p>
            <button onClick={onClearGeneratedImage}>Clear</button>
          </div>
        )}

        {hasApiKey && generatedImage && !isGenerating && (
          <>
            <img
              src={generatedImage}
              alt="Generated Outfit"
              style={{
                maxWidth: "90%",
                maxHeight: "90%",
                objectFit: "contain",
              }}
            />
            <button
              onClick={onClearGeneratedImage}
              style={{
                position: "absolute",
                bottom: "16px",
                right: "16px",
                padding: "8px 16px",
                fontSize: "12px",
              }}
            >
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}
