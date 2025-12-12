import { Plus, FileText, Trash2, Calendar, MapPin } from 'lucide-react';
import { UserProfile } from './ProfileModal';
import { TestTypeModal } from './TestTypeModal';
import { useState } from 'react';

export interface PileTest {
  id: string;
  reportNo: string;
  project: string;
  location: string;
  dateOfCasting: string;
  createdAt: string;
  readingsCount: number;
}

interface HomeScreenProps {
  tests: PileTest[];
  onNewTest: (testType: string) => void;
  onOpenTest: (testId: string) => void;
  onDeleteTest: (testId: string) => void;
  userProfile: UserProfile;
  onOpenProfile: () => void;
}

export function HomeScreen({
  tests,
  onNewTest,
  onOpenTest,
  onDeleteTest,
  userProfile,
  onOpenProfile,
}: HomeScreenProps) {
  const [showTestTypeModal, setShowTestTypeModal] = useState(false);

  const handleDelete = (e: React.MouseEvent, testId: string) => {
    e.stopPropagation();
    if (confirm('Delete this pile test?')) {
      onDeleteTest(testId);
    }
  };

  const handleTestTypeSelect = (testType: string) => {
    setShowTestTypeModal(false);
    onNewTest(testType);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - Midnight Slate */}
      <header className="bg-slate-800 text-white px-4 py-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1" />
          <div className="flex-1 flex items-center justify-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white text-xl">⚡</span>
            </div>
            <h1 className="text-center bg-gradient-to-r from-blue-400 via-blue-300 to-blue-400 bg-clip-text text-transparent" style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
              PileTestPro
            </h1>
          </div>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onOpenProfile}
              className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              {userProfile.initials || '?'}
            </button>
          </div>
        </div>
        <p className="text-center text-slate-400 text-sm">
          Proprietary of Zed Core N Bore
        </p>
      </header>

      {/* Content */}
      <main className="p-4 space-y-4 pb-24">
        {/* New Test Button */}
        <button
          onClick={() => setShowTestTypeModal(true)}
          className="w-full py-6 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg"
        >
          <Plus className="w-6 h-6" />
          <span className="text-lg">Start New Pile Test</span>
        </button>

        {/* Tests List */}
        {tests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-gray-900 px-2">Recent Tests</h2>
            {tests.map((test) => {
              const createdDate = new Date(test.createdAt);
              const dateStr = createdDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              const timeStr = createdDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={test.id}
                  onClick={() => onOpenTest(test.id)}
                  className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-gray-900">
                          {test.reportNo || 'No Report Number'}
                        </span>
                      </div>
                      <h3 className="text-gray-900 mb-1">
                        {test.project || 'Untitled Project'}
                      </h3>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, test.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    {test.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        <span>{test.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {dateStr} at {timeStr}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {test.readingsCount} reading{test.readingsCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-blue-600">View →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {tests.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center mt-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-gray-900 mb-2">No Tests Yet</h3>
            <p className="text-gray-500 text-sm">
              Click "Start New Pile Test" to begin
            </p>
          </div>
        )}
      </main>

      {/* Test Type Modal */}
      {showTestTypeModal && (
        <TestTypeModal
          onClose={() => setShowTestTypeModal(false)}
          onSelect={handleTestTypeSelect}
        />
      )}
    </div>
  );
}