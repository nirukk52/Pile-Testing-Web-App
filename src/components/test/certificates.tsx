'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, FileText, Loader2, X, Check, ExternalLink, AlertCircle } from 'lucide-react';
import type { ApiCertificate, CertificateType } from '@/lib/api';
import {
  fetchCertificates,
  uploadCertificate,
  deleteCertificate,
  CERTIFICATE_TYPE_LABELS,
} from '@/lib/api';

/**
 * Props for the Certificates component.
 * Why: Defines test context for certificate operations.
 */
interface CertificatesProps {
  testId: string;
}

/** All available certificate types */
const ALL_CERTIFICATE_TYPES: CertificateType[] = [
  'HYDRAULIC_JACK',
  'PRESSURE_GAUGE',
  'DIAL_GAUGE',
  'PROVING_RING',
  'OTHER',
];

/** Maximum file size (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Certificates management component.
 * Why: Allows users to upload and manage calibration certificate PDFs for IS 2911 compliance.
 */
export function Certificates({ testId }: CertificatesProps) {
  const [certificates, setCertificates] = useState<ApiCertificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<CertificateType | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch certificates on mount
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

  // Get certificate types that don't have an uploaded certificate yet
  const availableTypes = ALL_CERTIFICATE_TYPES.filter(
    (type) => !certificates.some((cert) => cert.certificateType === type)
  );

  // Get certificate for a specific type
  const getCertificateForType = (type: CertificateType) => {
    return certificates.find((cert) => cert.certificateType === type);
  };

  const handleTypeSelect = (type: CertificateType) => {
    setSelectedType(type);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedType) {
      setSelectedType(null);
      return;
    }

    const file = files[0];
    setIsUploading(true);
    setError(null);

    try {
      // Validate file type
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are allowed');
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        return;
      }

      // Upload certificate
      const uploaded = await uploadCertificate(testId, file, selectedType);
      
      // Update state - replace if same type exists, otherwise add
      setCertificates((prev) => {
        const filtered = prev.filter((cert) => cert.certificateType !== selectedType);
        return [...filtered, uploaded];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      console.error(err);
    } finally {
      setIsUploading(false);
      setSelectedType(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (certId: string) => {
    try {
      await deleteCertificate(testId, certId);
      setCertificates((prev) => prev.filter((cert) => cert.id !== certId));
      setDeleteConfirmId(null);
    } catch (err) {
      setError('Failed to delete certificate');
      console.error(err);
    }
  };

  const handleReplace = (type: CertificateType) => {
    setSelectedType(type);
    fileInputRef.current?.click();
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
          Upload PDF certificates for IS 2911 compliance
        </p>
      </div>

      {/* Error message */}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Certificate type cards */}
      <div className="space-y-3">
        {ALL_CERTIFICATE_TYPES.map((type) => {
          const cert = getCertificateForType(type);
          const isSelected = selectedType === type;

          return (
            <div
              key={type}
              className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-all ${
                cert ? 'border-green-200' : 'border-slate-200'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  {/* Icon and label */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        cert ? 'bg-green-100' : 'bg-slate-100'
                      }`}
                    >
                      <FileText
                        className={`w-5 h-5 ${cert ? 'text-green-600' : 'text-slate-400'}`}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-800">
                        {CERTIFICATE_TYPE_LABELS[type]}
                      </h3>
                      {cert ? (
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">
                          {cert.fileName}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">Not uploaded</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {cert ? (
                      <>
                        {/* View button */}
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View certificate"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>

                        {/* Replace button */}
                        <button
                          onClick={() => handleReplace(type)}
                          disabled={isUploading && isSelected}
                          className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Replace
                        </button>

                        {/* Delete button */}
                        {deleteConfirmId === cert.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(cert.id)}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            >
                              Confirm
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
                            onClick={() => setDeleteConfirmId(cert.id)}
                            className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                            title="Delete certificate"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => handleTypeSelect(type)}
                        disabled={isUploading}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isUploading && isSelected ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>Upload</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Status indicator */}
                {cert && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-green-600">
                    <Check className="w-3 h-3" />
                    <span>Uploaded • Will be included in report</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-slate-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">
              {certificates.length} of {ALL_CERTIFICATE_TYPES.length} certificates uploaded
            </p>
            <p className="text-xs text-slate-500">
              Certificates will be appended to the PDF report
            </p>
          </div>
          {certificates.length === ALL_CERTIFICATE_TYPES.length && (
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <Check className="w-4 h-4" />
              <span>Complete</span>
            </div>
          )}
        </div>
      </div>

      {/* Info text */}
      <p className="text-xs text-slate-400 text-center">
        PDF certificates are appended at the end of the generated report
      </p>
    </div>
  );
}

