import { ClassGroup, Student, AttendanceSession, Teacher, Classroom, TimetableSlot, SystemSettings } from '../types';

export const INITIAL_SETTINGS: SystemSettings = {
  collegeName: 'D.Y.PATIL TECHNCIAL CAMPUS',
  departmentName: 'Department Of Electronics And Computer Engineering',
  hodName: 'Prof. Prashant Kathole',
  hodUsername: 'dyp',
  hodPasscode: 'dyp123',
  defaulterThreshold: 50, // Criteria set to 50% by default
  cloudSyncStatus: 'synced',
  lastCloudSyncTimestamp: new Date().toISOString(),
  autoCloudSync: true
};

export const INITIAL_CLASSROOMS: Classroom[] = [
  { id: 'room-301', name: 'Room 301 (Lecture Hall)', building: 'Engineering Wing A', capacity: 75, type: 'classroom' },
  { id: 'room-302', name: 'Room 302 (Smart Classroom)', building: 'Engineering Wing A', capacity: 75, type: 'classroom' },
  { id: 'lab-1', name: 'Embedded Systems & IoT Lab', building: 'Electronics Complex', capacity: 45, type: 'lab' },
  { id: 'lab-2', name: 'VLSI & Digital Signal Processing Lab', building: 'Electronics Complex', capacity: 45, type: 'lab' },
  { id: 'seminar-1', name: 'Dr. D.Y. Patil Auditorium', building: 'Central Block', capacity: 200, type: 'seminar_hall' }
];

export const INITIAL_STUDENTS: Student[] = [
  { id: 'std-1', rollNo: '01', name: 'Aarav Sharma', gender: 'M', parentName: 'Sunil Sharma', parentPhone: '+919876543210', avatarBg: 'bg-slate-700', classId: 'class-ece-a', remarks: 'Good academic performance' },
  { id: 'std-2', rollNo: '02', name: 'Ananya Deshmukh', gender: 'F', parentName: 'Kiran Deshmukh', parentPhone: '+919876543211', avatarBg: 'bg-slate-700', classId: 'class-ece-a', remarks: 'Consistent attendee' },
  { id: 'std-3', rollNo: '03', name: 'Devendra Patil', gender: 'M', parentName: 'Ashok Patil', parentPhone: '+919876543212', avatarBg: 'bg-slate-700', classId: 'class-ece-a', remarks: 'Active in class activities' },
  { id: 'std-4', rollNo: '04', name: 'Ishita Kapoor', gender: 'F', parentName: 'Rajeev Kapoor', parentPhone: '+919876543213', avatarBg: 'bg-slate-700', classId: 'class-ece-a', remarks: 'Class Representative' },
  { id: 'std-5', rollNo: '05', name: 'Kabir Verma', gender: 'M', parentName: 'Manoj Verma', parentPhone: '+919876543214', avatarBg: 'bg-slate-700', classId: 'class-ece-a', remarks: 'Chronic absenteeism reported' },
  { id: 'std-6', rollNo: '06', name: 'Meera Iyer', gender: 'F', parentName: 'Venkat Iyer', parentPhone: '+919876543215', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-7', rollNo: '07', name: 'Mohit Rao', gender: 'M', parentName: 'Girish Rao', parentPhone: '+919876543216', avatarBg: 'bg-slate-700', classId: 'class-ece-a', remarks: 'Frequently arriving late' },
  { id: 'std-8', rollNo: '08', name: 'Neha Singhania', gender: 'F', parentName: 'Amit Singhania', parentPhone: '+919876543217', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-9', rollNo: '09', name: 'Pranav Joshi', gender: 'M', parentName: 'Sanjay Joshi', parentPhone: '+919876543218', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-10', rollNo: '10', name: 'Riya Kulkarni', gender: 'F', parentName: 'Prasad Kulkarni', parentPhone: '+919876543219', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-11', rollNo: '11', name: 'Rohan Mehta', gender: 'M', parentName: 'Harish Mehta', parentPhone: '+919876543220', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-12', rollNo: '12', name: 'Saanvi Chawla', gender: 'F', parentName: 'Rohit Chawla', parentPhone: '+919876543221', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-13', rollNo: '13', name: 'Samar Malhotra', gender: 'M', parentName: 'Vikram Malhotra', parentPhone: '+919876543222', avatarBg: 'bg-slate-700', classId: 'class-ece-a', remarks: 'Attendance below target' },
  { id: 'std-14', rollNo: '14', name: 'Shruti Nair', gender: 'F', parentName: 'Narayanan Nair', parentPhone: '+919876543223', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-15', rollNo: '15', name: 'Siddharth Sen', gender: 'M', parentName: 'Anupam Sen', parentPhone: '+919876543224', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-16', rollNo: '16', name: 'Tanvi Shinde', gender: 'F', parentName: 'Vikas Shinde', parentPhone: '+919876543225', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-17', rollNo: '17', name: 'Utkarsh Trivedi', gender: 'M', parentName: 'Mukesh Trivedi', parentPhone: '+919876543226', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-18', rollNo: '18', name: 'Vanshika Goel', gender: 'F', parentName: 'Deepak Goel', parentPhone: '+919876543227', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-19', rollNo: '19', name: 'Varun Reddy', gender: 'M', parentName: 'Prakash Reddy', parentPhone: '+919876543228', avatarBg: 'bg-slate-700', classId: 'class-ece-a' },
  { id: 'std-20', rollNo: '20', name: 'Zoya Khan', gender: 'F', parentName: 'Farhan Khan', parentPhone: '+919876543229', avatarBg: 'bg-slate-700', classId: 'class-ece-a' }
];

// Single class as requested by the user: "Electronics and Computer Engineering - Div A"
export const INITIAL_CLASSES: ClassGroup[] = [
  {
    id: 'class-ece-a',
    name: 'Electronics and Computer Engineering - Div A',
    grade: 'SE (2nd Year)',
    section: 'A',
    subject: 'Microcontrollers & Embedded Systems',
    room: 'Room 302',
    teacherName: 'Prof. Anjali Sharma',
    studentIds: INITIAL_STUDENTS.map(s => s.id)
  }
];

export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: 'teach-1',
    uniqueCode: 'TEACH101',
    passcode: 'teach123',
    name: 'Prof. Anjali Sharma',
    email: 'anjali.sharma@dypatil.edu',
    phone: '+919822011223',
    department: 'Electronics and Computer Engineering',
    subjects: ['Microcontrollers & Embedded Systems', 'IoT & Sensor Networks'],
    assignedClasses: ['class-ece-a']
  },
  {
    id: 'teach-2',
    uniqueCode: 'TEACH102',
    passcode: 'teach123',
    name: 'Prof. Rajesh Kulkarni',
    email: 'rajesh.kulkarni@dypatil.edu',
    phone: '+919822011224',
    department: 'Electronics and Computer Engineering',
    subjects: ['Digital Signal Processing', 'Computer Architecture'],
    assignedClasses: ['class-ece-a']
  },
  {
    id: 'teach-3',
    uniqueCode: 'TEACH103',
    passcode: 'teach123',
    name: 'Prof. Devendra Patil',
    email: 'devendra.patil@dypatil.edu',
    phone: '+919822011225',
    department: 'Electronics and Computer Engineering',
    subjects: ['Electronic Devices & Circuits', 'VLSI Design'],
    assignedClasses: ['class-ece-a']
  },
  {
    id: 'teach-4',
    uniqueCode: 'TEACH104',
    passcode: 'teach123',
    name: 'Prof. Pooja Mane',
    email: 'pooja.mane@dypatil.edu',
    phone: '+919822011226',
    department: 'Electronics and Computer Engineering',
    subjects: ['Data Structures & Algorithms', 'Embedded C Programming'],
    assignedClasses: ['class-ece-a']
  }
];

export const INITIAL_TIMETABLE: TimetableSlot[] = [
  // Monday
  {
    id: 'slot-mon-1',
    dayOfWeek: 'Monday',
    startTime: '08:00 AM',
    endTime: '09:00 AM',
    timeSlotLabel: '08:00 AM - 09:00 AM',
    subject: 'Microcontrollers & Embedded Systems',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-1',
    teacherName: 'Prof. Anjali Sharma',
    roomId: 'room-302',
    roomName: 'Room 302'
  },
  {
    id: 'slot-mon-2',
    dayOfWeek: 'Monday',
    startTime: '09:00 AM',
    endTime: '10:00 AM',
    timeSlotLabel: '09:00 AM - 10:00 AM',
    subject: 'Digital Signal Processing',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-2',
    teacherName: 'Prof. Rajesh Kulkarni',
    roomId: 'room-301',
    roomName: 'Room 301'
  },
  {
    id: 'slot-mon-3',
    dayOfWeek: 'Monday',
    startTime: '10:15 AM',
    endTime: '11:15 AM',
    timeSlotLabel: '10:15 AM - 11:15 AM',
    subject: 'Electronic Devices & Circuits',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-3',
    teacherName: 'Prof. Devendra Patil',
    roomId: 'lab-1',
    roomName: 'Embedded Systems Lab'
  },
  {
    id: 'slot-mon-4',
    dayOfWeek: 'Monday',
    startTime: '11:15 AM',
    endTime: '12:15 PM',
    timeSlotLabel: '11:15 AM - 12:15 PM',
    subject: 'Embedded C Programming',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-4',
    teacherName: 'Prof. Pooja Mane',
    roomId: 'room-302',
    roomName: 'Room 302'
  },

  // Tuesday
  {
    id: 'slot-tue-1',
    dayOfWeek: 'Tuesday',
    startTime: '08:00 AM',
    endTime: '09:00 AM',
    timeSlotLabel: '08:00 AM - 09:00 AM',
    subject: 'Microcontrollers & Embedded Systems',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-1',
    teacherName: 'Prof. Anjali Sharma',
    roomId: 'room-302',
    roomName: 'Room 302'
  },
  {
    id: 'slot-tue-2',
    dayOfWeek: 'Tuesday',
    startTime: '09:00 AM',
    endTime: '10:00 AM',
    timeSlotLabel: '09:00 AM - 10:00 AM',
    subject: 'IoT & Sensor Networks',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-1',
    teacherName: 'Prof. Anjali Sharma',
    roomId: 'lab-1',
    roomName: 'Embedded Systems Lab'
  },
  {
    id: 'slot-tue-3',
    dayOfWeek: 'Tuesday',
    startTime: '10:15 AM',
    endTime: '11:15 AM',
    timeSlotLabel: '10:15 AM - 11:15 AM',
    subject: 'VLSI Design',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-3',
    teacherName: 'Prof. Devendra Patil',
    roomId: 'lab-2',
    roomName: 'VLSI Lab'
  },

  // Wednesday
  {
    id: 'slot-wed-1',
    dayOfWeek: 'Wednesday',
    startTime: '08:00 AM',
    endTime: '09:00 AM',
    timeSlotLabel: '08:00 AM - 09:00 AM',
    subject: 'Computer Architecture',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-2',
    teacherName: 'Prof. Rajesh Kulkarni',
    roomId: 'room-301',
    roomName: 'Room 301'
  },
  {
    id: 'slot-wed-2',
    dayOfWeek: 'Wednesday',
    startTime: '09:00 AM',
    endTime: '10:00 AM',
    timeSlotLabel: '09:00 AM - 10:00 AM',
    subject: 'Microcontrollers & Embedded Systems',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-1',
    teacherName: 'Prof. Anjali Sharma',
    roomId: 'room-302',
    roomName: 'Room 302'
  },

  // Thursday
  {
    id: 'slot-thu-1',
    dayOfWeek: 'Thursday',
    startTime: '08:00 AM',
    endTime: '09:00 AM',
    timeSlotLabel: '08:00 AM - 09:00 AM',
    subject: 'Digital Signal Processing',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-2',
    teacherName: 'Prof. Rajesh Kulkarni',
    roomId: 'room-301',
    roomName: 'Room 301'
  },
  {
    id: 'slot-thu-2',
    dayOfWeek: 'Thursday',
    startTime: '09:00 AM',
    endTime: '10:00 AM',
    timeSlotLabel: '09:00 AM - 10:00 AM',
    subject: 'Electronic Devices & Circuits',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-3',
    teacherName: 'Prof. Devendra Patil',
    roomId: 'lab-1',
    roomName: 'Embedded Systems Lab'
  },

  // Friday
  {
    id: 'slot-fri-1',
    dayOfWeek: 'Friday',
    startTime: '08:00 AM',
    endTime: '09:00 AM',
    timeSlotLabel: '08:00 AM - 09:00 AM',
    subject: 'IoT & Sensor Networks',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-1',
    teacherName: 'Prof. Anjali Sharma',
    roomId: 'lab-1',
    roomName: 'Embedded Systems Lab'
  },
  {
    id: 'slot-fri-2',
    dayOfWeek: 'Friday',
    startTime: '09:00 AM',
    endTime: '10:00 AM',
    timeSlotLabel: '09:00 AM - 10:00 AM',
    subject: 'Embedded C Programming',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-4',
    teacherName: 'Prof. Pooja Mane',
    roomId: 'room-302',
    roomName: 'Room 302'
  },

  // Saturday
  {
    id: 'slot-sat-1',
    dayOfWeek: 'Saturday',
    startTime: '08:30 AM',
    endTime: '10:30 AM',
    timeSlotLabel: '08:30 AM - 10:30 AM',
    subject: 'Practical: Embedded Systems Hardware Testing',
    classId: 'class-ece-a',
    className: 'Electronics and Computer Engineering - Div A',
    teacherId: 'teach-1',
    teacherName: 'Prof. Anjali Sharma',
    roomId: 'lab-1',
    roomName: 'Embedded Systems Lab'
  }
];

export function generateInitialSessions(classes: ClassGroup[], students: Student[]): AttendanceSession[] {
  const sessions: AttendanceSession[] = [];
  const today = new Date();

  // Generate calendar dates for past 12 days (excluding today and future, so today is fresh for attendance)
  const dates: string[] = [];
  for (let i = 12; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  classes.forEach(cls => {
    const classStudents = students.filter(st => cls.studentIds.includes(st.id));

    dates.forEach((date, dateIdx) => {
      const [y, m, d] = date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayOfWeek = daysOfWeek[dateObj.getDay()] || 'Monday';

      // Find slots scheduled for this day of week - skip days with no scheduled lectures (e.g. Sunday)
      const scheduledSlots = INITIAL_TIMETABLE.filter(s => s.dayOfWeek === dayOfWeek && s.classId === cls.id);
      if (scheduledSlots.length === 0) {
        return;
      }
      const slotsToGenerate = scheduledSlots;

      slotsToGenerate.forEach((slot, slotIdx) => {
        const records: Record<string, { studentId: string; status: 'present' | 'absent' | 'late' | 'excused'; timestamp: string; note?: string }> = {};

        classStudents.forEach(st => {
          let status: 'present' | 'absent' | 'late' | 'excused' = 'present';
          let note: string | undefined = undefined;

          // Compute deterministic attendance per student and slot
          const seed = dateIdx * 17 + slotIdx * 31 + parseInt(st.rollNo, 10);

          if (st.id === 'std-5') {
            // Kabir Verma - attendance below 50%
            const hash = seed % 10;
            if (hash < 6) {
              status = 'absent';
              note = 'Uninformed absent';
            }
          } else if (st.id === 'std-13') {
            // Samar Malhotra - attendance below 50%
            const hash = seed % 10;
            if (hash < 5) {
              status = 'absent';
              note = 'Parent notified';
            }
          } else if (st.id === 'std-7') {
            // Mohit Rao - arrives late or absent (~60% attendance)
            const hash = seed % 10;
            if (hash === 2) {
              status = 'late';
              note = 'Bus delayed';
            } else if (hash === 6 || hash === 7) {
              status = 'absent';
            }
          } else {
            // Regular students (~94% presence)
            const hash = seed % 25;
            if (hash === 0) {
              status = 'absent';
              note = 'Medical leave';
            } else if (hash === 1) {
              status = 'late';
              note = 'Arrived 10m late';
            }
          }

          records[st.id] = {
            studentId: st.id,
            status,
            timestamp: new Date().toISOString(),
            ...(note ? { note } : {})
          };
        });

        sessions.push({
          id: `${cls.id}_${date}_${slot.id}`,
          classId: cls.id,
          date,
          dayOfWeek,
          sessionName: `${slot.timeSlotLabel} - ${slot.subject}`,
          teacherName: slot.teacherName,
          teacherId: slot.teacherId,
          lectureSlotId: slot.id,
          timeSlot: slot.timeSlotLabel,
          subject: slot.subject,
          records,
          lastUpdated: new Date().toISOString(),
          remarks: `Conducted lecture on ${slot.subject} for ${cls.name}.`
        });
      });
    });
  });

  return sessions;
}
