import { useState, useCallback, useEffect } from 'react';

// Types
interface UseCarouselReturn {
  index: number;
  next: () => void;
  prev: () => void;
  setRandom: () => void;
  setIndex: (index: number) => void;
  setLength: (length: number) => void;
}

// Constants
const STORAGE_PREFIX = 'outfit98.';

export function useCarousel(initialLength: number, storageKey: string): UseCarouselReturn {
  const storageKeyFull = `${STORAGE_PREFIX}${storageKey}`;
  const [itemsLength, setItemsLength] = useState(initialLength);

  const [index, setIndexState] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKeyFull);
      if (saved) {
        const parsedIndex = parseInt(saved, 10);
        if (!isNaN(parsedIndex) && initialLength > 0) {
          return Math.max(0, Math.min(parsedIndex, initialLength - 1));
        }
      }
    } catch (error) {
      console.warn('Failed to load carousel state from localStorage:', error);
    }
    return 0;
  });

  // Adjust index when items length changes
  useEffect(() => {
    if (itemsLength === 0) {
      setIndexState(0);
    } else if (index >= itemsLength) {
      setIndexState(Math.max(0, itemsLength - 1));
    }
  }, [itemsLength, index]);

  const setIndex = useCallback((newIndex: number) => {
    if (itemsLength === 0) {
      setIndexState(0);
      return;
    }
    
    const clampedIndex = Math.max(0, Math.min(newIndex, itemsLength - 1));
    setIndexState(clampedIndex);
    
    try {
      localStorage.setItem(storageKeyFull, clampedIndex.toString());
    } catch (error) {
      console.warn('Failed to save carousel state to localStorage:', error);
    }
  }, [itemsLength, storageKeyFull]);

  const next = useCallback(() => {
    if (itemsLength === 0) return;
    setIndex((index + 1) % itemsLength);
  }, [index, itemsLength, setIndex]);

  const prev = useCallback(() => {
    if (itemsLength === 0) return;
    setIndex((index - 1 + itemsLength) % itemsLength);
  }, [index, itemsLength, setIndex]);

  const setRandom = useCallback(() => {
    if (itemsLength === 0) return;
    const randomIndex = Math.floor(Math.random() * itemsLength);
    setIndex(randomIndex);
  }, [itemsLength, setIndex]);

  const setLength = useCallback((newLength: number) => {
    setItemsLength(newLength);
  }, []);

  // Update localStorage when index changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKeyFull, index.toString());
    } catch (error) {
      console.warn('Failed to update carousel state in localStorage:', error);
    }
  }, [index, storageKeyFull]);

  return {
    index,
    next,
    prev,
    setRandom,
    setIndex,
    setLength
  };
}
