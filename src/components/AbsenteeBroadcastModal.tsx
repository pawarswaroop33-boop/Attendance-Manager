import React, { useState, useMemo } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Send,
  Users,
  User,
  Sliders,
  Sparkles,
  Phone,
  MessageSquare,
  BookOpen,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { Student, ClassGroup, AttendanceSession, SystemSettings, TimetableSlot } from '../types';
import {
  generateAbsenteeBroadcastMessage,
  generateAbsentParentAlertMessage,
  shareToWhatsApp,
  copyToClipboard,
  StudentIdentifierFormat,
  RollListStyle
} from '../utils/whatsapp';
import { formatDateShort, getDayOfWeek } from '../utils/dateUtils';

interface AbsenteeBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: AttendanceSession;
  currentClass: ClassGroup;
  absentStudents: Student[];
  allStudents: Student[];
  settings: SystemSettings;
  sessionDay?: string;
  timetable?: TimetableSlot[];
}

export const AbsenteeBroadcastModal: React.FC<AbsenteeBroadcastModalProps> = ({
  isOpen,
  onClose,
  session,
  currentClass,
  absentStudents,
  allStudents,
  settings,
  sessionDay,
  timetable = []
}) => {
  // Main view mode: Broadcast to group vs Individual messages
  const [activeTab, setActiveTab] = useState<'broadcast' | 'individual'>('broadcast');

  // Format selection: both (Roll + Name), roll_only, or name_only
  const [format, setFormat] = useState<StudentIdentifierFormat>('both');
  const [rollListStyle, setRollListStyle] = useState<RollListStyle>('numbered');
  
  // Custom message extras
  const [customNote, setCustomNote] = useState<string>('');
  const [includeStats, setIncludeStats] = useState<boolean>(true);
  const [includeCollegeHeader, setIncludeCollegeHeader] = useState<boolean>(true);

  // Student selection state (which absent students to include in broadcast)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(() => {
    return new Set(absentStudents.map(s => s.id));
  });

  // Track sent status for individual students
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  // Track custom/overridden phone numbers for individual students
  const [phoneOverrides, setPhoneOverrides] = useState<Record<string, string>>({});
  
  // Copy state
  const [copiedBroadcast, setCopiedBroadcast] = useState<boolean>(false);
  const [copiedIndividualId, setCopiedIndividualId] = useState<string | null>(null);

  // Sync selectedStudentIds when absentStudents changes
  React.useEffect(() => {
    setSelectedStudentIds(new Set(absentStudents.map(s => s.id)));
  }, [absentStudents]);

  // Resolve matching timetable slot if any
  const matchedSlot = useMemo(() => {
    if (session.lectureSlotId && timetable.length > 0) {
      return timetable.find(s => s.id === session.lectureSlotId) || null;
    }
    return null;
  }, [session.lectureSlotId, timetable]);

  const effectiveSubject = session.subject || matchedSlot?.subject || currentClass.subject || 'Academic Lecture';
  const effectiveTimeSlot = session.timeSlot || matchedSlot?.timeSlotLabel || session.sessionName || 'Lecture Slot';
  const effectiveTeacher = session.teacherName || matchedSlot?.teacherName || currentClass.teacherName || 'Faculty In-Charge';
  const effectiveDay = sessionDay || session.dayOfWeek || getDayOfWeek(session.date);

  // Filtered absent students selected for broadcast
  const activeAbsentStudents = useMemo(() => {
    return absentStudents.filter(s => selectedStudentIds.has(s.id));
  }, [absentStudents, selectedStudentIds]);

  // Compute present count
  const presentCount = useMemo(() => {
    let count = 0;
    Object.values(session.records || {}).forEach(r => {
      if (r?.status === 'present') count++;
    });
    return count;
  }, [session.records]);

  const totalClassEnrolled = useMemo(() => {
    const classCount = currentClass.studentIds?.length || 0;
    return classCount > 0 ? classCount : allStudents.length;
  }, [currentClass, allStudents]);

  // Generated Broadcast Message text
  const broadcastMessageText = useMemo(() => {
    return generateAbsenteeBroadcastMessage(
      activeAbsentStudents,
      session.date,
      currentClass,
      {
        format,
        rollListStyle,
        includeStats,
        customNote: customNote.trim(),
        subject: effectiveSubject,
        timeSlot: effectiveTimeSlot,
        teacherName: effectiveTeacher,
        collegeName: includeCollegeHeader ? settings.collegeName : undefined,
        departmentName: settings.departmentName,
        totalEnrolled: totalClassEnrolled,
        presentCount
      }
    );
  }, [
    activeAbsentStudents,
    session.date,
    currentClass,
    format,
    rollListStyle,
    includeStats,
    customNote,
    effectiveSubject,
    effectiveTimeSlot,
    effectiveTeacher,
    includeCollegeHeader,
    settings.collegeName,
    settings.departmentName,
    totalClassEnrolled,
    presentCount
  ]);

  if (!isOpen) return null;

  // Toggle selection for a single student
  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllStudents = () => {
    setSelectedStudentIds(new Set(absentStudents.map(s => s.id)));
  };

  const deselectAllStudents = () => {
    setSelectedStudentIds(new Set());
  };

  const handleCopyBroadcast = async () => {
    const success = await copyToClipboard(broadcastMessageText);
    if (success) {
      setCopiedBroadcast(true);
      setTimeout(() => setCopiedBroadcast(false), 2500);
    }
  };

  const handleShareBroadcastWhatsApp = () => {
    shareToWhatsApp(broadcastMessageText);
  };

  // Generate individual message for a specific student
  const getIndividualMessage = (st: Student) => {
    return generateAbsentParentAlertMessage(
      st,
      session.date,
      currentClass,
      format,
      effectiveSubject,
      effectiveTimeSlot,
      effectiveTeacher,
      includeCollegeHeader ? settings.collegeName : undefined,
      customNote.trim()
    );
  };

  const handleSendIndividualWhatsApp = (st: Student) => {
    const phone = phoneOverrides[st.id] !== undefined ? phoneOverrides[st.id] : (st.parentPhone || '');
    const msg = getIndividualMessage(st);
    shareToWhatsApp(msg, phone);
    setSentMap(prev => ({ ...prev, [st.id]: true }));
  };

  const handleCopyIndividual = async (st: Student) => {
    const msg = getIndividualMessage(st);
    const success = await copyToClipboard(msg);
    if (success) {
      setCopiedIndividualId(st.id);
      setTimeout(() => setCopiedIndividualId(null), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
        
        {/* Header Strip */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-4 sm:p-5 flex items-start justify-between gap-4 shrink-0 shadow-md">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-extrabold uppercase tracking-wide backdrop-blur-xs">
                <Share2 className="w-3 h-3 text-emerald-300" />
                WhatsApp Absentee Broadcast
              </span>
              <span className="text-xs text-emerald-200 font-medium">
                {currentClass.name}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <span>Absent Students WhatsApp Dispatch</span>
            </h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-100 pt-0.5">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
                <strong>{effectiveSubject}</strong>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-300" />
                <span>{effectiveTimeSlot}</span>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-300" />
                <span>{formatDateShort(session.date)} ({effectiveDay})</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-200/90 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('broadcast')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'broadcast'
                  ? 'bg-[#25D366] text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Broadcast to Group / All ({activeAbsentStudents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('individual')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'individual'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Send Individually ({absentStudents.length})</span>
            </button>
          </div>

          <span className="text-[11px] font-bold text-slate-500 hidden sm:inline font-mono">
            {absentStudents.length} Absent of {totalClassEnrolled} Enrolled
          </span>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Format Control Strip - Satisfying user requirement: "flexibility to control roll number , with name or individualy" */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wide">
                    Message Identifier Format Control
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Choose how absent students are displayed in WhatsApp messages
                  </p>
                </div>
              </div>

              {/* Sub-toggle for roll style if roll_only */}
              {format === 'roll_only' && activeTab === 'broadcast' && (
                <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl text-[11px]">
                  <span className="text-slate-500 font-semibold px-1.5">Style:</span>
                  <button
                    type="button"
                    onClick={() => setRollListStyle('numbered')}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                      rollListStyle === 'numbered' ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                  >
                    1. 2. 3. List
                  </button>
                  <button
                    type="button"
                    onClick={() => setRollListStyle('inline')}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                      rollListStyle === 'inline' ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                  >
                    101, 102 Inline
                  </button>
                </div>
              )}
            </div>

            {/* Format Radio Tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: Both Roll Number + Name */}
              <button
                type="button"
                onClick={() => setFormat('both')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  format === 'both'
                    ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center ${
                  format === 'both' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                }`}>
                  {format === 'both' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-extrabold text-slate-900 block">
                    Roll Number + Name
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate mt-0.5 font-mono">
                    e.g. 1. Roll #101 - Swaroop Pawar
                  </span>
                </div>
              </button>

              {/* Option 2: Roll Number Only */}
              <button
                type="button"
                onClick={() => setFormat('roll_only')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  format === 'roll_only'
                    ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center ${
                  format === 'roll_only' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                }`}>
                  {format === 'roll_only' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-extrabold text-slate-900 block">
                    Roll Number Only
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate mt-0.5 font-mono">
                    e.g. 1. Roll #101 (or 101, 102...)
                  </span>
                </div>
              </button>

              {/* Option 3: Name Only */}
              <button
                type="button"
                onClick={() => setFormat('name_only')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                  format === 'name_only'
                    ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center ${
                  format === 'name_only' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                }`}>
                  {format === 'name_only' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-extrabold text-slate-900 block">
                    Name Only
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate mt-0.5 font-mono">
                    e.g. 1. Swaroop Pawar
                  </span>
                </div>
              </button>
            </div>

            {/* Optional message customization */}
            <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Custom Faculty Announcement / Instructions (Optional):
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. Leave application must be submitted tomorrow, contact HOD"
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 md:pt-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeStats}
                    onChange={(e) => setIncludeStats(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                  />
                  <span>Include Lecture Attendance % Stats</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCollegeHeader}
                    onChange={(e) => setIncludeCollegeHeader(e.target.checked)}
                    className="w-4 h-4 rounded-sm text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                  />
                  <span>Include College Header</span>
                </label>
              </div>
            </div>
          </div>

          {/* TAB 1: GROUP BROADCAST VIEW */}
          {activeTab === 'broadcast' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Left Column: Student Inclusion Controls */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-800">
                      Included Absentees ({selectedStudentIds.size}/{absentStudents.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={selectAllStudents}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllStudents}
                      className="text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition-all cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-2 max-h-[340px] overflow-y-auto space-y-1 divide-y divide-slate-100 shadow-2xs">
                  {absentStudents.map((st) => {
                    const isSelected = selectedStudentIds.has(st.id);
                    return (
                      <label
                        key={st.id}
                        className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer pt-1.5 ${
                          isSelected ? 'bg-emerald-50/50 text-slate-900' : 'text-slate-500 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudentSelection(st.id)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                          />
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 shrink-0">
                            #{st.rollNo}
                          </span>
                          <span className="text-xs font-semibold truncate">
                            {st.name}
                          </span>
                        </div>

                        <span className="text-[10px] font-mono text-slate-400 shrink-0 pl-1">
                          {st.parentPhone || 'No phone'}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 font-medium">
                  💡 <strong>Tip:</strong> You can uncheck any student who had verbal leave permission before broadcasting to the class group.
                </div>
              </div>

              {/* Right Column: Live WhatsApp Message Preview & Broadcast Action */}
              <div className="lg:col-span-7 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp Message Live Preview</span>
                  </span>

                  <span className="text-[11px] text-slate-500 font-medium">
                    Formatted for WhatsApp Web & Mobile
                  </span>
                </div>

                {/* WhatsApp Chat Bubble Mockup */}
                <div className="bg-[#EFEAE2] rounded-2xl p-3.5 border border-slate-300 shadow-inner flex-1 flex flex-col justify-between min-h-[300px]">
                  <div className="bg-white rounded-xl p-3.5 shadow-xs border border-emerald-100/80 space-y-2 text-slate-900 font-sans text-xs leading-relaxed max-h-[320px] overflow-y-auto whitespace-pre-wrap selection:bg-emerald-200">
                    {broadcastMessageText}
                  </div>

                  <div className="pt-3 flex flex-wrap items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={handleCopyBroadcast}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-300 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedBroadcast ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedBroadcast ? 'Message Copied!' : 'Copy Text'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareBroadcastWhatsApp}
                      className="px-5 py-2 rounded-xl bg-[#25D366] hover:bg-[#1faa4f] text-white text-xs font-extrabold shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Broadcast on WhatsApp</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: INDIVIDUAL DIRECT MESSAGES ("or individualy") */}
          {activeTab === 'individual' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-sky-950">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-200 text-sky-800 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold">Individual Student & Parent Notification Mode</h4>
                    <p className="text-[11px] text-sky-800/80">
                      Send a tailored WhatsApp absent alert directly to each student or parent contact with selected format ({format === 'both' ? 'Roll No & Name' : format === 'roll_only' ? 'Roll No only' : 'Name only'}).
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-white border border-sky-300 text-sky-900 shadow-2xs">
                    {Object.values(sentMap).filter(Boolean).length} of {absentStudents.length} Sent
                  </span>
                </div>
              </div>

              {/* Absent Students Individual Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {absentStudents.map((st) => {
                  const isSent = !!sentMap[st.id];
                  const currentPhone = phoneOverrides[st.id] !== undefined ? phoneOverrides[st.id] : (st.parentPhone || '');
                  const isCopied = copiedIndividualId === st.id;

                  return (
                    <div
                      key={st.id}
                      className={`bg-white rounded-2xl border p-4 shadow-2xs space-y-3 transition-all ${
                        isSent ? 'border-emerald-400/90 bg-emerald-50/20' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800">
                              Roll #{st.rollNo}
                            </span>
                            <h4 className="text-xs font-black text-slate-900 truncate">
                              {st.name}
                            </h4>
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                            Parent: <strong>{st.parentName || 'Guardian'}</strong>
                          </span>
                        </div>

                        {isSent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Sent</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                            Ready
                          </span>
                        )}
                      </div>

                      {/* Phone Number Input */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center justify-between">
                          <span>Target WhatsApp Phone:</span>
                          {!currentPhone && (
                            <span className="text-rose-500 font-semibold lowercase">Required</span>
                          )}
                        </label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={currentPhone}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPhoneOverrides(prev => ({ ...prev, [st.id]: val }));
                            }}
                            placeholder="Enter 10-digit mobile number"
                            className="w-full pl-8 pr-3 py-1.5 text-xs font-mono rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
                          />
                        </div>
                      </div>

                      {/* Message Preview Snippet */}
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 font-mono line-clamp-2 leading-relaxed">
                        {getIndividualMessage(st)}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyIndividual(st)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Copy individual message text"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendIndividualWhatsApp(st)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#1faa4f] text-white text-xs font-extrabold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title="Open WhatsApp chat for this student's parent"
                        >
                          <Send className="w-3 h-3" />
                          <span>Send WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer Bar */}
        <div className="bg-slate-100 border-t border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span>Selected format:</span>
            <span className="font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-lg font-mono">
              {format === 'both' ? 'Roll No + Name' : format === 'roll_only' ? 'Roll No Only' : 'Name Only'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>
            {activeTab === 'broadcast' && (
              <button
                type="button"
                onClick={handleShareBroadcastWhatsApp}
                className="px-5 py-2 rounded-xl bg-[#25D366] hover:bg-[#1faa4f] text-white text-xs font-black shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Broadcast on WhatsApp</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
