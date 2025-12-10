import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export type ClothingCategory = "tops" | "bottoms" | "shoes";

export interface ClothingItem {
  id: string;
  name: string;
  category: ClothingCategory;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export interface GeneratedOutfit {
  id: string;
  top_id: string;
  bottom_id: string;
  shoe_id?: string;
  generated_image_url: string;
  created_at: string;
  updated_at: string;
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  CLOTHING: "clothing-images",
  GENERATED: "generated-outfits",
} as const;

// ALLOW drag and drop of images from the file explorer
// Storage utility functions
export async function uploadImage(
  bucket: keyof typeof STORAGE_BUCKETS,
  file: File,
  fileName: string
): Promise<string> {
  const bucketName = STORAGE_BUCKETS[bucket];

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    console.error("Error uploading image:", error);
    throw error;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export async function deleteImage(
  bucket: keyof typeof STORAGE_BUCKETS,
  fileName: string
): Promise<void> {
  const bucketName = STORAGE_BUCKETS[bucket];

  const { error } = await supabase.storage.from(bucketName).remove([fileName]);

  if (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
}

export function getImageUrl(
  bucket: keyof typeof STORAGE_BUCKETS,
  fileName: string
): string {
  const bucketName = STORAGE_BUCKETS[bucket];

  const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);

  return data.publicUrl;
}

// Database utility functions
export function pairKey(topId: string, bottomId: string, shoeId?: string) {
  return shoeId ? `${topId}__${bottomId}__${shoeId}` : `${topId}__${bottomId}`;
}

export async function getCachedComposite(
  topId: string,
  bottomId: string,
  shoeId?: string
) {
  let query = supabase
    .from("generated_outfits")
    .select("generated_image_url")
    .eq("top_id", topId)
    .eq("bottom_id", bottomId);

  if (shoeId) {
    query = query.eq("shoe_id", shoeId);
  } else {
    query = query.is("shoe_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Error fetching cached composite:", error);
    return null;
  }

  return data?.generated_image_url || null;
}

export async function saveCachedComposite(
  topId: string,
  bottomId: string,
  generatedImageUrl: string,
  shoeId?: string
) {
  const { error } = await supabase.from("generated_outfits").upsert({
    top_id: topId,
    bottom_id: bottomId,
    shoe_id: shoeId || null,
    generated_image_url: generatedImageUrl,
  });

  if (error) {
    console.error("Error saving cached composite:", error);
    throw error;
  }
}

export async function getClothingItems(
  category: ClothingCategory
): Promise<ClothingItem[]> {
  const { data, error } = await supabase
    .from("clothing_items")
    .select("*")
    .eq("category", category)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching clothing items:", error);
    return [];
  }

  return data || [];
}

export async function addClothingItem(
  name: string,
  category: ClothingCategory,
  imageFile: File
): Promise<ClothingItem> {
  // Generate unique filename
  const timestamp = Date.now();
  const fileExtension = imageFile.name.split(".").pop();
  const fileName = `${category}_${timestamp}.${fileExtension}`;

  // Upload image to storage
  const imageUrl = await uploadImage("CLOTHING", imageFile, fileName);

  // Save to database
  const { data, error } = await supabase
    .from("clothing_items")
    .insert({
      name,
      category,
      image_url: imageUrl,
    })
    .select()
    .single();

  if (error) {
    console.error("Error adding clothing item:", error);
    throw error;
  }

  return data;
}

export async function deleteClothingItem(id: string): Promise<void> {
  // Get the item to find the image URL
  const { data: item, error: fetchError } = await supabase
    .from("clothing_items")
    .select("image_url")
    .eq("id", id)
    .single();

  if (fetchError) {
    console.error("Error fetching clothing item:", fetchError);
    throw fetchError;
  }

  // Extract filename from URL
  const urlParts = item.image_url.split("/");
  const fileName = urlParts[urlParts.length - 1];

  // Delete from storage
  await deleteImage("CLOTHING", fileName);

  // Delete from database
  const { error } = await supabase.from("clothing_items").delete().eq("id", id);

  if (error) {
    console.error("Error deleting clothing item:", error);
    throw error;
  }
}
