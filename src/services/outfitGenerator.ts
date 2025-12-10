function isQuotaError(err: any): boolean {
  const code = err?.error?.code || err?.status || err?.code;
  if (code === 429) return true;
  const status = err?.error?.status || err?.statusMessage;
  return status === "RESOURCE_EXHAUSTED";
}

function getRetryMsFromError(err: any, fallbackMs = 20000): number {
  try {
    const details = err?.error?.details || [];
    const retry = details.find((d: any) => d["@type"]?.includes("RetryInfo"));
    if (retry?.retryDelay) {
      const m = /^(\d+)(?:\.(\d+))?s$/.exec(retry.retryDelay);
      if (m) {
        const sec = parseInt(m[1], 10);
        const frac = m[2] ? parseInt(m[2].slice(0, 3).padEnd(3, "0"), 10) : 0; // ms
        return sec * 1000 + frac;
      }
    }
  } catch {}
  return fallbackMs;
}

import {
  getCachedComposite,
  saveCachedComposite,
  uploadImage,
} from "../lib/supabase";

// Types
export interface OutfitGenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

// Constants
const MODEL = "gemini-2.5-flash-image";
const DEFAULT_BODY_PATH = "/assets/model.png";
const CACHE_PREFIX = "outfit_";

// Helper function to call Gemini API directly via fetch
async function callGeminiAPI(contents: any[]) {
  const baseUrl = import.meta.env.VITE_LITE_LLM_BASE_URL || "";
  const apiKey = import.meta.env.VITE_LITE_LLM_KEY || "";
  
  if (!baseUrl || !apiKey) {
    throw new Error("VITE_LITE_LLM_BASE_URL and VITE_LITE_LLM_KEY must be set");
  }

  // Format the URL based on your LiteLLM proxy format
  // Adjust the project/location if needed for your setup
  const url = `${baseUrl}/vertex_ai/v1/projects/zapai-dev/locations/us-east1/publishers/google/models/${MODEL}:generateContent`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: contents,
      }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson;
    try {
      errorJson = JSON.parse(errorText);
    } catch {
      errorJson = { message: errorText };
    }
    throw {
      status: response.status,
      error: errorJson,
      message: errorJson.message || errorText,
    };
  }

  return await response.json();
}

function cacheKeyFor(
  topPath: string,
  bottomPath: string,
  bodyPath: string,
  prompt: string,
  shoePath?: string
): string {
  const shoesPart = shoePath ? `|${shoePath}` : "";
  return `${CACHE_PREFIX}${MODEL}|${topPath}|${bottomPath}${shoesPart}|${bodyPath}|v1:${prompt.length}`;
}

function buildPrompt(includeShoes: boolean = false): string {
  if (includeShoes) {
    return "Create a new image by combining the elements from the provided images. Take the top clothing item from image 1, the bottom clothing item from image 2, and the shoes from image 3, and place them naturally onto the body in image 4 so it looks like the person is wearing the complete outfit. Fit to body shape and pose, preserve garment proportions and textures, match lighting and shadows, handle occlusion by hair and arms. CRITICAL: The background must be completely white (#FFFFFF) - do not use black, transparent, or any other background color. Replace any existing background with solid white. Do not change the person identity or add accessories.";
  }
  return "Create a new image by combining the elements from the provided images. Take the top clothing item from image 1 and the bottom clothing item from image 2, and place them naturally onto the body in image 3 so it looks like the person is wearing the selected outfit. Fit to body shape and pose, preserve garment proportions and textures, match lighting and shadows, handle occlusion by hair and arms. CRITICAL: The background must be completely white (#FFFFFF) - do not use black, transparent, or any other background color. Replace any existing background with solid white. Do not change the person identity or add accessories.";
}

// Intentionally unused experimental prompt helpers removed to reduce noise

// Compress image to reduce payload size and avoid 413 errors
async function compressImage(
  path: string,
  maxWidth: number = 800,
  quality: number = 0.7
): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  const blob = await res.blob();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      // Create canvas and draw compressed image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to base64 with compression (using JPEG for better compression)
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
    img.src = URL.createObjectURL(blob);
  });
}

// Helper function to convert data URL to File
function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

async function generateOutfitInternal(
  topPath: string,
  bottomPath: string,
  bodyPath: string = DEFAULT_BODY_PATH,
  topId?: string,
  bottomId?: string,
  shoePath?: string,
  shoeId?: string
): Promise<OutfitGenerationResult> {
  // Check Supabase cache first if we have IDs
  if (topId && bottomId) {
    const cachedUrl = await getCachedComposite(topId, bottomId, shoeId);
    if (cachedUrl) {
      return { success: true, imageUrl: cachedUrl };
    }
  }

  const includeShoes = Boolean(shoePath);
  const prompt = buildPrompt(includeShoes);
  const key = cacheKeyFor(topPath, bottomPath, bodyPath, prompt, shoePath);

  // simple in memory cache
  (window as any).__outfitCache =
    (window as any).__outfitCache || new Map<string, string>();
  const cache = (window as any).__outfitCache as Map<string, string>;
  if (cache.has(key)) {
    const dataUrl = cache.get(key)!;

    // If we have IDs, save to Supabase storage
    if (topId && bottomId) {
      try {
        const filename = shoeId 
          ? `outfit_${topId}_${bottomId}_${shoeId}_${Date.now()}.png`
          : `outfit_${topId}_${bottomId}_${Date.now()}.png`;
        const file = dataUrlToFile(dataUrl, filename);
        const storageUrl = await uploadImage("GENERATED", file, file.name);
        await saveCachedComposite(topId, bottomId, storageUrl, shoeId);
        return { success: true, imageUrl: storageUrl };
      } catch (error) {
        console.error("Error saving to Supabase:", error);
        // Fall back to data URL if storage fails
        return { success: true, imageUrl: dataUrl };
      }
    }

    return { success: true, imageUrl: dataUrl };
  }

  // Compress images (conditionally include shoes)
  const compressionPromises = [
    compressImage(topPath, 800, 0.7),
    compressImage(bottomPath, 800, 0.7),
  ];
  
  if (includeShoes && shoePath) {
    compressionPromises.push(compressImage(shoePath, 800, 0.7));
  }
  
  compressionPromises.push(compressImage(bodyPath, 800, 0.7));
  
  const compressedImages = await Promise.all(compressionPromises);

  // Build contents array
  const contents = [{ text: prompt }];
  
  if (includeShoes && shoePath) {
    const [topB64, bottomB64, shoesB64, bodyB64] = compressedImages;
    contents.push(
      { inlineData: { mimeType: "image/jpeg", data: topB64 } }, // image 1 top
      { inlineData: { mimeType: "image/jpeg", data: bottomB64 } }, // image 2 bottom
      { inlineData: { mimeType: "image/jpeg", data: shoesB64 } }, // image 3 shoes
      { inlineData: { mimeType: "image/jpeg", data: bodyB64 } } // image 4 body
    );
  } else {
    const [topB64, bottomB64, bodyB64] = compressedImages;
    contents.push(
      { inlineData: { mimeType: "image/jpeg", data: topB64 } }, // image 1 top
      { inlineData: { mimeType: "image/jpeg", data: bottomB64 } }, // image 2 bottom
      { inlineData: { mimeType: "image/jpeg", data: bodyB64 } } // image 3 body
    );
  }
  console.log(
    "Generating outfit with contents:!!!!!!!",
    JSON.stringify(contents)
  );

  let resp;
  let attempt = 0;
  const maxAttempts = 3;
  while (true) {
    try {
      console.log("Calling Gemini API with contents:", JSON.stringify(contents));
      resp = await callGeminiAPI(contents);
      console.log("resp!!!!!!!", resp);
      break;
    } catch (err: any) {
      console.log("err!!!!!!!", err);
      if (!isQuotaError(err) || attempt >= maxAttempts - 1) {
        const msg =
          typeof err?.message === "string" ? err.message : JSON.stringify(err);
        return { success: false, error: `Gemini API error. ${msg}` };
      }
      attempt += 1;
      const base = getRetryMsFromError(err, 20000);
      const waitMs = Math.round(base * Math.pow(2, attempt - 1));
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  const parts = resp.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  if (!imagePart) {
    const msg =
      parts
        .map((p: any) => p.text)
        .filter(Boolean)
        .join("\n") || "No image data returned";
    return { success: false, error: `Gemini did not return an image. ${msg}` };
  }

  // Fix linter error: check if inlineData exists before accessing data
  if (!imagePart.inlineData?.data) {
    return { success: false, error: "No image data in response" };
  }

  const dataUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
  cache.set(key, dataUrl);

  // If we have IDs, save to Supabase storage
  if (topId && bottomId) {
    try {
      const filename = shoeId 
        ? `outfit_${topId}_${bottomId}_${shoeId}_${Date.now()}.png`
        : `outfit_${topId}_${bottomId}_${Date.now()}.png`;
      const file = dataUrlToFile(dataUrl, filename);
      const storageUrl = await uploadImage("GENERATED", file, file.name);
      await saveCachedComposite(topId, bottomId, storageUrl, shoeId);
      return { success: true, imageUrl: storageUrl };
    } catch (error) {
      console.error("Error saving to Supabase:", error);
      // Fall back to data URL if storage fails
    }
  }

  return { success: true, imageUrl: dataUrl };
}

// New function for Nano Banana styling with custom prompts
async function generateNanoOutfitInternal(
  bodyPath: string = DEFAULT_BODY_PATH,
  customPrompt: string
): Promise<OutfitGenerationResult> {
  if (!import.meta.env.VITE_GOOGLE_API_KEY) {
    return {
      success: false,
      error: "Set VITE_GOOGLE_API_KEY and enable billing for image generation.",
    };
  }

  const key = `nano_${MODEL}|${bodyPath}|v1:${customPrompt.length}`;

  // simple in memory cache
  (window as any).__nanoCache =
    (window as any).__nanoCache || new Map<string, string>();
  const cache = (window as any).__nanoCache as Map<string, string>;
  if (cache.has(key)) {
    const dataUrl = cache.get(key)!;
    return { success: true, imageUrl: dataUrl };
  }

  const bodyB64 = await compressImage(bodyPath, 800, 0.7);

  const contents = [
    { text: customPrompt },
    { inlineData: { mimeType: "image/jpeg", data: bodyB64 } }, // model image
  ];

  let resp;
  let attempt = 0;
  const maxAttempts = 3;
  while (true) {
    try {
      resp = await callGeminiAPI(contents);
      break;
    } catch (err: any) {
      if (!isQuotaError(err) || attempt >= maxAttempts - 1) {
        const msg =
          typeof err?.message === "string" ? err.message : JSON.stringify(err);
        return { success: false, error: `Gemini API error. ${msg}` };
      }
      attempt += 1;
      const base = getRetryMsFromError(err, 20000);
      const waitMs = Math.round(base * Math.pow(2, attempt - 1));
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  const parts = resp.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  if (!imagePart) {
    const msg =
      parts
        .map((p: any) => p.text)
        .filter(Boolean)
        .join("\n") || "No image data returned";
    return { success: false, error: `Gemini did not return an image. ${msg}` };
  }

  // Fix linter error: check if inlineData exists before accessing data
  if (!imagePart.inlineData?.data) {
    return { success: false, error: "No image data in response" };
  }

  const dataUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
  console.log("Generated Nano Outfit Image:", dataUrl);
  console.log(
    "You can copy this data URL and paste it in a new browser tab to view the image"
  );
  cache.set(key, dataUrl);

  return { success: true, imageUrl: dataUrl };
}

// New function for outfit transfer from inspiration image
async function generateOutfitTransferInternal(
  inspirationImagePath: string,
  bodyPath: string = DEFAULT_BODY_PATH
): Promise<OutfitGenerationResult> {
  if (!import.meta.env.VITE_GOOGLE_API_KEY) {
    return {
      success: false,
      error: "Set VITE_GOOGLE_API_KEY and enable billing for image generation.",
    };
  }

  const transferPrompt =
    "Using the provided images, place the outfit from image 2 onto the person in image 1. Keep the face, body shape, and background of image 1 completely unchanged. Ensure the outfit integrates naturally with the model's body shape, pose, and lighting. CRITICAL: The background must be completely white (#FFFFFF) - do not use black, transparent, or any other background color. Do not change the person identity or add accessories.";

  const key = `transfer_${MODEL}|${inspirationImagePath}|${bodyPath}|v1:${transferPrompt.length}`;

  // simple in memory cache
  (window as any).__transferCache =
    (window as any).__transferCache || new Map<string, string>();
  const cache = (window as any).__transferCache as Map<string, string>;
  if (cache.has(key)) {
    const dataUrl = cache.get(key)!;
    return { success: true, imageUrl: dataUrl };
  }

  const [bodyB64, inspirationB64] = await Promise.all([
    compressImage(bodyPath, 800, 0.7),
    compressImage(inspirationImagePath, 800, 0.7),
  ]);

  const contents = [
    { text: transferPrompt },
    { inlineData: { mimeType: "image/jpeg", data: bodyB64 } }, // image 1 - model
    { inlineData: { mimeType: "image/jpeg", data: inspirationB64 } }, // image 2 - inspiration
  ];

  let resp;
  let attempt = 0;
  const maxAttempts = 3;
  while (true) {
    try {
      resp = await callGeminiAPI(contents);
      break;
    } catch (err: any) {
      if (!isQuotaError(err) || attempt >= maxAttempts - 1) {
        const msg =
          typeof err?.message === "string" ? err.message : JSON.stringify(err);
        return { success: false, error: `Gemini API error. ${msg}` };
      }
      attempt += 1;
      const base = getRetryMsFromError(err, 20000);
      const waitMs = Math.round(base * Math.pow(2, attempt - 1));
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  const parts = resp.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);
  if (!imagePart) {
    const msg =
      parts
        .map((p: any) => p.text)
        .filter(Boolean)
        .join("\n") || "No image data returned";
    return { success: false, error: `Gemini did not return an image. ${msg}` };
  }

  // Fix linter error: check if inlineData exists before accessing data
  if (!imagePart.inlineData?.data) {
    return { success: false, error: "No image data in response" };
  }

  const dataUrl = `data:image/png;base64,${imagePart.inlineData.data}`;
  cache.set(key, dataUrl);

  return { success: true, imageUrl: dataUrl };
}

// Backward compatibility class wrapper
export class OutfitGenerator {
  private static instance: OutfitGenerator;

  private constructor() {}

  static getInstance(): OutfitGenerator {
    if (!OutfitGenerator.instance) {
      OutfitGenerator.instance = new OutfitGenerator();
    }
    return OutfitGenerator.instance;
  }

  async generateOutfit(
    topPath: string,
    bottomPath: string,
    bodyPath: string = DEFAULT_BODY_PATH,
    topId?: string,
    bottomId?: string,
    shoePath?: string,
    shoeId?: string
  ): Promise<OutfitGenerationResult> {
    return generateOutfitInternal(
      topPath,
      bottomPath,
      bodyPath,
      topId,
      bottomId,
      shoePath,
      shoeId
    );
  }

  async generateNanoOutfit(
    occasion: string,
    bodyPath: string = DEFAULT_BODY_PATH
  ): Promise<OutfitGenerationResult> {
    const customPrompt = `Using the provided image of a model, please add an outfit to the model that would work in this occasion: ${occasion}. Ensure the outfit integrates naturally with the model's body shape, pose, and lighting. Keep the background plain white so the focus stays on the model and the outfit.`;

    return generateNanoOutfitInternal(bodyPath, customPrompt);
  }

  async generateOutfitTransfer(
    inspirationImagePath: string,
    bodyPath: string = DEFAULT_BODY_PATH
  ): Promise<OutfitGenerationResult> {
    return generateOutfitTransferInternal(inspirationImagePath, bodyPath);
  }

  clearCache(): void {
    (window as any).__outfitCache = new Map<string, string>();
    (window as any).__nanoCache = new Map<string, string>();
    (window as any).__transferCache = new Map<string, string>();
  }

  getCacheSize(): number {
    const cache = (window as any).__outfitCache as
      | Map<string, string>
      | undefined;
    const nanoCache = (window as any).__nanoCache as
      | Map<string, string>
      | undefined;
    const transferCache = (window as any).__transferCache as
      | Map<string, string>
      | undefined;
    return (
      (cache?.size || 0) + (nanoCache?.size || 0) + (transferCache?.size || 0)
    );
  }
}

// Export the singleton instance for backward compatibility
export const outfitGenerator = OutfitGenerator.getInstance();
