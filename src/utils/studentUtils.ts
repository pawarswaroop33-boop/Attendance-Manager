import { Student } from '../types';
import { getStudentBatch } from './batchUtils';

/**
 * Deduplicate students across the entire system.
 * Guarantees that roll numbers (e.g. 1, 01, 2, 02... 86) are strictly unique,
 * properly formatted, and sorted in ascending numerical order.
 */
export function deduplicateStudents(rawStudents: Student[]): Student[] {
  if (!Array.isArray(rawStudents) || rawStudents.length === 0) return [];

  const rollMap = new Map<number | string, Student>();
  const idSet = new Set<string>();

  rawStudents.forEach((st) => {
    if (!st || !st.name) return;

    // Parse numerical roll number if possible (e.g. "01", "1", "#1", "Roll 01" -> 1)
    const numRoll = parseInt(String(st.rollNo || '').replace(/\D/g, ''), 10);
    const key = !isNaN(numRoll) && numRoll > 0 ? numRoll : String(st.rollNo || '').trim().toLowerCase();

    const existing = rollMap.get(key);
    if (!existing) {
      const formattedRoll = !isNaN(numRoll) && numRoll > 0 
        ? String(numRoll).padStart(2, '0') 
        : String(st.rollNo || '').trim();

      // Guarantee unique ID if duplicate ID exists
      let validId = st.id;
      if (idSet.has(validId)) {
        validId = `std-uniq-${numRoll || Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      }
      idSet.add(validId);

      const cleanStudent: Student = {
        ...st,
        id: validId,
        rollNo: formattedRoll,
        batch: getStudentBatch({ ...st, rollNo: formattedRoll }, rawStudents)
      };
      rollMap.set(key, cleanStudent);
    } else {
      // Merge details if the duplicate entry has fuller information
      if ((!existing.parentPhone || existing.parentPhone === '—') && st.parentPhone && st.parentPhone !== '—') {
        existing.parentPhone = st.parentPhone;
      }
      if ((!existing.parentName || existing.parentName === 'Guardian' || existing.parentName === 'Parent') && st.parentName) {
        existing.parentName = st.parentName;
      }
      if (!existing.email && st.email) {
        existing.email = st.email;
      }
      if (st.name && st.name.trim().length > (existing.name || '').trim().length) {
        existing.name = st.name.trim();
      }
      if (st.gender && (!existing.gender || existing.gender === 'Other')) {
        existing.gender = st.gender;
      }
    }
  });

  const uniqueList = Array.from(rollMap.values());
  return uniqueList.sort((a, b) => {
    const numA = parseInt(a.rollNo.replace(/\D/g, ''), 10);
    const numB = parseInt(b.rollNo.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true });
  });
}
