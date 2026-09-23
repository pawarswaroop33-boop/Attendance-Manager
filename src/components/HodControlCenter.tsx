import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Settings, 
  Users, 
  Calendar, 
  Building, 
  Plus, 
  Trash2, 
  Edit3, 
  Key, 
  Copy, 
  Check, 
  RotateCcw, 
  Save, 
  BookOpen, 
  MapPin, 
  AlertCircle,
  AlertTriangle,
  Sparkles,
  School,
  Building2,
  Clock,
  Search,
  UserPlus,
  Phone,
  GraduationCap,
  Database,
  Server,
  Cloud,
  Download,
  ArrowRightLeft,
  CheckCircle2,
  Code
} from 'lucide-react';
import { Teacher, Classroom, TimetableSlot, ClassGroup, SystemSettings, DayOfWeek, Student } from '../types';
import { dbService } from '../services/databaseService';

interface HodControlCenterProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: SystemSettings) => void;
  onResetSettings: () => void;
  teachers: Teacher[];
  onAddTeacher: (teacher: Teacher) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  classrooms: Classroom[];
  onAddClassroom: (classroom: Classroom) => void;
  onDeleteClassroom: (id: string) => void;
  classes: ClassGroup[];
  onAddClass: (newClass: ClassGroup) => void;
  onDeleteClass: (id: string) => void;
  timetable: TimetableSlot[];
  onAddTimetableSlot: (slot: TimetableSlot) => void;
  onDeleteTimetableSlot: (id: string) => void;
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id'>, targetClassId: string) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onDeleteAllStudents: (scope: 'current_class' | 'all_campus', targetClassId?: string) => void;
  onResetAllData: () => void;
  onOpenImportModal: () => void;
  onForceSyncCloud?: () => void;
  isCloudSyncing?: boolean;
}

export const HodControlCenter: React.FC<HodControlCenterProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  teachers,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  classrooms,
  onAddClassroom,
  onDeleteClassroom,
  classes,
  onAddClass,
  onDeleteClass,
  timetable,
  onAddTimetableSlot,
  onDeleteTimetableSlot,
  students,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onDeleteAllStudents,
  onResetAllData,
  onOpenImportModal,
  onForceSyncCloud,
  isCloudSyncing
}) => {
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'timetable' | 'classrooms' | 'classes' | 'settings' | 'database'>('students');
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Synchronized Settings State
  const [collegeName, setCollegeName] = useState(settings.collegeName);
  const [deptName, setDeptName] = useState(settings.departmentName);
  const [hodName, setHodName] = useState(settings.hodName);
  const [hodPasscode, setHodPasscode] = useState(settings.hodPasscode);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  // Sync whenever settings prop updates (e.g. on reset)
  useEffect(() => {
    setCollegeName(settings.collegeName);
    setDeptName(settings.departmentName);
    setHodName(settings.hodName);
    setHodPasscode(settings.hodPasscode);
  }, [settings]);

  // Modal states for in-app confirmations (NO window.confirm)
  const [showResetCampusModal, setShowResetCampusModal] = useState(false);
  const [showResetSettingsModal, setShowResetSettingsModal] = useState(false);
  const [showDeleteAllStudentsModal, setShowDeleteAllStudentsModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Student Tab state
  const [selectedStudentClassId, setSelectedStudentClassId] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Add Student Form State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentRoll, setNewStudentRoll] = useState('');
  const [newStudentGender, setNewStudentGender] = useState<'M' | 'F' | 'Other'>('M');
  const [newStudentParent, setNewStudentParent] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentClassId, setNewStudentClassId] = useState(classes[0]?.id || '');

  // Teacher Modal / Form State
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherCode, setNewTeacherCode] = useState(`TEACH${100 + teachers.length + 1}`);
  const [newTeacherPasscode, setNewTeacherPasscode] = useState('teach123');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherPhone, setNewTeacherPhone] = useState('+91');
  const [newTeacherSubjects, setNewTeacherSubjects] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Timetable Slot Form State
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [newSlotDay, setNewSlotDay] = useState<DayOfWeek>('Monday');
  const [newSlotStartTime, setNewSlotStartTime] = useState('08:00 AM');
  const [newSlotEndTime, setNewSlotEndTime] = useState('09:00 AM');
  const [newSlotSubject, setNewSlotSubject] = useState('');
  const [newSlotClassId, setNewSlotClassId] = useState(classes[0]?.id || '');
  const [newSlotTeacherId, setNewSlotTeacherId] = useState(teachers[0]?.id || '');
  const [newSlotRoomId, setNewSlotRoomId] = useState(classrooms[0]?.id || '');

  // Classroom Form State
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomBuilding, setNewRoomBuilding] = useState('Engineering Wing A');
  const [newRoomCapacity, setNewRoomCapacity] = useState(70);
  const [newRoomType, setNewRoomType] = useState<'classroom' | 'lab' | 'seminar_hall'>('classroom');

  // Handle Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...settings,
      collegeName,
      departmentName: deptName,
      hodName,
      hodPasscode
    });
    setSettingsSavedMsg(true);
    setTimeout(() => setSettingsSavedMsg(false), 3000);
  };

  // Handle Add Teacher
  const handleSaveNewTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim() || !newTeacherCode.trim()) return;

    const subjectsArr = newTeacherSubjects
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const teacherObj: Teacher = {
      id: `teach-${Date.now()}`,
      uniqueCode: newTeacherCode.trim().toUpperCase(),
      passcode: newTeacherPasscode.trim() || 'teach123',
      name: newTeacherName.trim(),
      email: newTeacherEmail.trim() || `${newTeacherCode.toLowerCase()}@dypatil.edu`,
      phone: newTeacherPhone.trim(),
      department: deptName,
      subjects: subjectsArr.length > 0 ? subjectsArr : ['General Engineering'],
      assignedClasses: [classes[0]?.id || 'class-1']
    };

    onAddTeacher(teacherObj);
    setShowAddTeacherModal(false);
    setNewTeacherName('');
    setNewTeacherCode(`TEACH${100 + teachers.length + 2}`);
    setNewTeacherSubjects('');
  };

  // Handle Add Timetable Slot
  const handleSaveNewSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotSubject.trim()) return;

    const selectedClass = classes.find(c => c.id === newSlotClassId);
    const selectedTeacher = teachers.find(t => t.id === newSlotTeacherId);
    const selectedRoom = classrooms.find(r => r.id === newSlotRoomId);

    const slot: TimetableSlot = {
      id: `slot-${Date.now()}`,
      dayOfWeek: newSlotDay,
      startTime: newSlotStartTime,
      endTime: newSlotEndTime,
      timeSlotLabel: `${newSlotStartTime} - ${newSlotEndTime}`,
      subject: newSlotSubject.trim(),
      classId: newSlotClassId,
      className: selectedClass?.name || 'Engineering Class',
      teacherId: newSlotTeacherId,
      teacherName: selectedTeacher?.name || 'Faculty Member',
      roomId: newSlotRoomId,
      roomName: selectedRoom?.name || 'Classroom'
    };

    onAddTimetableSlot(slot);
    setShowAddSlotModal(false);
    setNewSlotSubject('');
  };

  // Handle Add Classroom
  const handleSaveNewClassroom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const room: Classroom = {
      id: `room-${Date.now()}`,
      name: newRoomName.trim(),
      building: newRoomBuilding.trim(),
      capacity: newRoomCapacity,
      type: newRoomType
    };

    onAddClassroom(room);
    setShowAddRoomModal(false);
    setNewRoomName('');
  };

  // Handle Save Student (Add or Edit)
  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentRoll.trim()) return;

    if (editingStudent) {
      const updatedSt: Student = {
        ...editingStudent,
        name: newStudentName.trim(),
        rollNo: newStudentRoll.trim(),
        gender: newStudentGender
      };
      if (newStudentParent.trim()) updatedSt.parentName = newStudentParent.trim();
      else delete (updatedSt as any).parentName;
      if (newStudentPhone.trim()) updatedSt.parentPhone = newStudentPhone.trim();
      else delete (updatedSt as any).parentPhone;
      if (newStudentEmail.trim()) updatedSt.email = newStudentEmail.trim();
      else delete (updatedSt as any).email;

      onUpdateStudent(updatedSt);
      setEditingStudent(null);
    } else {
      const newSt: Omit<Student, 'id'> = {
        name: newStudentName.trim(),
        rollNo: newStudentRoll.trim(),
        gender: newStudentGender,
        avatarBg: 'bg-slate-800'
      };
      if (newStudentParent.trim()) newSt.parentName = newStudentParent.trim();
      if (newStudentPhone.trim()) newSt.parentPhone = newStudentPhone.trim();
      if (newStudentEmail.trim()) newSt.email = newStudentEmail.trim();

      onAddStudent(newSt, newStudentClassId);
    }

    setShowAddStudentModal(false);
    setNewStudentName('');
    setNewStudentRoll('');
    setNewStudentParent('');
    setNewStudentPhone('');
    setNewStudentEmail('');
  };

  const handleStartEditStudent = (student: Student) => {
    setEditingStudent(student);
    setNewStudentName(student.name);
    setNewStudentRoll(student.rollNo);
    setNewStudentGender(student.gender);
    setNewStudentParent(student.parentName || '');
    setNewStudentPhone(student.parentPhone || '');
    setNewStudentEmail(student.email || '');
    setShowAddStudentModal(true);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Filtered students for HOD student tab
  const displayedStudents = students.filter(st => {
    if (selectedStudentClassId !== 'all') {
      const cls = classes.find(c => c.id === selectedStudentClassId);
      if (!cls || !cls.studentIds.includes(st.id)) return false;
    }
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return st.name.toLowerCase().includes(q) || st.rollNo.includes(q) || st.parentPhone?.includes(q);
  });

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase mb-1 border border-amber-500/30">
              Department Governance
            </div>
            <h1 className="text-base sm:text-xl font-extrabold text-white">
              HOD Control Center & ERP Administration
            </h1>
            <p className="text-xs text-slate-400">
              {settings.hodName} &bull; {settings.departmentName} &bull; {settings.collegeName}
            </p>
          </div>
        </div>

        {/* Global Reset Button */}
        <button
          id="hod-reset-campus-btn"
          type="button"
          onClick={() => setShowResetCampusModal(true)}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-700/60 text-rose-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Campus System</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        
        {/* Tab: Students Management */}
        <button
          id="hod-tab-students"
          type="button"
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'students'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-amber-400" />
          <span>Students & Roster ({students.length})</span>
        </button>

        {/* Tab: Teachers */}
        <button
          id="hod-tab-teachers"
          type="button"
          onClick={() => setActiveTab('teachers')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'teachers'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          <span>Teachers & Codes ({teachers.length})</span>
        </button>

        {/* Tab: Timetable */}
        <button
          id="hod-tab-timetable"
          type="button"
          onClick={() => setActiveTab('timetable')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'timetable'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4 text-sky-400" />
          <span>Timetable ({timetable.length})</span>
        </button>

        {/* Tab: Classrooms */}
        <button
          id="hod-tab-classrooms"
          type="button"
          onClick={() => setActiveTab('classrooms')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'classrooms'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building className="w-4 h-4 text-indigo-400" />
          <span>Classrooms & Labs ({classrooms.length})</span>
        </button>

        {/* Tab: Settings */}
        <button
          id="hod-tab-settings"
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Settings className="w-4 h-4 text-amber-400" />
          <span>Campus & System Settings</span>
        </button>

        {/* Tab: Database & Supabase Migration (Req: Firebase enabled & Supabase ready) */}
        <button
          id="hod-tab-database"
          type="button"
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'database'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database & Cloud Sync</span>
          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
            activeTab === 'database' ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-900'
          }`}>
            Firebase Live
          </span>
        </button>
      </div>

      {/* TAB 1: STUDENTS MANAGEMENT IN HOD SYSTEM */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Department Student Directory & Enrolment</h2>
              <p className="text-xs text-slate-500">
                HOD authority to view, enroll, update, and manage student rosters across all divisions
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onOpenImportModal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Scan Excel / PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingStudent(null);
                  setNewStudentName('');
                  setNewStudentRoll('');
                  setNewStudentParent('');
                  setNewStudentPhone('');
                  setNewStudentEmail('');
                  setShowAddStudentModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Enroll Student</span>
              </button>

              {students.length > 0 && (
                <button
                  id="hod-delete-all-students-btn"
                  type="button"
                  onClick={() => setShowDeleteAllStudentsModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs transition-all shadow-xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete All Students</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-56">
              <select
                value={selectedStudentClassId}
                onChange={(e) => setSelectedStudentClassId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-hidden"
              >
                <option value="all">All Classes & Divisions ({students.length})</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.studentIds.length} students)
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search students by name, roll number, or phone..."
                className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Student Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Roll</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Gender</th>
                    <th className="py-3 px-4">Enrolled Class</th>
                    <th className="py-3 px-4">Parent WhatsApp</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500 font-medium">
                        No students found matching your criteria. Click "Enroll Student" or "Scan Excel / PDF" to add.
                      </td>
                    </tr>
                  ) : (
                    displayedStudents.map(student => {
                      const studentClasses = classes.filter(c => c.studentIds.includes(student.id));
                      return (
                        <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">#{student.rollNo}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{student.name}</td>
                          <td className="py-3 px-4 text-slate-600">{student.gender}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {studentClasses.map(c => (
                                <span key={c.id} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {student.parentPhone ? (
                              <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <Phone className="w-3 h-3 text-[#25D366]" />
                                {student.parentPhone}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditStudent(student)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit student details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setStudentToDelete(student)}
                                className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEACHER MANAGEMENT (Req 6) */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Faculty Roster & Unique Login Codes</h2>
              <p className="text-xs text-slate-500">
                HOD assigns unique codes and subjects to teachers for authorized login
              </p>
            </div>

            <button
              id="add-teacher-button"
              type="button"
              onClick={() => setShowAddTeacherModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Teacher</span>
            </button>
          </div>

          {/* Teacher Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teachers.map(teacher => (
              <div 
                key={teacher.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm border border-emerald-200">
                      {teacher.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{teacher.name}</h3>
                      <p className="text-xs text-slate-500">{teacher.email}</p>
                    </div>
                  </div>

                  {teachers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteTeacher(teacher.id)}
                      className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove teacher"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Unique Login Credentials Badge */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-slate-500">Unique Login Code & Passcode</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-sm text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                        {teacher.uniqueCode}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        Pass: <strong className="text-slate-800">{teacher.passcode}</strong>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(teacher.uniqueCode, teacher.id)}
                    className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-all cursor-pointer shadow-2xs"
                    title="Copy teacher code"
                  >
                    {copiedCodeId === teacher.id ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Respective Subjects */}
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-600">Assigned Subjects:</p>
                  <div className="flex flex-wrap gap-1">
                    {teacher.subjects.map((sub, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 text-[11px] font-medium border border-sky-200">
                        {sub}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TIMETABLE & LECTURE HOURS */}
      {activeTab === 'timetable' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Weekly Lecture Schedule & Timetable</h2>
              <p className="text-xs text-slate-500">
                Configure lecture hours, subjects, classrooms and assigned teachers
              </p>
            </div>

            <button
              id="add-timetable-slot-button"
              type="button"
              onClick={() => setShowAddSlotModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule New Lecture Hour</span>
            </button>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-800 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Day</th>
                    <th className="py-3 px-4">Time Slot</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Class / Division</th>
                    <th className="py-3 px-4">Classroom</th>
                    <th className="py-3 px-4">Teacher</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {timetable.map(slot => (
                    <tr key={slot.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{slot.dayOfWeek}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-sky-800">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200">
                          <Clock className="w-3 h-3 text-sky-600" />
                          <span>{slot.timeSlotLabel}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{slot.subject}</td>
                      <td className="py-3 px-4 text-slate-700">{slot.className}</td>
                      <td className="py-3 px-4 text-slate-600">{slot.roomName}</td>
                      <td className="py-3 px-4 text-slate-800 font-medium">{slot.teacherName}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteTimetableSlot(slot.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete slot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CLASSROOMS & LABS */}
      {activeTab === 'classrooms' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Campus Classrooms & Laboratories</h2>
              <p className="text-xs text-slate-500">
                Manage room capacities, wings, and allocation for lectures and practical sessions
              </p>
            </div>

            <button
              id="add-classroom-button"
              type="button"
              onClick={() => setShowAddRoomModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Classroom / Lab</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classrooms.map(room => (
              <div 
                key={room.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
                      <School className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{room.name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {room.building}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteClassroom(room.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 cursor-pointer"
                    title="Delete space"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-500 font-medium">Capacity:</span>
                  <span className="font-mono font-bold text-slate-800">{room.capacity} Students</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: CAMPUS & SYSTEM SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Campus Identity & System Configurations</h2>
              <p className="text-xs text-slate-500">
                Configure institution name, academic department, HOD passcode, and attendance thresholds
              </p>
            </div>

            {settingsSavedMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>System configurations successfully updated and synchronized to cloud!</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* College Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="settings-college-name" className="block text-xs font-bold text-slate-700">
                  College / Institution Name
                </label>
                <input
                  id="settings-college-name"
                  type="text"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 uppercase"
                  required
                />
              </div>

              {/* Department Name */}
              <div className="space-y-1.5">
                <label htmlFor="settings-dept-name" className="block text-xs font-bold text-slate-700">
                  Department Name
                </label>
                <input
                  id="settings-dept-name"
                  type="text"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              {/* HOD Full Name */}
              <div className="space-y-1.5">
                <label htmlFor="settings-hod-name" className="block text-xs font-bold text-slate-700">
                  HOD Full Name & Designation
                </label>
                <input
                  id="settings-hod-name"
                  type="text"
                  value={hodName}
                  onChange={(e) => setHodName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              {/* HOD Security Passcode */}
              <div className="space-y-1.5">
                <label htmlFor="settings-hod-passcode" className="block text-xs font-bold text-slate-700">
                  HOD Security Passcode
                </label>
                <input
                  id="settings-hod-passcode"
                  type="text"
                  value={hodPasscode}
                  onChange={(e) => setHodPasscode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              {/* Defaulter Threshold % */}
              <div className="space-y-1.5">
                <label htmlFor="settings-defaulter-threshold" className="block text-xs font-bold text-slate-700">
                  Default Defaulter Criteria (%)
                </label>
                <input
                  id="settings-defaulter-threshold"
                  type="number"
                  min={20}
                  max={90}
                  value={settings.defaulterThreshold}
                  onChange={(e) => onUpdateSettings({ ...settings, defaulterThreshold: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowResetSettingsModal(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Settings to Default</span>
              </button>

              <button
                id="save-campus-settings-button"
                type="submit"
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save & Sync Campus Configurations</span>
              </button>
            </div>
          </form>

          {/* Danger Zone Card */}
          <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm font-bold text-rose-950">Administrative Actions & Danger Zone</h3>
            </div>
            <p className="text-xs text-rose-800 leading-relaxed">
              These administrative operations allow HOD to wipe student records or restore the campus database back to fresh default states.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowResetSettingsModal(true)}
                className="flex flex-col items-start p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-left transition-all cursor-pointer shadow-2xs"
              >
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                  Reset Settings Only
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  Reverts college title and HOD passcode to default D.Y.PATIL settings.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteAllStudentsModal(true)}
                className="flex flex-col items-start p-3.5 rounded-xl bg-white border border-rose-200 hover:border-rose-300 text-left transition-all cursor-pointer shadow-2xs"
              >
                <span className="font-bold text-xs text-rose-700 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  Delete All Students
                </span>
                <span className="text-[11px] text-rose-600 mt-1">
                  Permanently clears student roster across divisions or campus.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowResetCampusModal(true)}
                className="flex flex-col items-start p-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-left transition-all cursor-pointer shadow-xs"
              >
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Entire Campus
                </span>
                <span className="text-[11px] text-rose-100 mt-1">
                  Wipes and restores default classes, timetable, and campus state.
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DATABASE & SUPABASE MIGRATION CENTER */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          
          {/* Active Database Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-5 sm:p-6 text-white border border-slate-700 shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Active Primary Provider
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Firestore Rules Deployed
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <span>Google Cloud Firebase Firestore</span>
                </h2>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  All campus attendance records, student rosters, timetable lectures, and institutional settings are securely synchronized in real-time across devices.
                </p>
              </div>

              {/* Force Sync Action */}
              <div className="flex items-center gap-2 shrink-0">
                {onForceSyncCloud && (
                  <button
                    type="button"
                    onClick={onForceSyncCloud}
                    disabled={isCloudSyncing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Cloud className={`w-4 h-4 ${isCloudSyncing ? 'animate-pulse' : ''}`} />
                    <span>{isCloudSyncing ? 'Synchronizing...' : 'Force Push to Cloud'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Connection Credentials Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-700/80">
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Firebase Project ID</span>
                <span className="text-xs font-mono font-bold text-emerald-300 truncate block">robotic-quanta-2mln4</span>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Named Firestore DB</span>
                <span className="text-xs font-mono font-bold text-sky-300 truncate block" title="ai-studio-dypatiltechnical-2db2d2f0-88f1-4cba-9c2f-dba9f6aab366">
                  ai-studio-dypatiltechnical...
                </span>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Current Scope</span>
                <span className="text-xs font-semibold text-amber-300 truncate block">
                  ECE - Div A (Single Division)
                </span>
              </div>
            </div>

            {dbService.isQuotaExhausted && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-300">Firebase Free Daily Write Limit Reached</div>
                  <p className="text-[11px] text-amber-200 leading-relaxed">
                    Google Cloud Firestore free-tier daily write quota has been reached. Offline-first local storage is actively preserving all attendance sessions, students, and settings in your browser with zero data loss. Cloud synchronization will resume once the daily quota resets, or you can migrate to Supabase below.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Academic Division Scope Notice */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                <School className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Current Academic Division</h3>
                <p className="text-xs text-slate-500">
                  Per configuration, the system is currently scoped to <strong className="text-slate-800 font-semibold">Electronics and Computer Engineering - Div A</strong>.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 shrink-0">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>{students.length} Students Enrolled</span>
            </div>
          </div>

          {/* Supabase Migration Studio */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase mb-1 border border-emerald-200">
                  <ArrowRightLeft className="w-3 h-3 text-emerald-600" />
                  Future Migration Ready
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Supabase PostgreSQL Migration Center
                </h3>
                <p className="text-xs text-slate-500">
                  Decoupled architecture: Switch seamlessly from Firebase to Supabase whenever you are ready
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const schema = dbService.getSupabaseSchema();
                    navigator.clipboard.writeText(schema);
                    setCopiedSchema(true);
                    setTimeout(() => setCopiedSchema(false), 3000);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSchema ? 'SQL Copied!' : 'Copy Supabase SQL'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const dump = {
                      timestamp: new Date().toISOString(),
                      settings,
                      classes,
                      students,
                      teachers,
                      classrooms,
                      timetable
                    };
                    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `DYPATIL_Campus_Backup_${new Date().toISOString().slice(0, 10)}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border border-slate-200 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Backup JSON</span>
                </button>
              </div>
            </div>

            {/* Migration Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center mb-1.5">
                  1
                </div>
                <h4 className="text-xs font-bold text-slate-900">Create Supabase Project</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Create a new project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-emerald-600 font-bold hover:underline">supabase.com</a> and get your Project URL & Anon Key.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center mb-1.5">
                  2
                </div>
                <h4 className="text-xs font-bold text-slate-900">Run SQL Schema</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Click <strong>Copy Supabase SQL</strong> above and run it in the Supabase SQL Editor to provision all tables & indexes.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center mb-1.5">
                  3
                </div>
                <h4 className="text-xs font-bold text-slate-900">Seamless Adapter Switch</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  The application uses <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">CampusDatabaseAdapter</code>. When configured, queries route automatically with 0 UI modifications.
                </p>
              </div>
            </div>

            {/* Schema Preview Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Code className="w-4 h-4 text-slate-500" />
                  Supabase PostgreSQL Table Schema (Ready to Execute)
                </span>
                <span className="text-[11px] text-slate-400">
                  Tables: settings, classes, students, teachers, classrooms, timetable, sessions
                </span>
              </div>
              <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56 overflow-y-auto border border-slate-800">
                {dbService.getSupabaseSchema()}
              </pre>
            </div>
          </div>

        </div>
      )}

      {/* MODAL 1: RESET CAMPUS SYSTEM CONFIRMATION (In-App Modal) */}
      {showResetCampusModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">Confirm Campus Database Reset</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetCampusModal(false)}
                className="text-rose-200 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                This will reset all campus data back to the default <strong className="text-slate-900">D.Y.PATIL TECHNICAL CAMPUS</strong> state:
              </p>

              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <li>Restores default classes & divisions (TE-A, TE-B, BE-A)</li>
                <li>Restores default student rosters & demo attendance</li>
                <li>Restores default faculty codes (TEACH101, etc.)</li>
                <li>Restores official weekly timetable & classrooms</li>
                <li>Restores default HOD passcode and institution settings</li>
              </ul>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetCampusModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetCampusModal(false);
                    onResetAllData();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
                >
                  Yes, Reset Everything
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET SETTINGS ONLY CONFIRMATION */}
      {showResetSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">Reset Campus Settings to Default</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetSettingsModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Reset institution name to <strong className="text-slate-900">D.Y.PATIL TECHNICAL CAMPUS</strong> and HOD passcode to default?
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetSettingsModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetSettingsModal(false);
                    onResetSettings();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                >
                  Confirm Reset Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE ALL STUDENTS CONFIRMATION */}
      {showDeleteAllStudentsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-200" />
                <h3 className="text-sm font-bold">Delete All Students</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteAllStudentsModal(false)}
                className="text-rose-200 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Choose the scope of student deletion below:
              </p>

              <div className="space-y-2">
                {selectedStudentClassId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteAllStudentsModal(false);
                      onDeleteAllStudents('current_class', selectedStudentClassId);
                    }}
                    className="w-full text-left p-3.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-all cursor-pointer"
                  >
                    <div className="font-bold text-xs text-rose-900">
                      Delete all in currently selected class ({classes.find(c => c.id === selectedStudentClassId)?.name})
                    </div>
                    <p className="text-[11px] text-rose-700 mt-0.5">
                      Clears student enrollment for this class only.
                    </p>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteAllStudentsModal(false);
                    onDeleteAllStudents('all_campus');
                  }}
                  className="w-full text-left p-3.5 rounded-xl border border-red-300 bg-red-100/50 hover:bg-red-100 transition-all cursor-pointer"
                >
                  <div className="font-bold text-xs text-red-950">
                    Delete All Students Across Entire Campus ({students.length} total)
                  </div>
                  <p className="text-[11px] text-red-800 mt-0.5">
                    Wipes all student rosters and enrollment records in all classes.
                  </p>
                </button>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteAllStudentsModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE INDIVIDUAL STUDENT CONFIRMATION */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-200" />
                <h3 className="text-sm font-bold">Delete Student Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="text-rose-200 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                Are you sure you want to permanently delete <strong className="text-slate-900">{studentToDelete.name}</strong> (Roll #{studentToDelete.rollNo}) from the campus records?
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStudentToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteStudent(studentToDelete.id);
                    setStudentToDelete(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ENROLL / EDIT STUDENT IN HOD SYSTEM */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">
                  {editingStudent ? 'Edit Student Details' : 'Enroll Student into Campus Database'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Roll Number *</label>
                  <input
                    type="text"
                    value={newStudentRoll}
                    onChange={(e) => setNewStudentRoll(e.target.value)}
                    placeholder="e.g. 01"
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Gender</label>
                  <select
                    value={newStudentGender}
                    onChange={(e) => setNewStudentGender(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Full Student Name *</label>
                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                  required
                />
              </div>

              {!editingStudent && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Assign to Class / Division</label>
                  <select
                    value={newStudentClassId}
                    onChange={(e) => setNewStudentClassId(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Parent Name</label>
                  <input
                    type="text"
                    value={newStudentParent}
                    onChange={(e) => setNewStudentParent(e.target.value)}
                    placeholder="e.g. Ramesh Sharma"
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Parent WhatsApp</label>
                  <input
                    type="tel"
                    value={newStudentPhone}
                    onChange={(e) => setNewStudentPhone(e.target.value)}
                    placeholder="+919876543210"
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
                >
                  {editingStudent ? 'Save Changes' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: ADD TEACHER */}
      {showAddTeacherModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">Add Teacher & Generate Unique Code</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTeacherModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNewTeacher} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Teacher Full Name</label>
                <input
                  type="text"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="e.g. Prof. Sandeep Kadam"
                  className="w-full border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Unique Login Code</label>
                  <input
                    type="text"
                    value={newTeacherCode}
                    onChange={(e) => setNewTeacherCode(e.target.value.toUpperCase())}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold uppercase text-emerald-800 bg-emerald-50"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Passcode</label>
                  <input
                    type="text"
                    value={newTeacherPasscode}
                    onChange={(e) => setNewTeacherPasscode(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-mono font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Respective Subjects (Comma separated)</label>
                <input
                  type="text"
                  value={newTeacherSubjects}
                  onChange={(e) => setNewTeacherSubjects(e.target.value)}
                  placeholder="e.g. Machine Learning, Cloud Computing"
                  className="w-full border border-slate-300 rounded-xl p-2 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={newTeacherEmail}
                    onChange={(e) => setNewTeacherEmail(e.target.value)}
                    placeholder="teacher@dypatil.edu"
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Mobile Phone</label>
                  <input
                    type="tel"
                    value={newTeacherPhone}
                    onChange={(e) => setNewTeacherPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTeacherModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  Create & Issue Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: ADD TIMETABLE SLOT */}
      {showAddSlotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold">Schedule Lecture Slot (Timetable)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSlotModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNewSlot} className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Day of Week</label>
                  <select
                    value={newSlotDay}
                    onChange={(e) => setNewSlotDay(e.target.value as DayOfWeek)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-bold"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Start Time</label>
                  <input
                    type="text"
                    value={newSlotStartTime}
                    onChange={(e) => setNewSlotStartTime(e.target.value)}
                    placeholder="08:00 AM"
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">End Time</label>
                  <input
                    type="text"
                    value={newSlotEndTime}
                    onChange={(e) => setNewSlotEndTime(e.target.value)}
                    placeholder="09:00 AM"
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Subject Name</label>
                <input
                  type="text"
                  value={newSlotSubject}
                  onChange={(e) => setNewSlotSubject(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  className="w-full border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Class / Division</label>
                  <select
                    value={newSlotClassId}
                    onChange={(e) => setNewSlotClassId(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Classroom / Lab</label>
                  <select
                    value={newSlotRoomId}
                    onChange={(e) => setNewSlotRoomId(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs"
                  >
                    {classrooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Assigned Faculty / Teacher</label>
                <select
                  value={newSlotTeacherId}
                  onChange={(e) => setNewSlotTeacherId(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                >
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.uniqueCode})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddSlotModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white cursor-pointer"
                >
                  Save into Timetable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: ADD CLASSROOM */}
      {showAddRoomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold">Add Campus Classroom / Lab</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRoomModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNewClassroom} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Room / Lab Name</label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. Room 405 (IoT Lab)"
                  className="w-full border border-slate-300 rounded-xl p-2 text-xs font-semibold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Building / Wing</label>
                <input
                  type="text"
                  value={newRoomBuilding}
                  onChange={(e) => setNewRoomBuilding(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Student Capacity</label>
                  <input
                    type="number"
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Room Type</label>
                  <select
                    value={newRoomType}
                    onChange={(e) => setNewRoomType(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs"
                  >
                    <option value="classroom">Classroom</option>
                    <option value="lab">Computer / Hardware Lab</option>
                    <option value="seminar_hall">Auditorium / Seminar</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  Add Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
