'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, FileText, ClipboardList, Eye, User, Image, FileCheck, Upload, Share2, Check, Copy } from 'lucide-react';
import { FieldUpload, ProjectDetails, DataEntry, ReportView, SiteImages, Certificates } from '@/components/test';
import { ProfileModal } from '@/components/home';
import { useTestStore } from '@/store/test-store';
import type { WorkflowStep, LoadEntry } from '@/types';

/**
 * Dynamic test page with slug-based URLs for sharing.
 * Why: Enables shareable links like /test/prestige-nautilus-worli-ivplt-03
 */
export default function TestSlugPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Store state
  const view = useTestStore((s) => s.view);
  const currentStep = useTestStore((s) => s.currentStep);
  const projectInfo = useTestStore((s) => s.projectInfo);
  const loadEntries = useTestStore((s) => s.loadEntries);
  const userProfile = useTestStore((s) => s.userProfile);
  const showProfileModal = useTestStore((s) => s.showProfileModal);
  const supabaseTestId = useTestStore((s) => s.supabaseTestId);

  // Store actions
  const setCurrentStep = useTestStore((s) => s.setCurrentStep);
  const updateProjectField = useTestStore((s) => s.updateProjectField);
  const addLoadEntry = useTestStore((s) => s.addLoadEntry);
  const updateLoadEntry = useTestStore((s) => s.updateLoadEntry);
  const deleteLoadEntry = useTestStore((s) => s.deleteLoadEntry);
  const backToHome = useTestStore((s) => s.backToHome);
  const setUserProfile = useTestStore((s) => s.setUserProfile);
  const setShowProfileModal = useTestStore((s) => s.setShowProfileModal);
  const openTest = useTestStore((s) => s.openTest);
  const setView = useTestStore((s) => s.setView);

  // Handle hydration and load test from slug
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load test data when slug changes
  useEffect(() => {
    if (!mounted || !slug) return;

    const loadTestFromSlug = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch test by slug from API
        const response = await fetch(`/api/tests/by-slug/${slug}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Test not found. The link may be invalid or the test may have been deleted.');
          } else {
            setError('Failed to load test. Please try again.');
          }
          setLoading(false);
          return;
        }

        const test = await response.json();
        
        // Open the test using its ID (this sets all store state)
        await openTest(test.id);
        setView('test');
        setLoading(false);
      } catch (err) {
        console.error('Failed to load test from slug:', err);
        setError('Failed to load test. Please check your connection.');
        setLoading(false);
      }
    };

    loadTestFromSlug();
  }, [mounted, slug, openTest, setView]);

  const handleBackToHome = () => {
    if (confirm('Return to home? Your changes are saved automatically.')) {
      backToHome();
      router.push('/');
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      prompt('Copy this link to share:', shareUrl);
    }
  };

  // Show loading state
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading test...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Unable to Load Test</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  const tabs: Array<{ key: WorkflowStep; label: string; icon: typeof FileText }> = [
    { key: 'upload', label: 'Upload', icon: Upload },
    { key: 'details', label: 'Details', icon: FileText },
    { key: 'entry', label: 'Data', icon: ClipboardList },
    { key: 'images', label: 'Images', icon: Image },
    { key: 'certificates', label: 'Certs', icon: FileCheck },
    { key: 'report', label: 'Report', icon: Eye },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Midnight Slate */}
      <header className="bg-slate-800 text-white sticky top-0 z-50 shadow-lg">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={handleBackToHome}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-center font-semibold truncate px-2">
            {projectInfo.project || 'Pile Load Test'}
          </h1>
          <div className="flex items-center gap-2">
            {/* Share Button */}
            <button
              onClick={handleShare}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors relative"
              title="Copy shareable link"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-400" />
              ) : (
                <Share2 className="w-5 h-5" />
              )}
            </button>
            {/* Profile Button */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center text-sm font-medium"
            >
              {userProfile.initials || <User className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-slate-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setCurrentStep(tab.key)}
                className={`flex-1 py-3 px-2 transition-colors flex flex-col items-center ${
                  currentStep === tab.key
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20">
        {currentStep === 'upload' && (
          <FieldUpload
            projectInfo={projectInfo}
            onUpdateField={updateProjectField}
            onNext={() => setCurrentStep('details')}
          />
        )}
        {currentStep === 'details' && (
          <ProjectDetails
            projectInfo={projectInfo}
            onUpdateField={updateProjectField}
            onNext={() => setCurrentStep('entry')}
          />
        )}
        {currentStep === 'entry' && (
          <DataEntry
            loadEntries={loadEntries}
            onAddEntry={addLoadEntry}
            onUpdateEntry={updateLoadEntry}
            onDeleteEntry={deleteLoadEntry}
            projectInfo={projectInfo}
          />
        )}
        {currentStep === 'images' && supabaseTestId && (
          <SiteImages testId={supabaseTestId} />
        )}
        {currentStep === 'images' && !supabaseTestId && (
          <div className="p-6 text-center">
            <p className="text-slate-600 mb-4">
              Please save project details first to upload images.
            </p>
            <button
              onClick={() => setCurrentStep('details')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Details
            </button>
          </div>
        )}
        {currentStep === 'certificates' && supabaseTestId && (
          <Certificates testId={supabaseTestId} />
        )}
        {currentStep === 'certificates' && !supabaseTestId && (
          <div className="p-6 text-center">
            <p className="text-slate-600 mb-4">
              Please save project details first to upload certificates.
            </p>
            <button
              onClick={() => setCurrentStep('details')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Details
            </button>
          </div>
        )}
        {currentStep === 'report' && (
          <ReportView 
            projectInfo={projectInfo} 
            loadEntries={loadEntries} 
            testId={supabaseTestId || undefined}
          />
        )}
      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          profile={userProfile}
          onSave={setUserProfile}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}
