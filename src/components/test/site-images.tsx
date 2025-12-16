'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Trash2, GripVertical, Loader2, X, ImagePlus, Pencil, Check } from 'lucide-react';
import type { ApiSiteImage } from '@/lib/api';
import {
  fetchSiteImages,
  uploadSiteImage,
  updateSiteImageCaption,
  deleteSiteImage,
  reorderSiteImages,
} from '@/lib/api';

/**
 * Props for the SiteImages component.
 * Why: Defines test context for image operations.
 */
interface SiteImagesProps {
  testId: string;
}

/** Maximum number of images per test (1: cover, 2: TOC, 3-4: remaining) */
const MAX_IMAGES = 4;

/** Maximum file size (2MB) */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/** Suggested captions for common test photos */
const SUGGESTED_CAPTIONS = [
  'Kentledge Setup',
  'Hydraulic Jack Placement',
  'Dial Gauge Arrangement',
  'Reference Beam Setup',
  'General Test Setup View',
];

/**
 * Image compression utility.
 * Why: Reduces file size before upload to stay under 2MB limit.
 */
async function compressImage(file: File, maxSizeMB: number = 2): Promise<File> {
  // If already under limit, return as-is
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Create blob URL and ensure cleanup
    const blobUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(blobUrl);
    };

    // Check canvas context is available
    if (!ctx) {
      cleanup();
      reject(new Error('Canvas context unavailable - cannot compress image'));
      return;
    }

    img.onload = () => {
      // Calculate dimensions (max 1920px on longest side)
      const maxDim = 1920;
      let { width, height } = img;
      
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = (height / width) * maxDim;
          width = maxDim;
        } else {
          width = (width / height) * maxDim;
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels
      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              cleanup();
              reject(new Error('Failed to compress image'));
              return;
            }

            if (blob.size <= maxSizeMB * 1024 * 1024 || quality <= 0.3) {
              cleanup();
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          'image/jpeg',
          quality
        );
      };

      tryCompress();
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image'));
    };

    img.src = blobUrl;
  });
}

/**
 * Site Images management component.
 * Why: Allows users to upload, caption, reorder, and delete test setup photos.
 */
export function SiteImages({ testId }: SiteImagesProps) {
  const [images, setImages] = useState<ApiSiteImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch images on mount
  useEffect(() => {
    loadImages();
  }, [testId]);

  const loadImages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchSiteImages(testId);
      setImages(data);
    } catch (err) {
      setError('Failed to load images');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setIsUploading(true);
    setError(null);

    try {
      for (const file of filesToUpload) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          setError('Only image files are allowed');
          continue;
        }

        // Compress if needed
        const processedFile = await compressImage(file);

        // Check size after compression
        if (processedFile.size > MAX_FILE_SIZE) {
          setError('Image too large even after compression. Please use a smaller image.');
          continue;
        }

        // Upload
        const uploaded = await uploadSiteImage(testId, processedFile);
        setImages((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      console.error(err);
    } finally {
      setIsUploading(false);
      // Clear file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCaptionEdit = (image: ApiSiteImage) => {
    setEditingCaptionId(image.id);
    setEditingCaption(image.caption || '');
  };

  const handleCaptionSave = async (imageId: string) => {
    try {
      const updated = await updateSiteImageCaption(testId, imageId, editingCaption || null);
      setImages((prev) => prev.map((img) => (img.id === imageId ? updated : img)));
      setEditingCaptionId(null);
      setEditingCaption('');
    } catch (err) {
      setError('Failed to update caption');
      console.error(err);
    }
  };

  const handleDelete = async (imageId: string) => {
    try {
      await deleteSiteImage(testId, imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      setDeleteConfirmId(null);
    } catch (err) {
      setError('Failed to delete image');
      console.error(err);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (imageId: string) => {
    setDraggedId(imageId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = images.findIndex((img) => img.id === draggedId);
    const targetIndex = images.findIndex((img) => img.id === targetId);

    if (draggedIndex !== targetIndex) {
      const newImages = [...images];
      const [removed] = newImages.splice(draggedIndex, 1);
      newImages.splice(targetIndex, 0, removed);
      setImages(newImages);
    }
  };

  const handleDragEnd = async () => {
    if (!draggedId) return;

    try {
      const orderedIds = images.map((img) => img.id);
      await reorderSiteImages(testId, orderedIds);
    } catch (err) {
      setError('Failed to save order');
      console.error(err);
      loadImages(); // Reload to reset order
    }

    setDraggedId(null);
  };

  const handleSuggestedCaption = (caption: string) => {
    setEditingCaption(caption);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Site Images</h2>
          <p className="text-sm text-slate-500">
            {images.length} of {MAX_IMAGES} images uploaded
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-red-700 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload button */}
      {images.length < MAX_IMAGES && (
        <>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            <span>Upload Images</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </>
      )}

      {/* Image grid */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <ImagePlus className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No images yet</p>
          <p className="text-sm">Upload test setup photos for the report</p>
        </div>
      ) : (
        <div className="space-y-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              draggable
              onDragStart={() => handleDragStart(image.id)}
              onDragOver={(e) => handleDragOver(e, image.id)}
              onDragEnd={handleDragEnd}
              className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-all ${
                draggedId === image.id ? 'opacity-50 scale-95' : ''
              } ${draggedId && draggedId !== image.id ? 'border-blue-300' : 'border-slate-200'}`}
            >
              <div className="flex">
                {/* Drag handle */}
                <div className="flex items-center px-2 bg-slate-50 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-5 h-5 text-slate-400" />
                </div>

                {/* Image thumbnail */}
                <div className="w-24 h-24 flex-shrink-0 bg-slate-100">
                  <img
                    src={image.url}
                    alt={image.caption || `Site image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 p-3 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 mb-1">Image {index + 1}</p>
                      
                      {editingCaptionId === image.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingCaption}
                            onChange={(e) => setEditingCaption(e.target.value)}
                            maxLength={200}
                            placeholder="Enter caption..."
                            className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          {/* Suggested captions */}
                          <div className="flex flex-wrap gap-1">
                            {SUGGESTED_CAPTIONS.filter(
                              (cap) => !images.some((img) => img.caption === cap)
                            )
                              .slice(0, 3)
                              .map((caption) => (
                                <button
                                  key={caption}
                                  onClick={() => handleSuggestedCaption(caption)}
                                  className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                                >
                                  {caption}
                                </button>
                              ))}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCaptionSave(image.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              <Check className="w-3 h-3" /> Save
                            </button>
                            <button
                              onClick={() => setEditingCaptionId(null)}
                              className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-slate-700 truncate">
                            {image.caption || (
                              <span className="italic text-slate-400">No caption</span>
                            )}
                          </p>
                          <button
                            onClick={() => handleCaptionEdit(image)}
                            className="flex-shrink-0 p-1 text-slate-400 hover:text-blue-600 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Delete button */}
                    {deleteConfirmId === image.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(image.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(image.id)}
                        className="flex-shrink-0 p-2 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info text */}
      <p className="text-xs text-slate-400 text-center">
        Drag images to reorder • Images will appear in the PDF report
      </p>
    </div>
  );
}

