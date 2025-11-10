import OpenAI from "openai";
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
const DEFAULT_BODY_DESCRIPTION = "a male fashion model on a white background";
const CACHE_PREFIX = "outfit_openai_";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
  dangerouslyAllowBrowser: true, // Required for client-side usage
});

function cacheKeyFor(
  topPath: string,
  bottomPath: string,
  modelDescription: string
): string {
  return `${CACHE_PREFIX}${topPath}|${bottomPath}|${modelDescription}`;
}

// Helper function to analyze an image and get a description using GPT-4 Vision
async function describeClothingItem(imagePath: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Using GPT-4o which has vision capabilities
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this clothing item in detail for outfit generation. Focus on: type (shirt/pants/dress/etc), color, pattern, style, material appearance, and any distinctive features. Be concise but descriptive.",
            },
            {
              type: "image_url",
              image_url: {
                url: imagePath,
              },
            },
          ],
        },
      ],
      max_tokens: 150,
    });

    return response.choices[0]?.message?.content || "clothing item";
  } catch (error) {
    console.error("Error describing clothing item:", error);
    return "clothing item";
  }
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
  modelDescription: string = DEFAULT_BODY_DESCRIPTION,
  topId?: string,
  bottomId?: string
): Promise<OutfitGenerationResult> {
  console.log("🚀 OpenAI generateOutfitInternal called!");
  console.log("Top path:", topPath);
  console.log("Bottom path:", bottomPath);
  console.log("Model description:", modelDescription);
  
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  console.log("API Key exists:", !!apiKey);
  console.log("API Key starts with 'sk-':", apiKey?.startsWith('sk-'));
  
  if (!apiKey) {
    console.error("❌ No OpenAI API key found!");
    return {
      success: false,
      error: "Set VITE_OPENAI_API_KEY in your .env file for image generation.",
    };
  }

  // Check Supabase cache first if we have IDs
  if (topId && bottomId) {
    const cachedUrl = await getCachedComposite(topId, bottomId);
    if (cachedUrl) {
      return { success: true, imageUrl: cachedUrl };
    }
  }

  const key = cacheKeyFor(topPath, bottomPath, modelDescription);

  // Simple in-memory cache
  (window as any).__outfitCacheOpenAI =
    (window as any).__outfitCacheOpenAI || new Map<string, string>();
  const cache = (window as any).__outfitCacheOpenAI as Map<string, string>;
  if (cache.has(key)) {
    const dataUrl = cache.get(key)!;

    // If we have IDs, save to Supabase storage
    if (topId && bottomId) {
      try {
        const file = dataUrlToFile(
          dataUrl,
          `outfit_${topId}_${bottomId}_${Date.now()}.png`
        );
        const storageUrl = await uploadImage("GENERATED", file, file.name);
        await saveCachedComposite(topId, bottomId, storageUrl);
        return { success: true, imageUrl: storageUrl };
      } catch (error) {
        console.error("Error saving to Supabase:", error);
        return { success: true, imageUrl: dataUrl };
      }
    }

    return { success: true, imageUrl: dataUrl };
  }

  try {
    console.log("🔍 Analyzing clothing items with GPT-4 Vision...");

    // Get descriptions of the clothing items
    const [topDescription, bottomDescription] = await Promise.all([
      describeClothingItem(topPath),
      describeClothingItem(bottomPath),
    ]);

    console.log("Top:", topDescription);
    console.log("Bottom:", bottomDescription);

    // Create a detailed prompt for DALL-E 3
    const prompt = `A professional fashion photograph of ${modelDescription} wearing ${topDescription} as a top and ${bottomDescription} as bottoms. The outfit should look natural and stylish. Studio lighting, high-resolution fashion photography, clean white background, full body shot, front view.`;

    console.log("🎨 Generating outfit image with DALL-E 3...");

    // Generate image with DALL-E 3
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard", // Use "hd" for higher quality but costs more
      response_format: "url",
    });

    const imageUrl = response.data[0]?.url;

    if (!imageUrl) {
      return {
        success: false,
        error: "DALL-E did not return an image URL",
      };
    }

    console.log("✅ Successfully generated outfit image");

    // Convert URL to data URL for caching
    const imageResponse = await fetch(imageUrl);
    const blob = await imageResponse.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    cache.set(key, dataUrl);

    // If we have IDs, save to Supabase storage
    if (topId && bottomId) {
      try {
        const file = dataUrlToFile(
          dataUrl,
          `outfit_${topId}_${bottomId}_${Date.now()}.png`
        );
        const storageUrl = await uploadImage("GENERATED", file, file.name);
        await saveCachedComposite(topId, bottomId, storageUrl);
        return { success: true, imageUrl: storageUrl };
      } catch (error) {
        console.error("Error saving to Supabase:", error);
      }
    }

    return { success: true, imageUrl: dataUrl };
  } catch (error: any) {
    console.error("❌ OpenAI API error:", error);

    // Handle specific OpenAI errors
    if (error?.status === 429) {
      return {
        success: false,
        error: "Rate limit exceeded. Please wait a moment and try again.",
      };
    }

    if (error?.status === 401) {
      return {
        success: false,
        error: "Invalid OpenAI API key. Check your VITE_OPENAI_API_KEY.",
      };
    }

    const errorMessage =
      error?.message || error?.error?.message || "Unknown error";
    return {
      success: false,
      error: `OpenAI API error: ${errorMessage}`,
    };
  }
}

// Generate outfit from text description (Nano Banana equivalent)
async function generateNanoOutfitInternal(
  occasion: string,
  modelDescription: string = DEFAULT_BODY_DESCRIPTION
): Promise<OutfitGenerationResult> {
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    return {
      success: false,
      error: "Set VITE_OPENAI_API_KEY in your .env file for image generation.",
    };
  }

  const key = `nano_openai_${occasion}`;

  // Simple in-memory cache
  (window as any).__nanoCacheOpenAI =
    (window as any).__nanoCacheOpenAI || new Map<string, string>();
  const cache = (window as any).__nanoCacheOpenAI as Map<string, string>;
  if (cache.has(key)) {
    const dataUrl = cache.get(key)!;
    return { success: true, imageUrl: dataUrl };
  }

  try {
    const prompt = `A professional fashion photograph of ${modelDescription} wearing a stylish outfit appropriate for ${occasion}. The outfit should be trendy and well-coordinated. Studio lighting, high-resolution fashion photography, clean white background, full body shot, front view.`;

    console.log("🎨 Generating nano outfit with DALL-E 3...");

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    });

    const imageUrl = response.data[0]?.url;

    if (!imageUrl) {
      return {
        success: false,
        error: "DALL-E did not return an image URL",
      };
    }

    console.log("✅ Successfully generated nano outfit");

    // Convert URL to data URL for caching
    const imageResponse = await fetch(imageUrl);
    const blob = await imageResponse.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    cache.set(key, dataUrl);

    return { success: true, imageUrl: dataUrl };
  } catch (error: any) {
    console.error("❌ OpenAI API error:", error);
    const errorMessage =
      error?.message || error?.error?.message || "Unknown error";
    return {
      success: false,
      error: `OpenAI API error: ${errorMessage}`,
    };
  }
}

// Generate outfit transfer from inspiration image
async function generateOutfitTransferInternal(
  inspirationImagePath: string,
  modelDescription: string = DEFAULT_BODY_DESCRIPTION
): Promise<OutfitGenerationResult> {
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    return {
      success: false,
      error: "Set VITE_OPENAI_API_KEY in your .env file for image generation.",
    };
  }

  try {
    console.log("🔍 Analyzing inspiration image...");

    // First, describe the outfit in the inspiration image
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe the outfit in this image in detail, focusing on clothing items, colors, patterns, and style. Be specific and descriptive.",
            },
            {
              type: "image_url",
              image_url: {
                url: inspirationImagePath,
              },
            },
          ],
        },
      ],
      max_tokens: 200,
    });

    const outfitDescription =
      response.choices[0]?.message?.content || "stylish outfit";

    console.log("Outfit description:", outfitDescription);

    // Now generate a new image with that outfit on the model
    const prompt = `A professional fashion photograph of ${modelDescription} wearing ${outfitDescription}. Studio lighting, high-resolution fashion photography, clean white background, full body shot, front view.`;

    console.log("🎨 Generating outfit transfer with DALL-E 3...");

    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    });

    const imageUrl = imageResponse.data[0]?.url;

    if (!imageUrl) {
      return {
        success: false,
        error: "DALL-E did not return an image URL",
      };
    }

    console.log("✅ Successfully generated outfit transfer");

    // Convert URL to data URL
    const imgResponse = await fetch(imageUrl);
    const blob = await imgResponse.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    return { success: true, imageUrl: dataUrl };
  } catch (error: any) {
    console.error("❌ OpenAI API error:", error);
    const errorMessage =
      error?.message || error?.error?.message || "Unknown error";
    return {
      success: false,
      error: `OpenAI API error: ${errorMessage}`,
    };
  }
}

// Backward compatibility class wrapper
export class OutfitGeneratorOpenAI {
  private static instance: OutfitGeneratorOpenAI;

  private constructor() {}

  static getInstance(): OutfitGeneratorOpenAI {
    if (!OutfitGeneratorOpenAI.instance) {
      OutfitGeneratorOpenAI.instance = new OutfitGeneratorOpenAI();
    }
    return OutfitGeneratorOpenAI.instance;
  }

  async generateOutfit(
    topPath: string,
    bottomPath: string,
    modelDescription: string = DEFAULT_BODY_DESCRIPTION,
    topId?: string,
    bottomId?: string
  ): Promise<OutfitGenerationResult> {
    return generateOutfitInternal(
      topPath,
      bottomPath,
      modelDescription,
      topId,
      bottomId
    );
  }

  async generateNanoOutfit(
    occasion: string,
    modelDescription: string = DEFAULT_BODY_DESCRIPTION
  ): Promise<OutfitGenerationResult> {
    return generateNanoOutfitInternal(occasion, modelDescription);
  }

  async generateOutfitTransfer(
    inspirationImagePath: string,
    modelDescription: string = DEFAULT_BODY_DESCRIPTION
  ): Promise<OutfitGenerationResult> {
    return generateOutfitTransferInternal(
      inspirationImagePath,
      modelDescription
    );
  }

  clearCache(): void {
    (window as any).__outfitCacheOpenAI = new Map<string, string>();
    (window as any).__nanoCacheOpenAI = new Map<string, string>();
  }

  getCacheSize(): number {
    const cache = (window as any).__outfitCacheOpenAI as
      | Map<string, string>
      | undefined;
    const nanoCache = (window as any).__nanoCacheOpenAI as
      | Map<string, string>
      | undefined;
    return (cache?.size || 0) + (nanoCache?.size || 0);
  }
}

// Export the singleton instance
export const outfitGeneratorOpenAI = OutfitGeneratorOpenAI.getInstance();

