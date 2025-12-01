import { LocalClothingItem } from "../types";

interface CarouselControls {
  index: number;
  prev: () => void;
  next: () => void;
}

interface ClothingCarouselProps {
  items: LocalClothingItem[];
  carousel: CarouselControls;
  category: "tops" | "bottoms";
  onImageError: (imageUrl: string) => void;
  isLoading?: boolean;
}

export function ClothingCarousel({
  items,
  carousel,
  category,
  onImageError,
  isLoading = false,
}: ClothingCarouselProps) {
  const isTops = category === "tops";
  const sectionClass = isTops
    ? "section-container"
    : "section-container bottoms-section";
  const emptyMessage = isTops ? "No tops available" : "No bottoms available";

  return (
    <div className={sectionClass}>
      <div className="nav-buttons">
        <button
          className="nav-button left-button"
          onClick={carousel.prev}
          title={`Previous ${category.slice(0, -1)}`}
          aria-label={`Previous ${category.slice(0, -1)}`}
          disabled={items.length === 0 || isLoading}
        />
        <div className="clothes-window">
          {isLoading ? (
            <div className="loading-indicator">
              <div className="loading-spinner" />
              <div style={{ fontSize: "12px" }}>Loading {category}...</div>
            </div>
          ) : items.length > 0 && items[carousel.index] ? (
            <img
              src={items[carousel.index].imageUrl}
              alt={items[carousel.index].name}
              className="clothing-item"
              onError={() => onImageError(items[carousel.index].imageUrl)}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--macos-text-secondary)",
                fontSize: "13px",
                textAlign: "center",
                gap: "8px",
              }}
            >
              <div>{emptyMessage}</div>
              <div style={{ fontSize: "11px" }}>Click folder to upload</div>
            </div>
          )}
        </div>
        <button
          className="nav-button right-button"
          onClick={carousel.next}
          title={`Next ${category.slice(0, -1)}`}
          aria-label={`Next ${category.slice(0, -1)}`}
          disabled={items.length === 0 || isLoading}
        />
      </div>
    </div>
  );
}
