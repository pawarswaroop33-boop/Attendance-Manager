import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Copy, 
  Check, 
  Share2, 
  MessageSquare, 
  Sliders, 
  Phone, 
  Smartphone,
  ExternalLink
} from 'lucide-react';
import { AttendanceSession, ClassGroup, Student, WhatsAppMessageConfig } from '../types';
import { generateWhatsAppMessage, shareToWhatsApp, copyToClipboard } from '../utils/whatsapp';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AttendanceSession;
  currentClass: ClassGroup;
  students: Student[];
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  session,
  currentClass,
  students
}) => {
  const [copied, setCopied] = useState(false);
  const [config, setConfig] = useState<WhatsAppMessageConfig>({
    includeAbsentList: true,
    includeLateList: true,
    includeStats: true,
    includeRemarks: true,
    customNote: session.remarks || '',
    targetPhone: ''
  });

  if (!isOpen) return null;

  const generatedText = generateWhatsAppMessage(session, currentClass, students, config);

  const handleCopy = async () => {
    const success = await copyToClipboard(generatedText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSendWhatsApp = () => {
    shareToWhatsApp(generatedText, config.targetPhone);
  };

  const handleDeviceShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Attendance Report - ${currentClass.name}`,
          text: generatedText
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base leading-tight truncate">Share Attendance on WhatsApp</h3>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">Broadcast summary to parents and staff</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Settings & Preview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-y-auto">
          
          {/* Options Column (left) */}
          <div className="p-4 sm:p-5 md:col-span-5 border-b md:border-b-0 md:border-r border-slate-200 space-y-4 bg-slate-50">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Sliders className="w-3.5 h-3.5 text-slate-600" />
              <span>Report Options</span>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.includeStats}
                  onChange={(e) => setConfig(prev => ({ ...prev, includeStats: e.target.checked }))}
                  className="w-4 h-4 rounded-md text-slate-900 focus:ring-slate-900 accent-slate-900 cursor-pointer"
                />
                <span>Include Attendance Counts & %</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.includeAbsentList}
                  onChange={(e) => setConfig(prev => ({ ...prev, includeAbsentList: e.target.checked }))}
                  className="w-4 h-4 rounded-md text-slate-900 focus:ring-slate-900 accent-slate-900 cursor-pointer"
                />
                <span>List Absent Roll Numbers (Row, Comma-Separated)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.includeLateList}
                  onChange={(e) => setConfig(prev => ({ ...prev, includeLateList: e.target.checked }))}
                  className="w-4 h-4 rounded-md text-slate-900 focus:ring-slate-900 accent-slate-900 cursor-pointer"
                />
                <span>List Late Roll Numbers (Row, Comma-Separated)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.includeRemarks}
                  onChange={(e) => setConfig(prev => ({ ...prev, includeRemarks: e.target.checked }))}
                  className="w-4 h-4 rounded-md text-slate-900 focus:ring-slate-900 accent-slate-900 cursor-pointer"
                />
                <span>Include Teacher&apos;s Remarks</span>
              </label>
            </div>

            {/* Custom Announcement Input */}
            {config.includeRemarks && (
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold text-slate-700">
                  Custom Notice / Homework:
                </label>
                <textarea
                  value={config.customNote}
                  onChange={(e) => setConfig(prev => ({ ...prev, customNote: e.target.value }))}
                  rows={2}
                  placeholder="e.g. Please remind students about tomorrow's unit test."
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>
            )}

            {/* Specific Recipient (Optional) */}
            <div className="space-y-1.5 pt-2">
              <label className="flex items-center gap-1 text-xs font-bold text-slate-700">
                <Phone className="w-3 h-3 text-slate-500" />
                <span>Target Phone Number (Optional)</span>
              </label>
              <input
                type="text"
                value={config.targetPhone}
                onChange={(e) => setConfig(prev => ({ ...prev, targetPhone: e.target.value }))}
                placeholder="e.g. +91 9876543210"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
              <p className="text-[11px] text-slate-500">Leave blank to open WhatsApp chat recipient picker</p>
            </div>
          </div>

          {/* WhatsApp Message Preview Column (right) */}
          <div className="p-4 sm:p-5 md:col-span-7 bg-[#EFEAE2] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-700" />
                  <span>Message Preview</span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">WhatsApp format</span>
              </div>

              {/* Chat Bubble container */}
              <div className="bg-[#DCF8C6] border border-[#C5E9B0] rounded-2xl p-3.5 shadow-xs max-h-52 sm:max-h-72 overflow-y-auto text-xs font-sans text-slate-800 whitespace-pre-wrap selection:bg-emerald-200">
                {generatedText}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-300/60 flex items-center justify-between text-[11px] text-slate-600">
              <span>Ready to broadcast</span>
              <span className="font-bold text-slate-900 truncate ml-2">{currentClass.name}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-600" />
                <span>Copy Message Text</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {'share' in navigator && (
              <button
                type="button"
                onClick={handleDeviceShare}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share...</span>
              </button>
            )}

            <button
              id="confirm-send-whatsapp"
              type="button"
              onClick={handleSendWhatsApp}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#25D366] hover:bg-[#1faa4f] active:scale-95 shadow-xs transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Open in WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
