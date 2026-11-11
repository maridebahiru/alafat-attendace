import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * Generates an opaque random QR token.
 */
export const generateQrToken = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `QR_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  const rand = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `QR_${Date.now()}_${rand}`;
};

/**
 * Cleans scanned QR code values and tokens by removing control characters,
 * linebreaks, quotes, BOM, and extra whitespace.
 */
export const cleanScannedToken = (val) => {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Remove BOM and null bytes
  str = str.replace(/[\uFEFF\0]/g, '');
  // Remove carriage returns and line feeds
  str = str.replace(/[\r\n]+/g, '');
  // Trim outer whitespace
  str = str.trim();
  // Remove wrapping quotes if present (e.g. "QR_123" -> QR_123)
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
};

/**
 * Sanitizes christianName to remove duplicated "የክርስትና ስም:" prefixes.
 */
export const cleanChristianName = (val) => {
  if (!val) return '';
  let str = String(val).trim();
  str = str.replace(/^(የክርስትና\s*ስም\s*:\s*)+/gi, '').trim();
  return str;
};

/**
 * Ensures that the student document has a permanent qrToken.
 * If qrToken is missing, generates one and updates Firestore.
 * Returns the updated student object.
 */
/**
 * Ensures that the student document has a permanent qrToken.
 * If qrToken is missing, generates one and updates Firestore.
 * Returns the updated student object.
 */
export const ensureQrToken = async (student) => {
  if (!student) return student;

  if (student.qrToken) {
    return student;
  }

  const newToken = student.employeeId || student.memberId || student.idNo || generateQrToken();
  const targetId = student.docId || student.phone || student.employeeId || student.memberId;
  if (!targetId) return { ...student, qrToken: newToken };

  try {
    const studentRef = doc(db, 'students', targetId);
    await updateDoc(studentRef, { qrToken: newToken });
  } catch (err) {
    try {
      const memberRef = doc(db, 'members', targetId);
      await updateDoc(memberRef, { qrToken: newToken });
    } catch (e) {}
  }
  return { ...student, qrToken: newToken };
};

/**
 * Normalizes student or member Firestore data into standard student model.
 * Does NOT invent dummy phones.
 */
const normalizeStudentDoc = (docSnap, collectionName) => {
  const data = docSnap.data();
  const primaryId = data.memberId || data.employeeId || data.idNo || docSnap.id;
  const displayName = data.fullName || data.name || 'Member';
  return {
    docId: docSnap.id,
    ...data,
    name: displayName,
    fullName: displayName,
    gender: data.gender || '',
    employeeId: primaryId,
    idNo: data.idNo || primaryId,
    memberId: data.memberId || primaryId,
    phone: data.phone ? String(data.phone).trim() : '',
    department: data.group || data.department || 'Choir',
    position: data.position || 'Singer',
    profilePhotoUrl: data.profilePhotoUrl || data.photoUrl || '',
    qrToken: data.qrToken || primaryId,
    sourceCollection: collectionName
  };
};

/**
 * Searches for a student or singer by Singer ID (e.g. "JY001", "JY 001"), Phone Number, or Token.
 * Queries both `students` and `members` collections without requiring a phone number.
 */
export const getStudentByIdentifier = async (identifier) => {
  if (!identifier) return null;
  const rawTerm = String(identifier).trim();
  const cleanId = rawTerm.replace(/\s+/g, ''); // Collapses "JY 001" to "JY001"

  const termVariants = Array.from(new Set([
    rawTerm,
    cleanId,
    rawTerm.toUpperCase(),
    cleanId.toUpperCase(),
    rawTerm.toLowerCase(),
    cleanId.toLowerCase()
  ])).filter(Boolean);

  // 1. Direct doc lookup by doc ID in 'students'
  for (const term of [cleanId, rawTerm, cleanId.toUpperCase(), rawTerm.toUpperCase()]) {
    try {
      const snap = await getDoc(doc(db, 'students', term));
      if (snap.exists()) {
        return normalizeStudentDoc(snap, 'students');
      }
    } catch (e) {}
  }

  // 2. Direct doc lookup by doc ID in 'members'
  for (const term of [cleanId, rawTerm, cleanId.toUpperCase(), rawTerm.toUpperCase()]) {
    try {
      const snap = await getDoc(doc(db, 'members', term));
      if (snap.exists()) {
        return normalizeStudentDoc(snap, 'members');
      }
    } catch (e) {}
  }

  // 3. Query 'students' collection across primary identifier fields
  const studentsCol = collection(db, 'students');
  for (const field of ['employeeId', 'idNo', 'memberId', 'qrToken']) {
    for (const t of termVariants) {
      try {
        const q = query(studentsCol, where(field, '==', t), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return normalizeStudentDoc(snap.docs[0], 'students');
        }
      } catch (e) {}
    }
  }

  // 4. Query 'members' collection across fields
  const membersCol = collection(db, 'members');
  for (const field of ['memberId', 'idNo', 'employeeId', 'qrToken']) {
    for (const t of termVariants) {
      try {
        const q = query(membersCol, where(field, '==', t), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return normalizeStudentDoc(snap.docs[0], 'members');
        }
      } catch (e) {}
    }
  }

  // 5. Query by phone number if identifier contains digits
  if (/\d/.test(rawTerm)) {
    try {
      const qPhone = query(studentsCol, where('phone', '==', rawTerm), limit(1));
      const snapPhone = await getDocs(qPhone);
      if (!snapPhone.empty) {
        return normalizeStudentDoc(snapPhone.docs[0], 'students');
      }
    } catch (e) {}

    try {
      const qMemPhone = query(membersCol, where('phone', '==', rawTerm), limit(1));
      const snapMemPhone = await getDocs(qMemPhone);
      if (!snapMemPhone.empty) {
        return normalizeStudentDoc(snapMemPhone.docs[0], 'members');
      }
    } catch (e) {}
  }

  return null;
};

/**
 * Searches for a student or member by QR Token.
 */
export const getStudentByQrToken = async (qrToken) => {
  if (!qrToken) return null;
  const token = cleanScannedToken(qrToken);
  if (!token) return null;

  // Many QR codes contain the member ID directly (e.g. "JY001")
  const direct = await getStudentByIdentifier(token);
  if (direct) return direct;

  const studentsCol = collection(db, 'students');
  try {
    const tokenQuery = query(studentsCol, where('qrToken', '==', token), limit(1));
    const snap = await getDocs(tokenQuery);
    if (!snap.empty) {
      return normalizeStudentDoc(snap.docs[0], 'students');
    }
  } catch (e) {}

  const membersCol = collection(db, 'members');
  try {
    const memTokenQuery = query(membersCol, where('qrToken', '==', token), limit(1));
    const memSnap = await getDocs(memTokenQuery);
    if (!memSnap.empty) {
      return normalizeStudentDoc(memSnap.docs[0], 'members');
    }
  } catch (e) {}

  return null;
};

