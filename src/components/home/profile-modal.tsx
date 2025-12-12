'use client';

import { useState } from 'react';
import { X, User, PenTool } from 'lucide-react';
import type { UserProfile } from '@/types';

/**
 * Props for the ProfileModal component.
 * Why: Defines current profile data and callbacks.
 */
interface ProfileModalProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  onClose: () => void;
}

/**
 * Modal for editing user profile and signature.
 * Why: Allows engineers to set their identity for signing readings.
 */
export function ProfileModal({ profile, onSave, onClose }: ProfileModalProps) {
  const [name, setName] = useState(profile.name);
  const [initials, setInitials] = useState(profile.initials);
  const [signature, setSignature] = useState(profile.signature);

  const handleSave = () => {
    onSave({ name, initials, signature });
    onClose();
  };

  const inputClass =
    'w-full h-12 px-4 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900';
  const labelClass = 'block text-sm text-slate-600 mb-2';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
          {/* Header */}
          <div className="bg-slate-800 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Your Profile</h2>
                <p className="text-slate-400 text-sm">Set your signature details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div>
              <label className={labelClass}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., John Smith"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Initials (for quick signature)</label>
              <input
                type="text"
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 3))}
                placeholder="e.g., JS"
                maxLength={3}
                className={inputClass}
              />
              <p className="text-xs text-slate-500 mt-1">
                Displayed on your profile button
              </p>
            </div>

            <div>
              <label className={labelClass}>Signature Text</label>
              <div className="relative">
                <PenTool className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Your signature text"
                  className="w-full h-12 pl-12 pr-4 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Used when signing off readings
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              Save Profile
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
