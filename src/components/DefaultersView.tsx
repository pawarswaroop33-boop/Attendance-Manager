import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  MessageSquare, 
  Sliders, 
  Download, 
  PhoneCall, 
  ExternalLink, 
  Send, 
  Filter, 
  Sparkles, 
  UserX, 
  Building2,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Student, ClassGroup, AttendanceSession, SystemSettings } from '../types';

interface DefaultersViewProps {
  students: Student[];
  classes: ClassGroup[];
  sessions: AttendanceSession[];
  settings: SystemSettings;
  onUpdateThreshold: (newThreshold: number) => void;
  userRole: 'hod' | 'teacher';
}

export const DefaultersView: React.FC<DefaultersViewProps> = ({
  students,
  classes,
  sessions,
  settings,
  onUpdateThreshold,
  userRole
}) => {
  const [threshold, setThreshold] = useState<number>(settings.defaulterThreshold || 50);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sentAlerts, setSentAlerts] = useState<Record<string, boolean>>({});
  const [missingPhoneWarning, setMissingPhoneWarning] = useState<string | null>(null);

  // Compute student attendance stats across sessions
  const studentStats = useMemo(() => {
    return students.map(student => {
      // Find classes student belongs to
      const studentClasses = classes.filter(c => c.studentIds.includes(student.id));
      const primaryClass = studentClasses[0] || classes[0];

      // Find sessions for these classes
      const relevantSessions = sessions.filter(s => 
        studentClasses.some(c => c.id === s.classId)
      );

      let totalLectures = 0;
      let attendedLectures = 0;

      relevantSessions.forEach(session => {
        const record = session.records[student.id];
        if (record && record.status !== 'unmarked') {
          totalLectures++;
          if (record.status === 'present') {
            attendedLectures += 1;
          } else if (record.status === 'late') {
            attendedLectures += 0.5; // late counts as partial
          }
        }
      });

      const percentage = totalLectures > 0 ? (attendedLectures / totalLectures) * 100 : 100;
      const isDefaulter = percentage < threshold;

      return {
        student,
        primaryClass,
        totalLectures,
        attendedLectures,
        percentage: Number(percentage.toFixed(1)),
        isDefaulter,
        remarks: student.remarks || (isDefaulter ? 'Attendance below minimum campus requirement' : 'Regular')
      };
    });
  }, [students, classes, sessions, threshold]);

  // Filtered defaulter list
  const defaultersList = useMemo(() => {
    return studentStats.filter(item => {
      if (!item.isDefaulter) return false;
      if (selectedClassFilter !== 'all' && item.primaryClass.id !== selectedClassFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = item.student.name.toLowerCase().includes(query);
        const matchesRoll = item.student.rollNo.includes(query);
        const matchesParent = (item.student.parentPhone || '').includes(query);
        if (!matchesName && !matchesRoll && !matchesParent) return false;
      }
      return true;
    }).sort((a, b) => a.percentage - b.percentage); // Lowest attendance first
  }, [studentStats, selectedClassFilter, searchQuery]);

  // Handle threshold change
  const handleThresholdChange = (val: number) => {
    setThreshold(val);
    onUpdateThreshold(val);
  };

  // Generate WhatsApp Warning message
  const createWhatsAppWarning = (item: typeof studentStats[0]) => {
    const parentPhone = item.student.parentPhone?.replace(/\D/g, '') || '';
    if (!parentPhone) {
      setMissingPhoneWarning(`Parent contact phone number is not available for ${item.student.name}. Please edit student details to add a WhatsApp number.`);
      setTimeout(() => setMissingPhoneWarning(null), 5000);
      return;
    }
    setMissingPhoneWarning(null);

    const message = 
      `🚨 *ACADEMIC ATTENDANCE ALERT - ${settings.collegeName}*\n\n` +
      `Dear Parent / Guardian,\n` +
      `This is to notify you regarding the attendance of your ward:\n\n` +
      `👤 *Student Name:* ${item.student.name}\n` +
      `📋 *Roll Number:* ${item.student.rollNo}\n` +
      `🏫 *Class/Div:* ${item.primaryClass.name}\n` +
      `📊 *Total Lectures Conducted:* ${item.totalLectures}\n` +
      `✅ *Lectures Attended:* ${item.attendedLectures}\n` +
      `⚠️ *Current Attendance:* ${item.percentage}%\n` +
      `🎯 *Mandatory Minimum Threshold:* ${threshold}%\n\n` +
      `⚠️ *Status:* Defaulter / Low Attendance\n` +
      `*Remark:* ${item.remarks}\n\n` +
      `Kindly ensure your ward attends upcoming lectures regularly to avoid being debarred from term-end exams.\n\n` +
      `- *Faculty In-Charge & HOD*\n` +
      `${settings.departmentName}\n` +
      `${settings.collegeName}`;

    const formattedPhone = parentPhone.length === 10 ? `91${parentPhone}` : parentPhone;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    
    // Mark as sent in state
    setSentAlerts(prev => ({ ...prev, [item.student.id]: true }));
    
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Roll No', 'Student Name', 'Class', 'Total Lectures', 'Attended', 'Attendance %', 'Parent Name', 'Parent Contact', 'Remarks'];
    const rows = defaultersList.map(item => [
      item.student.rollNo,
      `"${item.student.name}"`,
      `"${item.primaryClass.name}"`,
      item.totalLectures,
      item.attendedLectures,
      `${item.percentage}%`,
      `"${item.student.parentName || 'Guardian'}"`,
      `"${item.student.parentPhone || ''}"`,
      `"${item.remarks}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DYPATIL_Defaulters_List_${threshold}percent_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Missing Parent Phone Warning Notice */}
      {missingPhoneWarning && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs text-amber-900 font-semibold animate-fadeIn shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{missingPhoneWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setMissingPhoneWarning(null)}
            className="text-amber-600 hover:text-amber-800 font-bold px-2 py-1 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Top Controls: Teacher Defaulter Criteria Setter (Req 15) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Sliders className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Defaulter Criteria Configuration
                </h2>
                <p className="text-xs text-slate-500">
                  Set by faculty: Students below this percentage will be automatically separated & highlighted as defaulters
                </p>
              </div>
            </div>
          </div>

          {/* Quick Percentage Presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Quick Presets:</span>
            {[50, 60, 65, 75].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => handleThresholdChange(val)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  threshold === val
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {val}%
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Threshold Slider & Number Field */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="defaulter-threshold-range" className="font-bold text-slate-700">
                Defaulter Attendance Cutoff:
              </label>
              <span className="font-mono font-bold text-rose-600 text-sm">
                &lt; {threshold}% Attendance
              </span>
            </div>
            <input
              id="defaulter-threshold-range"
              type="range"
              min={25}
              max={85}
              step={5}
              value={threshold}
              onChange={(e) => handleThresholdChange(Number(e.target.value))}
              className="w-full accent-rose-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>25% (Critical)</span>
              <span>50% (Default Criteria)</span>
              <span>75% (University Mandate)</span>
              <span>85% (Strict)</span>
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">
                Identified Defaulters
              </p>
              <p className="text-2xl font-extrabold text-rose-900 mt-0.5">
                {defaultersList.length} <span className="text-xs font-semibold text-rose-700">students</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-600/10 text-rose-700 flex items-center justify-center">
              <UserX className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Defaulter Action Bar: Search, Class Filter, Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Class Filter */}
          <select
            id="filter-defaulters-class"
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">All Classes & Divisions</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Search Query */}
          <input
            id="search-defaulters-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, roll no, or phone..."
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900 flex-1 min-w-[200px]"
          />
        </div>

        {/* Export Button */}
        <button
          id="export-defaulters-csv-button"
          type="button"
          onClick={handleExportCSV}
          disabled={defaultersList.length === 0}
          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
            defaultersList.length > 0
              ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:scale-95'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Defaulter Report</span>
        </button>
      </div>

      {/* SEPARATED & HIGHLIGHTED DEFAULTER LIST (Requirement 16) */}
      <div className="bg-white rounded-2xl border-2 border-rose-300 shadow-md overflow-hidden">
        
        {/* Banner */}
        <div className="bg-gradient-to-r from-rose-600 to-rose-700 px-5 py-3.5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-white" />
            </span>
            <div>
              <h3 className="text-sm font-bold tracking-wide uppercase">
                Official Defaulter List (Attendance &lt; {threshold}%)
              </h3>
              <p className="text-xs text-rose-100">
                Click any parent phone number or warning button to trigger an instant WhatsApp notice
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-mono font-bold text-white">
            {defaultersList.length} Flagged
          </span>
        </div>

        {/* Table View (Desktop) and Card View (Mobile) */}
        {defaultersList.length === 0 ? (
          <div className="p-10 sm:p-12 text-center text-slate-500 space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">No Defaulters Found!</p>
            <p className="text-xs text-slate-500">
              All students have attendance greater than or equal to {threshold}%.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card View (visible on mobile < 768px) */}
            <div className="block md:hidden divide-y divide-rose-100">
              {defaultersList.map((item) => {
                const hasSent = sentAlerts[item.student.id];

                return (
                  <div key={item.student.id} className="p-3.5 bg-rose-50/20 space-y-2.5">
                    {/* Header: Roll + Name + Attendance Rate */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-200 shrink-0">
                          #{item.student.rollNo}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {item.student.name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {item.primaryClass.name}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white font-mono font-extrabold text-xs shadow-xs">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Stats & Parent Info */}
                    <div className="flex items-center justify-between text-xs text-slate-600 bg-white/70 p-2 rounded-xl border border-rose-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Attendance</span>
                        <span className="font-mono font-bold text-rose-900">
                          {item.attendedLectures} / {item.totalLectures} lectures
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Parent</span>
                        <span className="font-medium text-slate-800 truncate block max-w-[150px]">
                          {item.student.parentPhone || 'No phone saved'}
                        </span>
                      </div>
                    </div>

                    {/* Action Button: WhatsApp Alert */}
                    <button
                      type="button"
                      onClick={() => createWhatsAppWarning(item)}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer min-h-[40px] ${
                        hasSent 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-rose-600 hover:bg-rose-700 text-white active:scale-98'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{hasSent ? 'Warning Sent (Send Again)' : 'Send Parent Warning on WhatsApp'}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (hidden on mobile < 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-rose-50/70 border-b border-rose-200 text-rose-950 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Roll No</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Class / Division</th>
                    <th className="py-3 px-4 text-center">Lectures</th>
                    <th className="py-3 px-4 text-center">Attendance %</th>
                    <th className="py-3 px-4">Parent Details & Mobile</th>
                    <th className="py-3 px-4">Remarks</th>
                    <th className="py-3 px-4 text-right">Parent Warning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100">
                  {defaultersList.map((item) => {
                    const hasSent = sentAlerts[item.student.id];

                    return (
                      <tr 
                        key={item.student.id} 
                        className="bg-rose-50/30 hover:bg-rose-100/50 transition-colors"
                      >
                        {/* Roll No */}
                        <td className="py-3 px-4 font-mono font-bold text-rose-900">
                          {item.student.rollNo}
                        </td>

                        {/* Student Name */}
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-rose-200 text-rose-800 font-bold text-[10px] flex items-center justify-center">
                              {item.student.name.charAt(0)}
                            </span>
                            <span>{item.student.name}</span>
                          </div>
                        </td>

                        {/* Class */}
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {item.primaryClass.name}
                        </td>

                        {/* Total Lectures vs Attended */}
                        <td className="py-3 px-4 text-center font-mono font-semibold text-slate-800">
                          <span className="text-emerald-700 font-bold">{item.attendedLectures}</span>
                          <span className="text-slate-400"> / </span>
                          <span>{item.totalLectures}</span>
                        </td>

                        {/* Highlighted Percentage */}
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white font-mono font-extrabold text-xs shadow-xs">
                            {item.percentage}%
                          </span>
                        </td>

                        {/* Parent Contact Info */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-slate-900">
                              {item.student.parentName || 'Parent / Guardian'}
                            </p>
                            <button
                              type="button"
                              onClick={() => createWhatsAppWarning(item)}
                              className="inline-flex items-center gap-1 font-mono text-xs text-rose-700 hover:text-rose-900 underline font-bold cursor-pointer"
                              title="Click to send warning message on WhatsApp"
                            >
                              <PhoneCall className="w-3 h-3 text-emerald-600" />
                              <span>{item.student.parentPhone || 'No contact saved'}</span>
                            </button>
                          </div>
                        </td>

                        {/* Remarks */}
                        <td className="py-3 px-4 text-slate-600 text-[11px] max-w-[180px]">
                          <span className="bg-white border border-rose-200 px-2 py-0.5 rounded text-rose-900 font-medium">
                            {item.remarks}
                          </span>
                        </td>

                        {/* Warning Trigger Button */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => createWhatsAppWarning(item)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 min-h-[36px] ${
                              hasSent 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-rose-600 hover:bg-rose-700 text-white'
                            }`}
                          >
                            {hasSent ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Sent Again</span>
                              </>
                            ) : (
                              <>
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />
                                <span>Send Warning</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>

    </div>
  );
};
