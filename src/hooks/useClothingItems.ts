import { useState, useEffect, useCallback } from "react";
import {
  addClothingItem,
  getClothingItems,
  deleteClothingItem,
  ClothingItem as SupabaseClothingItem,
  ClothingCategory,
} from "../lib/supabase";
import { LocalClothingItem } from "../types";

interface CarouselControls {
  index: number;
  setIndex: (index: number) => void;
}

interface UseClothingItemsReturn {
  topsList: LocalClothingItem[];
  bottomsList: LocalClothingItem[];
  shoesList: LocalClothingItem[];
  isLoading: boolean;
  isUploading: boolean;
  handleFileUpload: (category: ClothingCategory, droppedFiles?: FileList) => Promise<void>;
  handleUrlUpload: (category: ClothingCategory) => Promise<void>;
  handleDeleteItem: (category: ClothingCategory, itemId: string, currentIndex: number) => Promise<void>;
  handleImageError: (category: ClothingCategory, itemId: string) => void;
}

const CATEGORY_CONFIG = {
  tops: { yOffset: -20, zIndex: 10, label: "Top" },
  bottoms: { yOffset: 50, zIndex: 9, label: "Bottom" },
  shoes: { yOffset: 120, zIndex: 8, label: "Shoe" },
} as const;

/**
 * Custom hook to manage clothing items (loading, uploading, deleting)
 */
export function useClothingItems(
  topsCarousel: CarouselControls,
  bottomsCarousel: CarouselControls,
  shoesCarousel: CarouselControls
): UseClothingItemsReturn {
  const [topsList, setTopsList] = useState<LocalClothingItem[]>([]);
  const [bottomsList, setBottomsList] = useState<LocalClothingItem[]>([]);
  const [shoesList, setShoesList] = useState<LocalClothingItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Helper function to validate if an image URL is accessible
  const validateImageUrl = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return response.ok;
    } catch (error) {
      console.error(`Failed to validate image URL: ${url}`, error);
      return false;
    }
  };

  // Convert and validate Supabase items
  const convertAndValidate = async (
    items: SupabaseClothingItem[],
    category: ClothingCategory
  ): Promise<LocalClothingItem[]> => {
    const validatedItems: LocalClothingItem[] = [];
    const config = CATEGORY_CONFIG[category];
    const itemsToDelete: string[] = [];

    for (const item of items) {
      const isValid = await validateImageUrl(item.image_url);
      if (isValid) {
        validatedItems.push({
          id: item.id,
          name: item.name,
          imageUrl: item.image_url,
          offset: {
            x: 0,
            y: config.yOffset,
            scale: 1.0,
            zIndex: config.zIndex,
          },
        });
      } else {
        console.warn(`Skipping item ${item.id} (${item.name}) - image not accessible: ${item.image_url}`);
        itemsToDelete.push(item.id);
      }
    }

    // Delete all invalid items from database in parallel after validation
    if (itemsToDelete.length > 0) {
      console.log(`Removing ${itemsToDelete.length} ${category} with broken images from database...`);
      await Promise.allSettled(
        itemsToDelete.map((id) =>
          deleteClothingItem(id).catch((error) => {
            console.error(`Error deleting item ${id}:`, error);
          })
        )
      );
    }

    return validatedItems;
  };

  // Load clothing items from Supabase on mount
  useEffect(() => {
    const loadClothingItems = async () => {
      setIsLoading(true);
      try {
        const [supabaseTops, supabaseBottoms, supabaseShoes] = await Promise.all([
          getClothingItems("tops"),
          getClothingItems("bottoms"),
          getClothingItems("shoes"),
        ]);

        // Validate all items concurrently
        const [convertedTops, convertedBottoms, convertedShoes] = await Promise.all([
          convertAndValidate(supabaseTops, "tops"),
          convertAndValidate(supabaseBottoms, "bottoms"),
          convertAndValidate(supabaseShoes, "shoes"),
        ]);

        setTopsList(convertedTops);
        setBottomsList(convertedBottoms);
        setShoesList(convertedShoes);
      } catch (error) {
        console.error("Error loading clothing items from Supabase:", error);
        setTopsList([]);
        setBottomsList([]);
        setShoesList([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadClothingItems();
  }, []);

  // Get the appropriate state setter and list for a category
  const getCategoryState = (category: ClothingCategory) => {
    switch (category) {
      case "tops":
        return { list: topsList, setList: setTopsList, carousel: topsCarousel };
      case "bottoms":
        return { list: bottomsList, setList: setBottomsList, carousel: bottomsCarousel };
      case "shoes":
        return { list: shoesList, setList: setShoesList, carousel: shoesCarousel };
    }
  };

  // Handle file upload
  const handleFileUpload = useCallback(
    async (category: ClothingCategory, droppedFiles?: FileList) => {
      const { list, setList } = getCategoryState(category);
      const config = CATEGORY_CONFIG[category];

      const processFiles = async (files: FileList) => {
        if (files && files.length > 0) {
          setIsUploading(true);

          try {
            const uploadPromises = Array.from(files).map(async (file, index) => {
              const nextNumber = list.length + index + 1;
              const name = `${config.label} ${nextNumber}`;

              const newItem = await addClothingItem(name, category, file);

              return {
                id: newItem.id,
                name: newItem.name,
                imageUrl: newItem.image_url,
                offset: {
                  x: 0,
                  y: config.yOffset,
                  scale: 1.0,
                  zIndex: config.zIndex,
                },
              } as LocalClothingItem;
            });

            const newItems = await Promise.all(uploadPromises);
            setList((prev) => [...prev, ...newItems]);
          } catch (error) {
            console.error(`Error uploading ${category}:`, error);
            alert(`Failed to upload some ${category}. Please try again.`);
          } finally {
            setIsUploading(false);
          }
        }
      };

      if (droppedFiles) {
        await processFiles(droppedFiles);
      } else {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.multiple = true;

        input.onchange = async (event) => {
          const files = (event.target as HTMLInputElement).files;
          if (files) {
            await processFiles(files);
          }
        };

        input.click();
      }
    },
    [topsList.length, bottomsList.length, shoesList.length, topsCarousel, bottomsCarousel, shoesCarousel]
  );

  // Handle URL-based upload
  const handleUrlUpload = useCallback(
    async (category: ClothingCategory) => {
      const { fetchImageAsFile, promptForImageUrl } = await import("../utils/imageUrlHandler");
      const { list, setList } = getCategoryState(category);
      const config = CATEGORY_CONFIG[category];

      const url = promptForImageUrl(category);
      if (!url) return;

      setIsUploading(true);

      try {
        const file = await fetchImageAsFile(url);
        const nextNumber = list.length + 1;
        const name = `${config.label} ${nextNumber}`;

        const newItem = await addClothingItem(name, category, file);

        const newClothingItem: LocalClothingItem = {
          id: newItem.id,
          name: newItem.name,
          imageUrl: newItem.image_url,
          offset: {
            x: 0,
            y: config.yOffset,
            scale: 1.0,
            zIndex: config.zIndex,
          },
        };

        setList((prev) => [...prev, newClothingItem]);
      } catch (error) {
        console.error(`Error uploading from URL:`, error);
        alert(
          `Failed to load image from URL. Please make sure:\n` +
            `1. The URL is publicly accessible\n` +
            `2. The URL points to a valid image file\n` +
            `3. CORS is enabled on the image server\n\n` +
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      } finally {
        setIsUploading(false);
      }
    },
    [topsList.length, bottomsList.length, shoesList.length, topsCarousel, bottomsCarousel, shoesCarousel]
  );

  // Handle delete item
  const handleDeleteItem = useCallback(
    async (category: ClothingCategory, itemId: string, currentIndex: number) => {
      if (!confirm("Are you sure you want to delete this item?")) {
        return;
      }

      const { setList, carousel } = getCategoryState(category);

      try {
        await deleteClothingItem(itemId);

        setList((prev) => {
          const newList = prev.filter((item) => item.id !== itemId);
          // Adjust carousel index if needed
          if (currentIndex >= newList.length && newList.length > 0) {
            carousel.setIndex(newList.length - 1);
          } else if (newList.length === 0) {
            carousel.setIndex(0);
          }
          return newList;
        });
      } catch (error) {
        console.error(`Error deleting item:`, error);
        alert(`Failed to delete item. Please try again.`);
      }
    },
    [topsCarousel, bottomsCarousel, shoesCarousel]
  );

  // Handle image load errors
  const handleImageError = useCallback(
    (category: ClothingCategory, itemId: string) => {
      console.error(`Failed to load image for ${category} item ${itemId}. Removing from list.`);

      const { setList, carousel } = getCategoryState(category);

      setList((prev) => {
        const item = prev.find((i) => i.id === itemId);
        if (item) {
          alert(`Removed ${item.name} - image no longer accessible`);
        }
        const newList = prev.filter((item) => item.id !== itemId);

        // Adjust carousel index if needed
        if (carousel.index >= newList.length && newList.length > 0) {
          carousel.setIndex(newList.length - 1);
        } else if (newList.length === 0) {
          carousel.setIndex(0);
        }

        return newList;
      });

      // Delete from database as well
      deleteClothingItem(itemId).catch((error) => {
        console.error("Error deleting item from database:", error);
      });
    },
    [topsCarousel, bottomsCarousel, shoesCarousel]
  );

  return {
    topsList,
    bottomsList,
    shoesList,
    isLoading,
    isUploading,
    handleFileUpload,
    handleUrlUpload,
    handleDeleteItem,
    handleImageError,
  };
}

