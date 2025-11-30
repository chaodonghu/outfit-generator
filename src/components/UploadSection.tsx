interface UploadSectionProps {
  isUploading: boolean;
  showUploadMenu: boolean;
  onToggleUploadMenu: () => void;
  onUploadTops: () => void;
  onUploadBottoms: () => void;
}

export function UploadSection({
  isUploading,
  showUploadMenu,
  onToggleUploadMenu,
  onUploadTops,
  onUploadBottoms,
}: UploadSectionProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: "0px",
        position: "relative",
      }}
    >
      <button
        onClick={onToggleUploadMenu}
        disabled={isUploading}
        style={{
          width: "40px",
          height: "40px",
          padding: "0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          borderRadius: "8px",
        }}
        title="Upload new clothing item"
      >
        📁
      </button>

      {/* Upload Menu */}
      {showUploadMenu && !isUploading && (
        <div
          className="upload-menu"
          style={{
            top: "48px",
            right: "0",
          }}
        >
          <button onClick={onUploadTops}>
            Upload Tops
          </button>
          <button onClick={onUploadBottoms}>
            Upload Bottoms
          </button>
        </div>
      )}
    </div>
  );
}
