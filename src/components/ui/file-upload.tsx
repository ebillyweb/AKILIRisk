'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { resolveAdvisorLogoSrcForPreview } from '@/lib/branding/advisor-logo-display';
import { LOGO_MAX_BYTES } from '@/lib/validation/branding';

const LOGO_MAX_MB = LOGO_MAX_BYTES / (1024 * 1024);

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in bytes
  onUpload: (file: File) => Promise<string>; // Returns URL of uploaded file
  currentFile?: string | null;
  disabled?: boolean;
  className?: string;
  label?: string;
  description?: string;
}

interface UploadState {
  status: 'idle' | 'dragover' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
  uploadedUrl?: string;
}

const ALLOWED_TYPES = {
  'image/png': { extension: '.png', icon: '🖼️' },
  'image/jpeg': { extension: '.jpg', icon: '🖼️' },
  'image/svg+xml': { extension: '.svg', icon: '🎨' },
};

export function FileUpload({
  accept = 'image/*',
  maxSize = LOGO_MAX_BYTES,
  onUpload,
  currentFile,
  disabled = false,
  className = '',
  label = 'Upload Logo',
  description = `Drag and drop your logo here, or click to browse. PNG, JPEG, or SVG up to ${LOGO_MAX_MB}MB.`,
}: FileUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Validate file before upload
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!Object.keys(ALLOWED_TYPES).includes(file.type)) {
      return `File type ${file.type} not supported. Please use PNG, JPEG, or SVG.`;
    }

    // Check file size
    if (file.size > maxSize) {
      return `File size ${formatFileSize(file.size)} exceeds maximum allowed size of ${formatFileSize(maxSize)}.`;
    }

    // Check file name length
    if (file.name.length > 100) {
      return 'File name is too long. Please use a shorter file name.';
    }

    return null;
  };

  // Handle file upload with progress simulation
  const handleFileUpload = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadState({
        status: 'error',
        error: validationError,
      });
      return;
    }

    setUploadState({ status: 'uploading', progress: 0 });

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadState(prev => ({
          ...prev,
          progress: Math.min((prev.progress || 0) + Math.random() * 30, 90),
        }));
      }, 200);

      // Perform the actual upload
      const uploadedUrl = await onUpload(file);

      // Complete the progress
      clearInterval(progressInterval);
      setUploadState({
        status: 'success',
        progress: 100,
        uploadedUrl,
      });

      // Reset to idle after success message
      setTimeout(() => {
        setUploadState({ status: 'idle' });
      }, 2000);

    } catch (error) {
      setUploadState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
      });
    }
  }, [onUpload, maxSize]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && uploadState.status === 'idle') {
      setUploadState({ status: 'dragover' });
    }
  }, [disabled, uploadState.status]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (uploadState.status === 'dragover') {
      setUploadState({ status: 'idle' });
    }
  }, [uploadState.status]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setUploadState({ status: 'idle' });

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [disabled, handleFileUpload]);

  // Handle file input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
    // Reset input value to allow re-uploading the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileUpload]);

  // Handle click to open file dialog
  const handleClick = useCallback(() => {
    if (!disabled && uploadState.status !== 'uploading') {
      fileInputRef.current?.click();
    }
  }, [disabled, uploadState.status]);

  // Clear error state
  const clearError = useCallback(() => {
    setUploadState({ status: 'idle' });
  }, []);

  const previewSrc = currentFile ? resolveAdvisorLogoSrcForPreview(currentFile) : '';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer
          ${uploadState.status === 'dragover' ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-muted/50'}
          ${uploadState.status === 'uploading' ? 'border-blue-300 bg-blue-50' : ''}
          ${uploadState.status === 'success' ? 'border-green-300 bg-green-50' : ''}
          ${uploadState.status === 'error' ? 'border-destructive bg-destructive/5' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="sr-only"
          disabled={disabled}
        />

        <div className="flex flex-col items-center justify-center text-center space-y-4">
          {/* Status Icon */}
          <div className="p-3 rounded-full bg-muted">
            {uploadState.status === 'uploading' && (
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            )}
            {uploadState.status === 'success' && (
              <Check className="h-6 w-6 text-green-600" />
            )}
            {uploadState.status === 'error' && (
              <AlertCircle className="h-6 w-6 text-destructive" />
            )}
            {(uploadState.status === 'idle' || uploadState.status === 'dragover') && (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          {/* Status Text */}
          {uploadState.status === 'uploading' && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Uploading...</p>
              <Progress value={uploadState.progress} className="w-32" />
            </div>
          )}

          {uploadState.status === 'success' && (
            <p className="text-sm font-medium text-green-600">Upload successful!</p>
          )}

          {uploadState.status === 'error' && (
            <p className="text-sm font-medium text-destructive">Upload failed</p>
          )}

          {(uploadState.status === 'idle' || uploadState.status === 'dragover') && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          )}

          {/* Current logo preview */}
          {previewSrc && uploadState.status === 'idle' && (
            <div className="mt-4 w-full p-4 bg-background rounded-lg border">
              <p className="text-sm font-medium mb-3">Current Logo</p>
              <div className="flex items-center justify-center rounded-md bg-muted/30 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc}
                  alt="Current logo"
                  className="max-h-24 max-w-full object-contain"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {uploadState.status === 'error' && uploadState.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{uploadState.error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="h-auto p-1 hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Button (alternative to drag-drop) */}
      {uploadState.status === 'idle' && (
        <Button
          type="button"
          variant="outline"
          onClick={handleClick}
          disabled={disabled}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          Choose File
        </Button>
      )}
    </div>
  );
}