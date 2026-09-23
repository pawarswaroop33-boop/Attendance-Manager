import React, { useState } from 'react';
import { 
  UserPlus, 
  Trash2, 
  Edit, 
  Search, 
  Phone, 
  Check, 
  X,
  GraduationCap,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { ClassGroup, Student } from '../types';

interface StudentManagementProps {
  currentClass: ClassGroup;
  students: Student[];
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onUpdateStudent: (student: Student) => void;
  onRemoveStudentFromClass: (studentId: string) => void;
  onDeleteStudentPermanently?: (studentId: string) => void;
  onDeleteAllStudents?: (scope: 'current_class' | 'all_campus', targetClassId?: string) => void;
  onOpenImportModal?: () => void;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  currentClass,
  students,
  onAddStudent,
  onUpdateStudent,
  onRemoveStudentFromClass,
  onDeleteStudentPermanently,
  onDeleteAllStudents,
  onOpenImportModal
}) => {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // In-App Modal confirmation states (replacing window.confirm)
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'Other'>('M');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [email, setEmail] = useState('');

  const classStudents = students.filter(s => currentClass.studentIds.includes(s.id));

  const filteredStudents = classStudents.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.rollNo.includes(q) || s.parentName?.toLowerCase().includes(q);
  });

  const resetForm = () => {
    setName('');
    setRollNo('');
    setGender('M');
    setParentName('');
    setParentPhone('');
    setEmail('');
    setIsAdding(false);
    setEditingStudentId(null);
  };

  const handleStartAdd = () => {
    resetForm();
    const maxRoll = classStudents.reduce((max, s) => {
      const num = parseInt(s.rollNo, 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    setRollNo(String(maxRoll + 1).padStart(2, '0'));
    setIsAdding(true);
  };

  const handleStartEdit = (student: Student) => {
    setEditingStudentId(student.id);
    setName(student.name);
    setRollNo(student.rollNo);
    setGender(student.gender);
    setParentName(student.parentName || '');
    setParentPhone(student.parentPhone || '');
    setEmail(student.email || '');
    setIsAdding(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rollNo.trim()) return;

    if (editingStudentId) {
      const existing = students.find(s => s.id === editingStudentId);
      if (existing) {
        const updated: Student = {
          ...existing,
          name: name.trim(),
          rollNo: rollNo.trim(),
          gender
        };
        if (parentName.trim()) updated.parentName = parentName.trim();
        else delete (updated as any).parentName;
        if (parentPhone.trim()) updated.parentPhone = parentPhone.trim();
        else delete (updated as any).parentPhone;
        if (email.trim()) updated.email = email.trim();
        else delete (updated as any).email;
        onUpdateStudent(updated);
      }
    } else {
      const newSt: Omit<Student, 'id'> = {
        name: name.trim(),
        rollNo: rollNo.trim(),
        gender,
        avatarBg: 'bg-slate-800'
      };
      if (parentName.trim()) newSt.parentName = parentName.trim();
      if (parentPhone.trim()) newSt.parentPhone = parentPhone.trim();
      if (email.trim()) newSt.email = email.trim();
      onAddStudent(newSt);
    }

    resetForm();
  };

  const handleConfirmSingleDelete = (permanent: boolean) => {
    if (!studentToDelete) return;
    if (permanent && onDeleteStudentPermanently) {
      onDeleteStudentPermanently(studentToDelete.id);
    } else {
      onRemoveStudentFromClass(studentToDelete.id);
    }
    setStudentToDelete(null);
  };

  const handleConfirmDeleteAll = (scope: 'current_class' | 'all_campus') => {
    if (onDeleteAllStudents) {
      onDeleteAllStudents(scope, currentClass.id);
    } else {
      // Fallback: remove all class students
      classStudents.forEach(st => onRemoveStudentFromClass(st.id));
    }
    setShowDeleteAllModal(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              Class Roster & Student Directory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
              {currentClass.name}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Managing {classStudents.length} enrolled students. Add, edit profiles, or import via Excel/PDF.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          {onOpenImportModal && (
            <button
              id="import-modal-trigger-btn"
              type="button"
              onClick={onOpenImportModal}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs transition-all shadow-xs cursor-pointer min-h-[40px]"
              title="Import student roll list from Excel / PDF"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Scan List</span>
            </button>
          )}

          <button
            id="add-student-button"
            type="button"
            onClick={handleStartAdd}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-xs cursor-pointer min-h-[40px]"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>

          {/* Delete All Students Button */}
          {classStudents.length > 0 && (
            <button
              id="delete-all-students-btn"
              type="button"
              onClick={() => setShowDeleteAllModal(true)}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs transition-all shadow-xs cursor-pointer min-h-[40px]"
              title="Delete all students from roster"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Clear Roster</span>
            </button>
          )}
        </div>
      </div>

      {/* Add / Edit Form Card */}
      {(isAdding || editingStudentId) && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300 shadow-sm transition-all animate-fadeIn">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-amber-500" />
              <span>{editingStudentId ? 'Edit Student Profile' : 'Enroll New Student'}</span>
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Roll Number *
                </label>
                <input
                  type="text"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="e.g. 01"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div className="space-y-1 sm:col-span-1 lg:col-span-2">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Full Student Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Gender
                </label>
                <div className="flex items-center gap-2 pt-1">
                  {(['M', 'F', 'Other'] as const).map(g => (
                    <label key={g} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value={g}
                        checked={gender === g}
                        onChange={() => setGender(g)}
                        className="text-slate-900 focus:ring-slate-900"
                      />
                      <span>{g === 'M' ? 'Male' : g === 'F' ? 'Female' : 'Other'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Parent / Guardian Name
                </label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Parent WhatsApp Contact
                </label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Student Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@dypatil.edu"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={resetForm}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingStudentId ? 'Save Changes' : 'Enroll Student'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, roll number, or parent contact..."
            className="w-full pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-slate-900"
          />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-slate-400 hover:text-slate-600 text-xs font-semibold px-2 py-1 cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Students Table / Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Mobile Cards (Hidden on sm screens) */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No students found. Use "Add Student" or "Scan Excel / PDF" to enroll students.
            </div>
          ) : (
            filteredStudents.map(student => (
              <div key={student.id} className="p-3.5 space-y-2 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                      #{student.rollNo}
                    </span>
                    <span className="font-bold text-xs text-slate-900">{student.name}</span>
                    <span className="text-[10px] text-slate-500 font-medium">({student.gender})</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(student)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit student"
                    >
                      <Edit className="w-3.5 h-3.5" />
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
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 gap-2 flex-wrap">
                  <span className="truncate">
                    Parent: {student.parentName || '—'}
                  </span>
                  {student.parentPhone ? (
                    <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px] shrink-0">
                      <Phone className="w-3 h-3 text-[#25D366]" />
                      {student.parentPhone}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">No phone</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Roll Number</th>
                <th className="py-3.5 px-4">Student Name</th>
                <th className="py-3.5 px-4">Gender</th>
                <th className="py-3.5 px-4">Parent / Guardian</th>
                <th className="py-3.5 px-4">Parent WhatsApp</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 font-medium">
                    No students found in this roster. Click "Add Student" or "Scan Excel / PDF" to get started.
                  </td>
                </tr>
              ) : (
                filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">#{student.rollNo}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                          {student.name.slice(0, 1)}
                        </div>
                        <span className="font-bold text-slate-900">{student.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{student.gender}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{student.parentName || '—'}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {student.parentPhone ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                          <Phone className="w-3 h-3 text-[#25D366]" />
                          {student.parentPhone}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(student)}
                          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="Edit student"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStudentToDelete(student)}
                          className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Delete student"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CONFIRM SINGLE STUDENT DELETION (In-App Modal, No window.confirm) */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-200" />
                <h3 className="text-sm font-bold">Delete Student from Roster</h3>
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
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to delete <strong className="text-slate-900">{studentToDelete.name}</strong> (Roll #{studentToDelete.rollNo})?
              </p>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Class:</span>
                  <span className="font-bold text-slate-800">{currentClass.name}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Parent:</span>
                  <span className="font-semibold text-slate-700">{studentToDelete.parentName || 'N/A'}</span>
                </div>
                {studentToDelete.parentPhone && (
                  <div className="flex justify-between text-slate-500">
                    <span>Contact:</span>
                    <span className="font-mono text-slate-700">{studentToDelete.parentPhone}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStudentToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmSingleDelete(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer"
                >
                  Remove from this Class
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmSingleDelete(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
                >
                  Delete Permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM DELETE ALL STUDENTS (In-App Modal, No window.confirm) */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-4 bg-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <h3 className="text-sm font-bold">Delete All Students</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="text-rose-200 hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <p className="font-bold">⚠️ Warning: Bulk Deletion</p>
                <p>
                  This action will remove students and their linked attendance marks. Choose the deletion scope below:
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleConfirmDeleteAll('current_class')}
                  className="w-full text-left p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/80 transition-all cursor-pointer group"
                >
                  <div className="font-bold text-xs text-rose-900 flex items-center justify-between">
                    <span>Delete All from "{currentClass.name}"</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-rose-200 text-rose-800">
                      {classStudents.length} students
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-700 mt-1">
                    Clears the roster only for {currentClass.name}. Other classes remain untouched.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmDeleteAll('all_campus')}
                  className="w-full text-left p-3.5 rounded-xl border border-red-300 bg-red-100/40 hover:bg-red-100/80 transition-all cursor-pointer group"
                >
                  <div className="font-bold text-xs text-red-950 flex items-center justify-between">
                    <span>Delete All Students Across Entire Campus</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-red-600 text-white font-extrabold">
                      {students.length} total
                    </span>
                  </div>
                  <p className="text-[11px] text-red-800 mt-1">
                    Completely resets the student database for all divisions and classes to zero.
                  </p>
                </button>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteAllModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
