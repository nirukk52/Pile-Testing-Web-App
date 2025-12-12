import { useState, useRef } from 'react';
import { X, User } from 'lucide-react';

export interface UserProfile {
  name: string;
  initials: string;
  signature: string;
}

interface ProfileModalProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  onClose: () => void;
}

export function ProfileModal({ profile, onSave, onClose }: ProfileModalProps) {
  const [name, setName] = useState(profile.name);
  const [initials, setInitials] = useState(profile.initials);
  const [signature, setSignature] = useState(profile.signature);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleSave = () => {
    onSave({ name, initials, signature });
    onClose();
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature('');
  };

  const loadSignature = () => {
    if (!signature || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = signature;
  };

  // Load signature when component mounts or signature changes
  useState(() => {
    if (signature) {
      setTimeout(loadSignature, 100);
    }
  });

  // Auto-generate initials from name
  const handleNameChange = (newName: string) => {
    setName(newName);
    const parts = newName.trim().split(' ');
    const autoInitials = parts
      .map(part => part[0]?.toUpperCase() || '')
      .filter(Boolean)
      .slice(0, 2)
      .join('');
    if (autoInitials) {
      setInitials(autoInitials);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-slate-800">Profile Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Profile Icon Preview */}
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl">
              {initials || <User className="w-12 h-12" />}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-slate-500 uppercase mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter your name"
              className="w-full h-12 px-4 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-slate-900"
            />
          </div>

          {/* Initials */}
          <div>
            <label className="block text-xs text-slate-500 uppercase mb-1">
              Initials
            </label>
            <input
              type="text"
              value={initials}
              onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="AB"
              maxLength={2}
              className="w-full h-12 px-4 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all uppercase text-center text-slate-900"
            />
            <p className="text-xs text-slate-500 mt-1">
              Auto-generated from your name (editable)
            </p>
          </div>

          {/* Signature */}
          <div>
            <label className="block text-xs text-slate-500 uppercase mb-1">
              Signature
            </label>
            <div className="border-2 border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <canvas
                ref={canvasRef}
                width={400}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-[200px] cursor-crosshair bg-white touch-none"
              />
            </div>
            <button
              onClick={clearSignature}
              className="mt-2 text-sm text-rose-600 hover:text-rose-700"
            >
              Clear Signature
            </button>
            <p className="text-xs text-slate-500 mt-1">
              Draw your signature above (this will be used for confirmations)
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
          >
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}