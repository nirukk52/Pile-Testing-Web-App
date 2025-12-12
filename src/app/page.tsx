'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HomeScreen, ProfileModal } from '@/components/home';
import { useTestStore } from '@/store/test-store';

/**
 * Home page - entry point for the app.
 * Why: Shows list of tests and allows creating new ones.
 */
export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Store state
  const view = useTestStore((s) => s.view);
  const allTests = useTestStore((s) => s.allTests);
  const userProfile = useTestStore((s) => s.userProfile);
  const showProfileModal = useTestStore((s) => s.showProfileModal);
  const getTestSummaries = useTestStore((s) => s.getTestSummaries);

  // Store actions
  const createNewTest = useTestStore((s) => s.createNewTest);
  const openTest = useTestStore((s) => s.openTest);
  const deleteTest = useTestStore((s) => s.deleteTest);
  const setUserProfile = useTestStore((s) => s.setUserProfile);
  const setShowProfileModal = useTestStore((s) => s.setShowProfileModal);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

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
