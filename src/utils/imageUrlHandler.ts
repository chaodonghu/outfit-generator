/**
 * Utility functions for handling image URLs
 */

/**
 * Fetches an image from a URL and converts it to a File object
 * @param url - The URL of the image to fetch
 * @param filename - Optional custom filename (defaults to extracted from URL)
 * @returns Promise<File> - The image as a File object
 */
export async function fetchImageAsFile(
  url: string,
  filename?: string
): Promise<File> {
  try {
    // Fetch the image
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    // Get the blob
    const blob = await response.blob();

    // Determine filename
    let finalFilename = filename;
    if (!finalFilename) {
      // Try to extract filename from URL
      const urlPath = new URL(url).pathname;
      const urlFilename = urlPath.split('/').pop() || 'image.jpg';
      finalFilename = urlFilename;
    }

    // Ensure the file has an extension
    if (!finalFilename.includes('.')) {
      // Try to determine extension from MIME type
      const mimeType = blob.type;
      const extension = mimeType.split('/')[1] || 'jpg';
      finalFilename = `${finalFilename}.${extension}`;
    }

    // Create and return File object
    return new File([blob], finalFilename, { type: blob.type });
  } catch (error) {
    console.error('Error fetching image from URL:', error);
    throw new Error(
      `Failed to load image from URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validates if a string is a valid image URL
 * @param url - The URL to validate
 * @returns boolean - True if valid, false otherwise
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Check if it's http or https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompts the user for an image URL and returns it
 * @param category - The category of the clothing item (for the prompt message)
 * @returns string | null - The URL entered by the user, or null if cancelled
 */
export function promptForImageUrl(category: "tops" | "bottoms" | "shoes"): string | null {
  const categoryLabel = 
    category === "tops" ? "top" : 
    category === "bottoms" ? "bottom" : 
    "shoe";

  const url = window.prompt(
    `Enter the image URL for the ${categoryLabel}:\n\n` +
    `Example: https://example.com/image.jpg\n\n` +
    `Note: The image must be publicly accessible.`
  );

  if (!url) {
    return null;
  }

  const trimmedUrl = url.trim();
  
  if (!isValidImageUrl(trimmedUrl)) {
    alert("Invalid URL. Please enter a valid http or https URL.");
    return null;
  }

  return trimmedUrl;
}

