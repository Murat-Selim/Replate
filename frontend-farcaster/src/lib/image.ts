/**
 * Compresses an image file on the client side using HTML5 Canvas.
 * Resizes the image so that its width and height do not exceed maxWidth and maxHeight,
 * maintaining the aspect ratio, and exports it as a JPEG data URL.
 *
 * @param file The input image File.
 * @param maxWidth The maximum allowed width of the compressed image.
 * @param maxHeight The maximum allowed height of the compressed image.
 * @param quality The JPEG compression quality (0.0 to 1.0).
 * @returns A promise that resolves to the compressed JPEG base64 data URL.
 */
export function compressImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.8,
  maxDataUrlLength = Infinity
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create an object URL for the file to load it into an Image object
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      // Clean up the object URL
      URL.revokeObjectURL(objectUrl);

      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while maintaining aspect ratio
      const scale = Math.min(1, maxWidth / width, maxHeight / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get 2D context from canvas"));
        return;
      }

      // Draw the image onto the canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Export the canvas as a JPEG data URL with the specified quality
      let compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      while (compressedDataUrl.length > maxDataUrlLength) {
        if (quality > 0.6) quality = Math.max(0.6, quality - 0.1);
        else {
          if (Math.max(width, height) < 1200) {
            reject(new Error("Receipt photo is too large. Try cropping it to the receipt."));
            return;
          }
          width = Math.round(width * 0.85);
          height = Math.round(height * 0.85);
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
        }
        compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(compressedDataUrl);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
}
