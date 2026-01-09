'use client';

import { ArrowRight, FileText, CheckCircle2, Zap, Upload, Smartphone, BarChart3, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="fixed w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              P
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">PileTest<span className="text-blue-600">Pro</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">How it Works</a>
            <a href="#compliance" className="hover:text-blue-600 transition-colors">Compliance</a>
          </div>
          <button
            onClick={onGetStarted}
            className="bg-slate-900 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-slate-800 transition-all hover:shadow-lg active:scale-95"
          >
            Launch App
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-sm font-semibold mb-8 animate-fade-in-up">
            <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
            New: Intelligent PDF & Excel Ingestion
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight mb-8 leading-tight">
            Pile Testing Reports. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Automated & Verified.
            </span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Transform field data into IS 2911 compliant reports in seconds. 
            Upload handwritten notes or Excel files, and let our AI agents handle the rest.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-200/50 transition-all flex items-center justify-center gap-2 group"
            >
              Start New Test
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              View Sample Report
            </button>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="mt-20 relative rounded-2xl border border-slate-200 shadow-2xl overflow-hidden bg-slate-900/5 aspect-video md:aspect-[21/9] group">
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onGetStarted} className="px-6 py-3 bg-white shadow-lg rounded-full font-bold text-slate-900 transform translate-y-4 group-hover:translate-y-0 transition-all">
              Try Interactive Demo
            </button>
          </div>
          {/* Abstract representation of the UI */}
          <div className="absolute inset-4 bg-white rounded-xl shadow-inner overflow-hidden flex">
            <div className="w-64 bg-slate-50 border-r border-slate-100 hidden md:block p-4 space-y-4">
              <div className="h-8 w-32 bg-slate-200 rounded animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-10 w-full bg-blue-50 border border-blue-100 rounded-lg"></div>
                <div className="h-10 w-full bg-white border border-slate-100 rounded-lg"></div>
                <div className="h-10 w-full bg-white border border-slate-100 rounded-lg"></div>
              </div>
            </div>
            <div className="flex-1 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
                <div className="h-8 w-24 bg-emerald-100 rounded-full"></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-32 bg-slate-50 rounded-xl border border-slate-100"></div>
                <div className="h-32 bg-slate-50 rounded-xl border border-slate-100"></div>
                <div className="h-32 bg-slate-50 rounded-xl border border-slate-100"></div>
              </div>
              <div className="h-64 bg-slate-50 rounded-xl border border-slate-100 relative overflow-hidden">
                 <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-blue-50/50 to-transparent"></div>
                 {/* Chart line abstract */}
                 <svg className="absolute inset-0 w-full h-full text-blue-500" viewBox="0 0 100 50" preserveAspectRatio="none">
                    <path d="M0 50 Q 25 40 50 20 T 100 5" fill="none" stroke="currentColor" strokeWidth="0.5" />
                 </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            <FeatureCard 
              icon={<Upload className="w-6 h-6 text-white" />}
              title="Universal Ingestion"
              description="Drop PDF scans, Excel sheets, or Word docs. Our AI extracts data instantly, saving you hours of manual entry."
              color="bg-blue-600"
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-6 h-6 text-white" />}
              title="AI Verification Agent"
              description="Every report is auto-verified against raw data and IS 2911 standards. Catch errors before they leave your desk."
              color="bg-emerald-500"
            />
            <FeatureCard 
              icon={<BarChart3 className="w-6 h-6 text-white" />}
              title="Instant Analytics"
              description="Real-time Load vs. Settlement curves. Visualise pile behavior and get immediate Pass/Fail insights on-site."
              color="bg-indigo-600"
            />
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="how-it-works" className="py-24 bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">A Workflow That Adapts To You</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Whether you're on-site with a mobile phone or in the office with legacy files, PileTest Pro fits your process.
            </p>
          </div>

          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 hidden md:block"></div>

            <div className="grid md:grid-cols-4 gap-8 relative z-10">
              <Step number="1" title="Upload" desc="PDF, Excel, or Manual Entry" />
              <Step number="2" title="Extract" desc="AI parses unstructured data" />
              <Step number="3" title="Verify" desc="Automated QC checks" />
              <Step number="4" title="Report" desc="One-click PDF Export" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <h2 className="text-4xl font-bold mb-8">Ready to modernize your geotechnical workflow?</h2>
          <p className="text-xl text-slate-300 mb-10">
            Join forward-thinking engineering firms using PileTest Pro to deliver faster, more accurate reports.
          </p>
          <button
            onClick={onGetStarted}
            className="px-10 py-4 bg-white text-slate-900 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-xl"
          >
            Get Started for Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-slate-500 text-sm">
          <p>© 2024 ZedGeo Engineering Solutions. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-900">Privacy Policy</a>
            <a href="#" className="hover:text-slate-900">Terms of Service</a>
            <a href="#" className="hover:text-slate-900">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, color }: { icon: React.ReactNode, title: string, description: string, color: string }) {
  return (
    <div className="group p-8 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300">
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function Step({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center relative group hover:-translate-y-1 transition-transform duration-300">
      <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4 z-20 relative ring-4 ring-white group-hover:bg-blue-600 transition-colors">
        {number}
      </div>
      <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500">{desc}</p>
    </div>
  );
}



