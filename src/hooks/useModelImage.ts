import { useState, useCallback } from "react";

const DEFAULT_MODEL_PATH = "/assets/model.png";

/**
 * Custom hook to manage model image upload and reset
 */
export function useModelImage() {
  const [modelImageUrl, setModelImageUrl] = useState<string>(DEFAULT_MODEL_PATH);

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
        };
        reader.readAsDataURL(file);
      }
    };

    input.click();
  }, []);

  const handleResetModel = useCallback(() => {
    setModelImageUrl(DEFAULT_MODEL_PATH);
  }, []);

  return {
    modelImageUrl,
    handleModelUpload,
    handleResetModel,
  };
}

