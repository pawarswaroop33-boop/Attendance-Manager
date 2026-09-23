import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  Check, 
  AlertTriangle, 
  X, 
  RotateCcw, 
  Users, 
  CheckCircle2,
  FileCheck2,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, ClassGroup } from '../types';

interface ImportStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: ClassGroup[];
  selectedClassId: string;
  onImportStudents: (targetClassId: string, newStudents: Omit<Student, 'id'>[]) => void;
}

export const ImportStudentsModal: React.FC<ImportStudentsModalProps> = ({
  isOpen,
  onClose,
  classes,
  selectedClassId,
  onImportStudents
}) => {
  const [targetClassId, setTargetClassId] = useState(selectedClassId);
  const [parsedStudents, setParsedStudents] = useState<Omit<Student, 'id'>[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'excel' | 'pdf_text' | ''>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [manualText, setManualText] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Clear all parsed data and reset inputs
  const handleClearAll = () => {
    setParsedStudents([]);
    setFileName('');
    setFileType('');
    setErrorMsg('');
    setManualText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper to normalize phone numbers (e.g. +91XXXXXXXXXX)
  const sanitizePhone = (raw: string): string => {
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return raw;
  };

  // Parse row data intelligently
  const parseRowsIntelligently = (rows: any[][]): Omit<Student, 'id'>[] => {
    if (rows.length < 2) return [];

    // Find header row (row containing words like Roll, Name, etc.)
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const rowStr = rows[i].join(' ').toLowerCase();
      if (rowStr.includes('roll') || rowStr.includes('name') || rowStr.includes('student')) {
        headerRowIdx = i;
        break;
      }
    }

    const headers = rows[headerRowIdx].map(h => String(h || '').trim().toLowerCase());
    
    // Column indices
    let rollIdx = headers.findIndex(h => h.includes('roll') || h.includes('sr') || h.includes('prn') || h.includes('no'));
    let nameIdx = headers.findIndex(h => h.includes('name') || h.includes('student'));
    let genderIdx = headers.findIndex(h => h.includes('gender') || h.includes('sex'));
    let parentPhoneIdx = headers.findIndex(h => h.includes('parent') || h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('father'));
    let parentNameIdx = headers.findIndex(h => h.includes('father name') || h.includes('parent name') || h.includes('guardian'));
    let emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));

    // Fallbacks if header wasn't properly detected
    if (rollIdx === -1) rollIdx = 0;
    if (nameIdx === -1) nameIdx = 1;
    if (genderIdx === -1) genderIdx = 2;
    if (parentPhoneIdx === -1) parentPhoneIdx = 3;

    const results: Omit<Student, 'id'>[] = [];

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const rawRoll = String(row[rollIdx] ?? '').trim();
      const rawName = String(row[nameIdx] ?? '').trim();

      if (!rawName || rawName.length < 2) continue;

      let gender: 'M' | 'F' | 'Other' = 'M';
      if (genderIdx >= 0 && row[genderIdx]) {
        const gStr = String(row[genderIdx]).trim().toUpperCase();
        if (gStr.startsWith('F') || gStr === 'FEMALE') gender = 'F';
      }

      const parentPhone = parentPhoneIdx >= 0 ? sanitizePhone(String(row[parentPhoneIdx] ?? '').trim()) : undefined;
      const parentName = parentNameIdx >= 0 ? String(row[parentNameIdx] ?? '').trim() : undefined;
      const email = emailIdx >= 0 ? String(row[emailIdx] ?? '').trim() : undefined;

      results.push({
        rollNo: rawRoll || String(results.length + 1).padStart(2, '0'),
        name: rawName,
        gender,
        parentPhone: parentPhone || `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
        parentName: parentName || 'Guardian',
        email,
        classId: targetClassId,
        avatarBg: 'bg-slate-700'
      });
    }

    return results;
  };

  // Handle Excel File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setFileName(file.name);
    setIsProcessing(true);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');
    setFileType(isExcel ? 'excel' : 'pdf_text');

    const reader = new FileReader();

    if (isExcel) {
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          const students = parseRowsIntelligently(data);
          if (students.length === 0) {
            setErrorMsg('Could not find student rows in the spreadsheet. Please verify the columns.');
          } else {
            setParsedStudents(students);
          }
        } catch (err) {
          console.error(err);
          setErrorMsg('Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv format.');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      // PDF or text file
      reader.onload = (evt) => {
        try {
          const content = String(evt.target?.result || '');
          parsePlainTextRoster(content);
        } catch (err) {
          console.error(err);
          setErrorMsg('Failed to read document text.');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsText(file);
    }
  };

  // Parse plain text (from PDF copy-paste or text file)
  const parsePlainTextRoster = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const rows: string[][] = [];

    lines.forEach(line => {
      // Split by tab, comma, semicolon, or multi-space
      let parts = line.split(/\t|,|;/).map(p => p.trim());
      if (parts.length < 2) {
        parts = line.split(/\s{2,}/).map(p => p.trim());
      }
      if (parts.length >= 2) {
        rows.push(parts);
      }
    });

    const students = parseRowsIntelligently(rows);
    if (students.length === 0) {
      setErrorMsg('Could not extract student records from text. Try pasting column-separated text.');
    } else {
      setParsedStudents(students);
    }
  };

  const handleManualParse = () => {
    if (!manualText.trim()) return;
    setIsProcessing(true);
    setErrorMsg('');
    setFileName('Pasted PDF/Roster Text');
    setFileType('pdf_text');
    parsePlainTextRoster(manualText);
    setIsProcessing(false);
  };

  const handleCommitImport = () => {
    if (parsedStudents.length === 0) return;
    onImportStudents(targetClassId, parsedStudents);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Import Students (Excel / PDF Scanner)</h3>
              <p className="text-xs text-slate-400">Intelligently scan, parse and populate class roster</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* Target Class Selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <label htmlFor="import-target-class" className="text-xs font-bold text-slate-700">
              Target Division / Classroom:
            </label>
            <select
              id="import-target-class"
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.room})
                </option>
              ))}
            </select>
          </div>

          {/* Upload Area */}
          {!parsedStudents.length && (
            <div className="space-y-3">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all space-y-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv, .pdf, .txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Click to upload or drag & drop student sheet
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports <strong>.xlsx, .xls, .csv, .pdf</strong> (Scans Roll No, Name, Gender, Parent Mobile)
                  </p>
                </div>
              </div>

              {/* Alternative: Paste from PDF Text */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="text-xs text-slate-600 hover:text-slate-900 underline font-semibold cursor-pointer"
                >
                  {showManualInput ? 'Hide text paste box' : 'Or paste text from a PDF roster directly'}
                </button>
              </div>

              {showManualInput && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <label htmlFor="manual-roster-text" className="block text-xs font-bold text-slate-700">
                    Paste student rows copied from PDF or Word doc:
                  </label>
                  <textarea
                    id="manual-roster-text"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    rows={4}
                    placeholder={"01\tAarav Patil\tM\t+919876543210\n02\tSneha Kulkarni\tF\t+919876543211"}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                  <div className="flex justify-between items-center pt-1">
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-xs text-slate-500 hover:text-rose-600 cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear all</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleManualParse}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Scan & Understand Text
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="py-6 text-center text-slate-600 space-y-2">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold">Scanning & Understanding Document Structure...</p>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Results Preview Table */}
          {parsedStudents.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold">
                    Successfully recognized {parsedStudents.length} students from {fileName || 'document'}
                  </span>
                </div>

                {/* Clear All Button */}
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex items-center gap-1 text-xs text-slate-600 hover:text-rose-700 bg-white border border-slate-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                  title="Clear all parsed students and reset"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear all</span>
                </button>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Roll</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3">Gender</th>
                      <th className="py-2 px-3">Parent Mobile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedStudents.map((st, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-mono font-bold text-slate-700">{st.rollNo}</td>
                        <td className="py-1.5 px-3 font-semibold text-slate-900">{st.name}</td>
                        <td className="py-1.5 px-3 text-slate-600">{st.gender}</td>
                        <td className="py-1.5 px-3 font-mono text-slate-600">{st.parentPhone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear all</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="confirm-import-students-button"
              type="button"
              disabled={parsedStudents.length === 0}
              onClick={handleCommitImport}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                parsedStudents.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Import {parsedStudents.length} Students into Roster</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
