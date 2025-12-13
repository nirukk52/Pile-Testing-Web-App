'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, ClipboardList, Eye, User } from 'lucide-react';
import { ProjectDetails, DataEntry, ReportView } from '@/components/test';
import { ProfileModal } from '@/components/home';
import { useTestStore } from '@/store/test-store';
import type { WorkflowStep, LoadEntry } from '@/types';

/**
 * Test page with tab navigation.
 * Why: Main workspace for entering test data with Details/Entry/Report tabs.
 */
export default function TestPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

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

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to home if not in test view
  useEffect(() => {
    if (mounted && view !== 'test') {
      router.push('/');
    }
  }, [mounted, view, router]);

  const handleBackToHome = () => {
    if (confirm('Return to home? Your changes are saved automatically.')) {
      backToHome();
      router.push('/');
    }
  };

  // Don't render until hydrated
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If not in test view, show loading while redirecting
  if (view !== 'test') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: Array<{ key: WorkflowStep; label: string; icon: typeof FileText }> = [
    { key: 'details', label: 'Details', icon: FileText },
    { key: 'entry', label: 'Data Entry', icon: ClipboardList },
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
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center text-sm font-medium"
          >
            {userProfile.initials || <User className="w-5 h-5" />}
          </button>
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
