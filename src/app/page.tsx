'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HomeScreen, ProfileModal } from '@/components/home';
import { useTestStore, useApiSync } from '@/store/test-store';

/**
 * Home page - entry point for the app.
 * Why: Shows list of tests and allows creating new ones.
 */
export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Store state
  const view = useTestStore((s) => s.view);
  const userProfile = useTestStore((s) => s.userProfile);
  const showProfileModal = useTestStore((s) => s.showProfileModal);
  const getTestSummaries = useTestStore((s) => s.getTestSummaries);

  // Store actions
  const createNewTest = useTestStore((s) => s.createNewTest);
  const openTest = useTestStore((s) => s.openTest);
  const deleteTest = useTestStore((s) => s.deleteTest);
  const setUserProfile = useTestStore((s) => s.setUserProfile);
  const setShowProfileModal = useTestStore((s) => s.setShowProfileModal);

  // API sync
  const { loadTestsFromApi, isLoading, error, setError } = useApiSync();

  // Handle hydration and load tests from API
  useEffect(() => {
    setMounted(true);
    // Load tests from Supabase on mount
    loadTestsFromApi();
  }, [loadTestsFromApi]);

  // Redirect to test page when a test is opened
  useEffect(() => {
    if (view === 'test') {
      router.push('/test');
    }
  }, [view, router]);

  // Don't render until hydrated to avoid mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const testSummaries = getTestSummaries();

  return (
    <>
      {/* Error Banner */}
      {error && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-2 text-center z-50">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl p-6 flex items-center gap-3 shadow-xl">
            <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-slate-700">Syncing with cloud...</span>
          </div>
        </div>
      )}

      <HomeScreen
        tests={testSummaries}
        onNewTest={createNewTest}
        onOpenTest={openTest}
        onDeleteTest={deleteTest}
        userProfile={userProfile}
        onOpenProfile={() => setShowProfileModal(true)}
      />
      {showProfileModal && (
        <ProfileModal
          profile={userProfile}
          onSave={setUserProfile}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </>
  );
}
