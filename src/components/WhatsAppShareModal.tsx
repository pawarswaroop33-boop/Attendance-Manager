import React, { useState, useEffect, useMemo } from 'react';
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
  ExternalLink,
  BookOpen,
  Clock,
  User,
  Sparkles
} from 'lucide-react';
import { AttendanceSession, ClassGroup, Student, WhatsAppMessageConfig, TimetableSlot, Teacher } from '../types';
import { generateWhatsAppMessage, shareToWhatsApp, copyToClipboard } from '../utils/whatsapp';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AttendanceSession;
  currentClass: ClassGroup;
  students: Student[];
  timetable?: TimetableSlot[];
  teachers?: Teacher[];
  activeSlot?: TimetableSlot;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  session,
  currentClass,
  students,
  timetable = [],
  teachers = [],
  activeSlot
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

  // Resolve matching slot from timetable if not provided directly
  const matchedSlot = useMemo(() => {
    if (activeSlot) return activeSlot;
    if (session.lectureSlotId && timetable.length > 0) {
      return timetable.find(s => s.id === session.lectureSlotId) || null;
    }
    return null;
  }, [activeSlot, session.lectureSlotId, timetable]);

  // Resolve faculty / teacher
  const matchedTeacher = useMemo(() => {
    if (!teachers || teachers.length === 0) return null;
    return teachers.find(t => 
      (session.teacherId && t.id === session.teacherId) ||
      (matchedSlot?.teacherId && t.id === matchedSlot.teacherId) ||
      (session.teacherName && t.name.toLowerCase() === session.teacherName.toLowerCase()) ||
      (matchedSlot?.teacherName && t.name.toLowerCase() === matchedSlot.teacherName.toLowerCase())
    ) || null;
  }, [teachers, session, matchedSlot]);

  // List of candidate respected subjects for this faculty member
  const facultySubjects = useMemo(() => {
    const list: string[] = [];
    if (matchedSlot?.subject && !list.includes(matchedSlot.subject)) {
      list.push(matchedSlot.subject);
    }
    if (session.subject && !list.includes(session.subject)) {
      list.push(session.subject);
    }
    if (matchedTeacher?.subjects && Array.isArray(matchedTeacher.subjects)) {
      matchedTeacher.subjects.forEach(s => {
        if (s && !list.includes(s)) list.push(s);
      });
    }
    return list;
  }, [matchedSlot, session, matchedTeacher]);

  // Primary default subject: prioritized to timetable slot -> session subject -> teacher respected subjects -> classGroup
  const defaultSubject = useMemo(() => {
    return matchedSlot?.subject || 
      session.subject || 
      (matchedTeacher?.subjects?.[0]) || 
      (session.sessionName && session.sessionName.includes(' - ') ? session.sessionName.split(' - ').slice(1).join(' - ') : '') ||
      currentClass.subject ||
      'Applied AI';
  }, [matchedSlot, session, matchedTeacher, currentClass]);

  // Default lecture timing/slot (clean, without embedded subject)
  const defaultTimeSlot = useMemo(() => {
    return matchedSlot?.timeSlotLabel ||
      session.timeSlot ||
      (session.sessionName && session.sessionName.includes(' - ') ? session.sessionName.split(' - ')[0] : '08:00 AM - 09:00 AM');
  }, [matchedSlot, session]);

  // Default teacher name
  const defaultTeacherName = useMemo(() => {
    return session.teacherName || matchedSlot?.teacherName || matchedTeacher?.name || currentClass.teacherName;
  }, [session, matchedSlot, matchedTeacher, currentClass]);

  const [customSubject, setCustomSubject] = useState(defaultSubject);
  const [customTimeSlot, setCustomTimeSlot] = useState(defaultTimeSlot);
  const [customTeacher, setCustomTeacher] = useState(defaultTeacherName);

  // Sync state whenever session or activeSlot or modal opens
  useEffect(() => {
    if (isOpen) {
      setCustomSubject(defaultSubject);
      setCustomTimeSlot(defaultTimeSlot);
      setCustomTeacher(defaultTeacherName);
      setConfig(prev => ({
        ...prev,
        customNote: session.remarks || ''
      }));
    }
  }, [isOpen, defaultSubject, defaultTimeSlot, defaultTeacherName, session.remarks]);

  if (!isOpen) return null;

  // Real-time generated WhatsApp message with clean subject and session timing
  const generatedText = generateWhatsAppMessage(
    session, 
    currentClass, 
    students, 
    config,
    {
      subject: customSubject,
      timeSlot: customTimeSlot,
      teacherName: customTeacher
    }
  );

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
          title: `Attendance Report - ${currentClass.name} (${customSubject})`,
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
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm sm:text-base leading-tight truncate">Share Attendance on WhatsApp</h3>
              <p className="text-[11px] sm:text-xs text-slate-300 truncate">
                Official report with teacher&apos;s respected subject &amp; lecture timing
              </p>
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
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-y-auto min-h-0">
          
          {/* Options Column (left) */}
          <div className="p-4 sm:p-5 md:col-span-6 border-b md:border-b-0 md:border-r border-slate-200 space-y-4 bg-slate-50 overflow-y-auto max-h-[60vh] md:max-h-none">
            
            {/* Subject & Timing Identification Box */}
            <div className="p-3.5 bg-white rounded-2xl border border-sky-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                  <span>Respected Subject &amp; Slot</span>
                </span>
                <span className="text-[10px] bg-sky-50 text-sky-700 font-bold px-2 py-0.5 rounded-full border border-sky-200">
                  Broadcasts to WhatsApp
                </span>
              </div>

              {/* Subject Input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Subject Name:</span>
                  {matchedTeacher && (
                    <span className="text-[10px] text-emerald-700 font-semibold truncate max-w-[150px]">
                      {matchedTeacher.name}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="e.g. Applied AI & Machine Learning"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500/40"
                />

                {/* Faculty Subject Quick Select Pills */}
                {facultySubjects.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Select from Faculty&apos;s Respected Subjects:</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {facultySubjects.map((sub, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setCustomSubject(sub)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer ${
                            customSubject.toLowerCase() === sub.toLowerCase()
                              ? 'bg-sky-600 text-white border-sky-600 font-bold shadow-2xs'
                              : 'bg-white hover:bg-sky-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Session Timing & Teacher Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Session Timing:</span>
                  </label>
                  <input
                    type="text"
                    value={customTimeSlot}
                    onChange={(e) => setCustomTimeSlot(e.target.value)}
                    placeholder="08:00 AM - 09:00 AM"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" />
                    <span>Faculty Name:</span>
                  </label>
                  <input
                    type="text"
                    value={customTeacher}
                    onChange={(e) => setCustomTeacher(e.target.value)}
                    placeholder="Prof. Name"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>
              </div>
            </div>

            {/* General Report Options */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Sliders className="w-3.5 h-3.5 text-slate-600" />
                <span>Summary Options</span>
              </div>

              <div className="space-y-2 bg-white p-3 rounded-2xl border border-slate-200">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.includeStats}
                    onChange={(e) => setConfig(prev => ({ ...prev, includeStats: e.target.checked }))}
                    className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <span>Include Total Counts &amp; Percentage</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.includeAbsentList}
                    onChange={(e) => setConfig(prev => ({ ...prev, includeAbsentList: e.target.checked }))}
                    className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <span>List Absent Roll Numbers</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.includeLateList}
                    onChange={(e) => setConfig(prev => ({ ...prev, includeLateList: e.target.checked }))}
                    className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <span>List Late Roll Numbers</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.includeRemarks}
                    onChange={(e) => setConfig(prev => ({ ...prev, includeRemarks: e.target.checked }))}
                    className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                  <span>Include Notice / Remarks</span>
                </label>
              </div>
            </div>

            {/* Custom Announcement Input */}
            {config.includeRemarks && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700">
                  Custom Notice / Homework Announcement:
                </label>
                <textarea
                  value={config.customNote}
                  onChange={(e) => setConfig(prev => ({ ...prev, customNote: e.target.value }))}
                  rows={2}
                  placeholder="e.g. Bring lab journals for verification tomorrow."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {/* Specific Recipient (Optional) */}
            <div className="space-y-1 pt-1">
              <label className="flex items-center gap-1 text-xs font-bold text-slate-700">
                <Phone className="w-3 h-3 text-slate-500" />
                <span>Target Phone / Group (Optional)</span>
              </label>
              <input
                type="text"
                value={config.targetPhone}
                onChange={(e) => setConfig(prev => ({ ...prev, targetPhone: e.target.value }))}
                placeholder="e.g. +91 9876543210 (leave blank for chat selector)"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* WhatsApp Message Preview Column (right) */}
          <div className="p-4 sm:p-5 md:col-span-6 bg-[#EFEAE2] flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                  <span>WhatsApp Message Preview</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono bg-white/70 px-2 py-0.5 rounded-md border border-slate-300">
                  Live Preview
                </span>
              </div>

              {/* Chat Bubble container */}
              <div className="bg-[#DCF8C6] border border-[#C5E9B0] rounded-2xl p-4 shadow-sm max-h-[380px] overflow-y-auto text-xs font-sans text-slate-800 whitespace-pre-wrap selection:bg-emerald-200">
                {generatedText}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-300/70 flex items-center justify-between text-[11px] text-slate-600">
              <span className="flex items-center gap-1 text-emerald-800 font-bold">
                <Check className="w-3.5 h-3.5" />
                <span>Subject &amp; Slot verified</span>
              </span>
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
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#25D366] hover:bg-[#1faa4f] active:scale-95 shadow-sm transition-all cursor-pointer"
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
