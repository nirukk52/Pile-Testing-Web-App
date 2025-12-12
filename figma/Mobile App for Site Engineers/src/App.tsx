import { useState, useEffect } from 'react';
import { ProjectDetails } from './components/ProjectDetails';
import { DataEntry } from './components/DataEntry';
import { ReportView } from './components/ReportView';
import { HomeScreen, PileTest } from './components/HomeScreen';
import { ProfileModal, UserProfile } from './components/ProfileModal';
import { Menu, Save, FileText, ClipboardList, Eye, Home, ArrowLeft, User } from 'lucide-react';

export interface ProjectInfo {
  reportNo: string;
  project: string;
  location: string;
  contractor: string;
  client: string;
  lcOfDialGauge: string;
  designLoadOnPile: string;
  mixedDesign: string;
  pileDiameter: string;
  ramArea: string;
  dateOfCasting: string;
  pileDepth: string;
  testType?: string;
}

export interface Reading {
  id: string;
  pressureGauge: string; // Each reading has its own pressure
  load: string; // Calculated from pressure
  dialGauge1: string;
  dialGauge2: string;
  dialGauge3: string;
  dialGauge4: string;
  timestamp: string;
  signature?: string;
  remark?: string;
  phase: 'loading' | 'holding' | 'unloading';
}

export interface LoadEntry {
  id: string;
  pressureGauge: string; // What engineer enters
  load: string; // Calculated from pressure
  readings: Reading[];
  timestamp: string;
}

interface SavedTest {
  id: string;
  projectInfo: ProjectInfo;
  loadEntries: LoadEntry[];
  createdAt: string;
  updatedAt: string;
}

export default function App() {
  const [view, setView] = useState<'home' | 'test'>('home');
  const [currentTestId, setCurrentTestId] = useState<string | null>(null);
  const [allTests, setAllTests] = useState<SavedTest[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '',
    initials: '',
    signature: '',
  });
  
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    reportNo: '',
    project: '',
    location: '',
    contractor: '',
    client: '',
    lcOfDialGauge: '0.01',
    designLoadOnPile: '',
    mixedDesign: '',
    pileDiameter: '',
    ramArea: '',
    dateOfCasting: '',
    pileDepth: '',
  });

  const [loadEntries, setLoadEntries] = useState<LoadEntry[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [currentStep, setCurrentStep] = useState<'details' | 'entry' | 'report'>('details');

  // Load all tests from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('allPileTests');
    if (saved) {
      try {
        const tests = JSON.parse(saved);
        setAllTests(tests);
      } catch (e) {
        console.error('Error loading tests:', e);
      }
    }
    
    // Load user profile
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
        setUserProfile(profile);
      } catch (e) {
        console.error('Error loading profile:', e);
      }
    }
  }, []);

  // Auto-save current test when data changes
  useEffect(() => {
    if (view === 'test' && currentTestId) {
      saveCurrentTest();
    }
  }, [projectInfo, loadEntries]);

  const saveCurrentTest = () => {
    if (!currentTestId) return;

    const updatedTest: SavedTest = {
      id: currentTestId,
      projectInfo,
      loadEntries,
      createdAt: allTests.find(t => t.id === currentTestId)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedTests = allTests.some(t => t.id === currentTestId)
      ? allTests.map(t => t.id === currentTestId ? updatedTest : t)
      : [...allTests, updatedTest];

    setAllTests(updatedTests);
    localStorage.setItem('allPileTests', JSON.stringify(updatedTests));
  };

  const handleNewTest = (testType: string) => {
    const newId = Date.now().toString();
    setCurrentTestId(newId);
    setProjectInfo({
      reportNo: '',
      project: '',
      location: '',
      contractor: '',
      client: '',
      lcOfDialGauge: '0.01',
      designLoadOnPile: '',
      mixedDesign: '',
      pileDiameter: '',
      ramArea: '',
      dateOfCasting: '',
      pileDepth: '',
      testType: testType,
    });
    setLoadEntries([]);
    setCurrentStep('details');
    setView('test');
  };

  const handleOpenTest = (testId: string) => {
    const test = allTests.find(t => t.id === testId);
    if (test) {
      setCurrentTestId(testId);
      setProjectInfo(test.projectInfo);
      setLoadEntries(test.loadEntries);
      setCurrentStep('details');
      setView('test');
    }
  };

  const handleDeleteTest = (testId: string) => {
    const updatedTests = allTests.filter(t => t.id !== testId);
    setAllTests(updatedTests);
    localStorage.setItem('allPileTests', JSON.stringify(updatedTests));
  };

  const handleBackToHome = () => {
    if (confirm('Return to home? Any unsaved changes will be saved automatically.')) {
      saveCurrentTest();
      setView('home');
      setCurrentTestId(null);
    }
  };

  const handleSaveProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    localStorage.setItem('userProfile', JSON.stringify(profile));
  };

  // Convert tests to PileTest format for HomeScreen
  const pileTests: PileTest[] = allTests.map(test => {
    const totalReadings = test.loadEntries.reduce(
      (sum, entry) => sum + entry.readings.length,
      0
    );
    return {
      id: test.id,
      reportNo: test.projectInfo.reportNo,
      project: test.projectInfo.project,
      location: test.projectInfo.location,
      dateOfCasting: test.projectInfo.dateOfCasting,
      createdAt: test.createdAt,
      readingsCount: totalReadings,
    };
  });

  if (view === 'home') {
    return (
      <>
        <HomeScreen
          tests={pileTests}
          onNewTest={handleNewTest}
          onOpenTest={handleOpenTest}
          onDeleteTest={handleDeleteTest}
          userProfile={userProfile}
          onOpenProfile={() => setShowProfileModal(true)}
        />
        {showProfileModal && (
          <ProfileModal
            profile={userProfile}
            onSave={handleSaveProfile}
            onClose={() => setShowProfileModal(false)}
          />
        )}
      </>
    );
  }

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
          <h1 className="flex-1 text-center">
            {projectInfo.project || 'Pile Load Test'}
          </h1>
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            {userProfile.initials || <User className="w-5 h-5" />}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-t border-slate-700">
          <button
            onClick={() => setCurrentStep('details')}
            className={`flex-1 py-3 px-2 transition-colors ${
              currentStep === 'details'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <FileText className="w-5 h-5 mx-auto mb-1" />
            <span className="text-xs">Details</span>
          </button>
          <button
            onClick={() => setCurrentStep('entry')}
            className={`flex-1 py-3 px-2 transition-colors ${
              currentStep === 'entry'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <ClipboardList className="w-5 h-5 mx-auto mb-1" />
            <span className="text-xs">Data Entry</span>
          </button>
          <button
            onClick={() => setCurrentStep('report')}
            className={`flex-1 py-3 px-2 transition-colors ${
              currentStep === 'report'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Eye className="w-5 h-5 mx-auto mb-1" />
            <span className="text-xs">Report</span>
          </button>
        </div>
      </header>

      {/* Menu Dropdown */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute top-16 right-4 bg-white rounded-lg shadow-xl z-50 min-w-[200px] overflow-hidden border border-slate-200">
            <button
              onClick={() => {
                handleBackToHome();
                setShowMenu(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-slate-700"
            >
              <Home className="w-5 h-5 text-slate-600" />
              <span>Back to Home</span>
            </button>
            <button
              onClick={() => {
                saveCurrentTest();
                alert('Test saved successfully!');
                setShowMenu(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 border-t border-slate-200 text-slate-700"
            >
              <Save className="w-5 h-5 text-slate-600" />
              <span>Save Test</span>
            </button>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="pb-20">
        {currentStep === 'details' && (
          <ProjectDetails
            projectInfo={projectInfo}
            setProjectInfo={setProjectInfo}
            onNext={() => setCurrentStep('entry')}
          />
        )}
        {currentStep === 'entry' && (
          <DataEntry
            loadEntries={loadEntries}
            setLoadEntries={setLoadEntries}
            projectInfo={projectInfo}
          />
        )}
        {currentStep === 'report' && (
          <ReportView
            projectInfo={projectInfo}
            loadEntries={loadEntries}
          />
        )}
      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          profile={userProfile}
          onSave={handleSaveProfile}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}