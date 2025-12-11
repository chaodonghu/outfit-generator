import React, { useState } from "react";
import { LocalClothingItem } from "../types";

interface CarouselControls {
  index: number;
  prev: () => void;
  next: () => void;
}

interface ClothingCarouselProps {
  items: LocalClothingItem[];
  carousel: CarouselControls;
  category: "tops" | "bottoms" | "shoes";
  onImageError: (itemId: string) => void;
  isLoading?: boolean;
  onUploadFile: (files?: FileList) => void;
  onUploadFromUrl: () => void;
  onDeleteItem: (itemId: string, currentIndex: number) => void;
  isUploading?: boolean;
}

export function ClothingCarousel({
  items,
  carousel,
  category,
  onImageError,
  isLoading = false,
  onUploadFile,
  onUploadFromUrl,
  onDeleteItem,
  isUploading = false,
}: ClothingCarouselProps) {
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const isTops = category === "tops";
  const sectionClass = isTops
    ? "section-container"
    : "section-container bottoms-section";
  const emptyMessage = 
    category === "tops" 
      ? "No tops available" 
      : category === "bottoms" 
      ? "No bottoms available" 
      : "No shoes available";
  
  const categoryLabel = 
    category === "tops" 
      ? "Tops" 
      : category === "bottoms" 
      ? "Bottoms" 
      : "Shoes";

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if leaving the clothes-window
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Pass the dropped files to the upload handler
      onUploadFile(files);
    }
  };

  return (
    <div className={sectionClass} style={{ position: "relative" }}>
      {/* Action buttons in top corners */}
      <div style={{ 
        position: "absolute", 
        top: "8px", 
        left: "8px",
        right: "8px",
        display: "flex",
        justifyContent: "space-between",
        zIndex: 100,
        pointerEvents: "none", // Allow clicks to pass through the container
      }}>
        {/* Delete button in top-left corner (only shown when items exist) */}
        {items.length > 0 && (
          <button
            onClick={() => onDeleteItem(items[carousel.index].id, carousel.index)}
            disabled={isUploading || isLoading}
            className="delete-button"
            style={{
              width: "32px",
              height: "32px",
              padding: "0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              borderRadius: "6px",
              cursor: isUploading ? "not-allowed" : "pointer",
              backgroundColor: "rgba(220, 53, 69, 0.1)",
              color: "#dc3545",
              border: "1px solid rgba(220, 53, 69, 0.3)",
              pointerEvents: "auto",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              if (!isUploading && !isLoading) {
                e.currentTarget.style.backgroundColor = "#dc3545";
                e.currentTarget.style.color = "white";
                e.currentTarget.style.borderColor = "#dc3545";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(220, 53, 69, 0.1)";
              e.currentTarget.style.color = "#dc3545";
              e.currentTarget.style.borderColor = "rgba(220, 53, 69, 0.3)";
            }}
            title={`Delete current ${category.slice(0, -1)}`}
          >
            ✕
          </button>
        )}
        
        {/* Upload button in top-right corner */}
        <div style={{ 
          marginLeft: "auto",
          pointerEvents: "auto", // Enable clicks on the button
        }}>
          <button
            onClick={() => setShowUploadMenu(!showUploadMenu)}
            disabled={isUploading || isLoading}
            style={{
              width: "32px",
              height: "32px",
              padding: "0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              borderRadius: "4px",
              cursor: isUploading ? "not-allowed" : "pointer",
            }}
            title={`Upload ${categoryLabel}`}
          >
            📁
          </button>

          {/* Upload dropdown menu */}
          {showUploadMenu && !isUploading && (
            <div
              className="upload-menu"
              style={{
                position: "absolute",
                top: "40px",
                right: "0",
                minWidth: "160px",
              }}
            >
              <button 
                onClick={() => {
                  onUploadFile();
                  setShowUploadMenu(false);
                }}
                style={{ width: "100%" }}
              >
                📂 Browse Files
              </button>
              <button 
                onClick={() => {
                  onUploadFromUrl();
                  setShowUploadMenu(false);
                }}
                style={{ width: "100%" }}
              >
                🔗 From URL
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="nav-buttons">
        <button
          className="nav-button left-button"
          onClick={carousel.prev}
          title={`Previous ${category.slice(0, -1)}`}
          aria-label={`Previous ${category.slice(0, -1)}`}
          disabled={items.length === 0 || isLoading}
        />
        <div 
          className="clothes-window"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            position: "relative",
            border: isDragging ? "2px dashed #4a90e2" : undefined,
            backgroundColor: isDragging ? "rgba(74, 144, 226, 0.1)" : undefined,
            transition: "all 0.2s ease",
          }}
        >
          {isDragging && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(74, 144, 226, 0.15)",
                zIndex: 10,
                pointerEvents: "none",
                fontSize: "16px",
                fontWeight: 600,
                color: "#4a90e2",
              }}
            >
              📁 Drop files here
            </div>
          )}
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
              onError={() => onImageError(items[carousel.index].id)}
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
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 500 }}>{emptyMessage}</div>
              <div style={{ fontSize: "12px", color: "#888" }}>
                Drag & drop files here or
              </div>
              <div style={{ 
                display: "flex", 
                flexDirection: "column", 
                gap: "8px",
                width: "80%"
              }}>
                <button 
                  onClick={() => onUploadFile()}
                  disabled={isUploading}
                  style={{
                    padding: "8px 16px",
                    fontSize: "12px",
                  }}
                >
                  📂 Browse Files
                </button>
                <button 
                  onClick={onUploadFromUrl}
                  disabled={isUploading}
                  style={{
                    padding: "8px 16px",
                    fontSize: "12px",
                  }}
                >
                  🔗 From URL
                </button>
              </div>
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
