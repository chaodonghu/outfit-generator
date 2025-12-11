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
    throw fetchError;
  }

  // Extract filename from URL
  const urlParts = item.image_url.split("/");
  const fileName = urlParts[urlParts.length - 1];

  // Track any errors but continue with both operations
  let storageError = null;
  let dbError = null;

  // Try to delete from storage first
  try {
    await deleteImage("CLOTHING", fileName);
  } catch (error) {
    console.error("Failed to delete image from storage:", error);
    storageError = error;
    // Continue to delete from database even if storage deletion fails
  }

  // Delete from database
  const { error } = await supabase.from("clothing_items").delete().eq("id", id);
  if (error) {
    dbError = error;
  }

  // If both operations failed, throw an error
  if (storageError && dbError) {
    throw new Error(`Failed to delete both storage and database record: Storage: ${storageError}, Database: ${dbError}`);
  }
  
  // If only database deletion failed, throw that error (more critical)
  if (dbError) {
    throw dbError;
  }

  // If only storage deletion failed, log a warning but don't throw
  // (the database record is gone, which is the main concern)
  if (storageError) {
    console.warn("Item deleted from database but storage file may still exist:", storageError);
  }
}

/**
 * Cleanup utility to remove orphaned storage files that don't have database records
 * Useful for cleaning up after partial deletion failures
 */
export async function cleanupOrphanedStorageFiles(): Promise<{
  deletedFiles: string[];
  errors: string[];
}> {
  const deletedFiles: string[] = [];
  const errors: string[] = [];

  try {
    // Get all clothing items from database
    const { data: dbItems, error: dbError } = await supabase
      .from("clothing_items")
      .select("image_url");

    if (dbError) {
      throw dbError;
    }

    // Extract filenames from database URLs
    const dbFilenames = new Set(
      dbItems?.map((item) => {
        const urlParts = item.image_url.split("/");
        return urlParts[urlParts.length - 1];
      }) || []
    );

    // Get all files from storage
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from(STORAGE_BUCKETS.CLOTHING)
      .list("", { limit: 1000 });

    if (storageError) {
      throw storageError;
    }

    // Find orphaned files (in storage but not in database)
    const orphanedFiles = storageFiles?.filter(
      (file) => !dbFilenames.has(file.name)
    ) || [];

    // Delete orphaned files
    for (const file of orphanedFiles) {
      try {
        await deleteImage("CLOTHING", file.name);
        deletedFiles.push(file.name);
        console.log(`Deleted orphaned file: ${file.name}`);
      } catch (error) {
        const errorMsg = `Failed to delete ${file.name}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return { deletedFiles, errors };
  } catch (error) {
    console.error("Error during cleanup:", error);
    throw error;
  }
}

/**
 * Cleanup utility to remove orphaned database records that don't have storage files
 * Useful for cleaning up after storage files were manually deleted
 */
export async function cleanupOrphanedDatabaseRecords(): Promise<{
  deletedRecords: Array<{ id: string; name: string }>;
  errors: string[];
}> {
  const deletedRecords: Array<{ id: string; name: string }> = [];
  const errors: string[] = [];

  try {
    // Get all clothing items from database
    const { data: dbItems, error: dbError } = await supabase
      .from("clothing_items")
      .select("id, name, image_url");

    if (dbError) {
      throw dbError;
    }

    if (!dbItems || dbItems.length === 0) {
      return { deletedRecords, errors };
    }

    // Get all files from storage
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from(STORAGE_BUCKETS.CLOTHING)
      .list("", { limit: 1000 });

    if (storageError) {
      throw storageError;
    }

    // Create set of storage filenames
    const storageFilenames = new Set(
      storageFiles?.map((file) => file.name) || []
    );

    // Find orphaned database records (in database but not in storage)
    const orphanedRecords = dbItems.filter((item) => {
      const urlParts = item.image_url.split("/");
      const fileName = urlParts[urlParts.length - 1];
      return !storageFilenames.has(fileName);
    });

    // Delete orphaned records
    for (const record of orphanedRecords) {
      try {
        const { error } = await supabase
          .from("clothing_items")
          .delete()
          .eq("id", record.id);

        if (error) throw error;

        deletedRecords.push({ id: record.id, name: record.name });
        console.log(`Deleted orphaned record: ${record.name} (${record.id})`);
      } catch (error) {
        const errorMsg = `Failed to delete record ${record.name}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return { deletedRecords, errors };
  } catch (error) {
    console.error("Error during cleanup:", error);
    throw error;
  }
}

/**
 * Complete cleanup - removes both orphaned storage files and database records
 */
export async function cleanupAllOrphans(): Promise<{
  storageCleanup: { deletedFiles: string[]; errors: string[] };
  databaseCleanup: { deletedRecords: Array<{ id: string; name: string }>; errors: string[] };
}> {
  console.log("Starting complete cleanup...");
  
  const storageCleanup = await cleanupOrphanedStorageFiles();
  console.log(`Storage cleanup: deleted ${storageCleanup.deletedFiles.length} files, ${storageCleanup.errors.length} errors`);
  
  const databaseCleanup = await cleanupOrphanedDatabaseRecords();
  console.log(`Database cleanup: deleted ${databaseCleanup.deletedRecords.length} records, ${databaseCleanup.errors.length} errors`);
  
  return { storageCleanup, databaseCleanup };
}

// Make cleanup functions available in browser console for manual cleanup
if (typeof window !== "undefined") {
  (window as any).cleanupOrphanedStorageFiles = cleanupOrphanedStorageFiles;
  (window as any).cleanupOrphanedDatabaseRecords = cleanupOrphanedDatabaseRecords;
  (window as any).cleanupAllOrphans = cleanupAllOrphans;
}
