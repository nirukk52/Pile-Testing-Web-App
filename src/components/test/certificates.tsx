'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, FileText, Loader2, X, ExternalLink, AlertCircle } from 'lucide-react';
import type { ApiCertificate } from '@/lib/api';
import { fetchCertificates, uploadCertificate, deleteCertificate } from '@/lib/api';

/**
 * Props for the Certificates component.
 * Why: Defines test context for certificate operations.
 */
interface CertificatesProps {
  testId: string;
}

/** Maximum certificates per test */
const MAX_CERTIFICATES = 6;

/** Maximum file size (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Simple Certificates component.
 * Why: Upload calibration certificate PDFs for IS 2911 compliance. No complex categorization.
 */
export function Certificates({ testId }: CertificatesProps) {
  const [certificates, setCertificates] = useState<ApiCertificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCertificates();
  }, [testId]);

  const loadCertificates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchCertificates(testId);
      setCertificates(data);
    } catch (err) {
      setError('Failed to load certificates');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_CERTIFICATES - certificates.length;
    if (remainingSlots <= 0) {
      setError(`Maximum ${MAX_CERTIFICATES} certificates allowed`);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files).slice(0, remainingSlots)) {
        // Validate PDF
        if (file.type !== 'application/pdf') {
          setError('Only PDF files are allowed');
          continue;
        }

        // Validate size
        if (file.size > MAX_FILE_SIZE) {
          setError(`File too large. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
          continue;
        }

        const uploaded = await uploadCertificate(testId, file);
        setCertificates((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (certId: string) => {
    try {
      await deleteCertificate(testId, certId);
      setCertificates((prev) => prev.filter((c) => c.id !== certId));
      setDeleteConfirmId(null);
    } catch (err) {
      setError('Failed to delete certificate');
      console.error(err);
    }
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
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Calibration Certificates</h2>
        <p className="text-sm text-slate-500">
          {certificates.length} of {MAX_CERTIFICATES} certificates uploaded
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload button */}
      {certificates.length < MAX_CERTIFICATES && (
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
          <span>Upload PDF Certificate</span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Certificate list */}
      {certificates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <FileText className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No certificates yet</p>
          <p className="text-sm">Upload calibration certificate PDFs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {certificates.map((cert, index) => (
            <div
              key={cert.id}
              className="bg-white rounded-lg border border-slate-200 shadow-sm p-4"
            >
              <div className="flex items-center gap-3">
                {/* PDF icon */}
                <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-red-600" />
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {cert.fileName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Certificate {index + 1}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {/* View */}
                  <a
                    href={cert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View PDF"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {/* Delete */}
                  {deleteConfirmId === cert.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(cert.id)}
                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(cert.id)}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-slate-400 text-center">
        PDFs will be appended to the generated report
      </p>
    </div>
  );
}
