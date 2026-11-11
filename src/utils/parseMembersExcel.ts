import * as XLSX from 'xlsx';
import { db } from '../firebase/config';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { MEMBERS_CONFIG } from '../config/members';

export type GenderType = 'Male' | 'Female';
export type RowStatus = 'valid' | 'invalid' | 'duplicate';

export interface ParsedMemberRow {
    rowNumber: number;
    rawName: string;
    fullName: string;
    rawGender: string;
    gender: GenderType | '';
    phone: string;
    group: string;
    status: RowStatus;
    reason?: string;
    assignedId?: {
        stored: string;
        display: string;
        num: number;
    };
}

export interface ParseResult {
    rows: ParsedMemberRow[];
    summary: {
        total: number;
        valid: number;
        invalid: number;
        duplicate: number;
    };
    error?: string;
}

/**
 * Normalized duplicate key for name + gender match
 */
export function createDuplicateKey(name: string, gender: string): string {
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, ' ');
    const cleanGender = gender.trim().toLowerCase();
    return `${cleanName}|${cleanGender}`;
}

/**
 * Normalizes gender value:
 * M / Male / ወንድ -> "Male"
 * F / Female / ሴት -> "Female"
 * Anything else -> null
 */
export function normalizeGender(val: any): GenderType | null {
    if (val === null || val === undefined) return null;
    const str = String(val).trim().toLowerCase();
    
    // Male variants
    if (str === 'm' || str === 'male' || str === 'ወንድ' || str === 'man' || str === 'boy') {
        return 'Male';
    }
    // Female variants
    if (str === 'f' || str === 'female' || str === 'ሴት' || str === 'woman' || str === 'girl') {
        return 'Female';
    }
    return null;
}

/**
 * Normalizes full name: trims, collapses multiple spaces into single space, preserves UTF-8 Amharic/Latin.
 */
export function normalizeName(val: any): string {
    if (val === null || val === undefined) return '';
    return String(val).trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes phone number (optional)
 */
export function normalizePhone(val: any): string {
    if (val === null || val === undefined) return '';
    return String(val).trim();
}

/**
 * Detects standard headers from row values (Name, Gender, Group)
 */
function identifyColumns(headers: string[]): {
    nameIdx: number;
    genderIdx: number;
    groupIdx: number;
} {
    let nameIdx = -1;
    let genderIdx = -1;
    let groupIdx = -1;

    const nameAliases = ['name', 'full name', 'fullname', 'member name', 'ስም', 'ሙሉ ስም', 'ተማሪ ስም'];
    const genderAliases = ['gender', 'sex', 'ፆታ', 'ጾታ'];
    const groupAliases = ['group', 'department', 'zone', 'team', 'ክፍል', 'ቡድን', 'ዘርፍ'];

    headers.forEach((rawHeader, idx) => {
        if (!rawHeader) return;
        const h = String(rawHeader).trim().toLowerCase();

        if (nameIdx === -1 && nameAliases.includes(h)) {
            nameIdx = idx;
        } else if (genderIdx === -1 && genderAliases.includes(h)) {
            genderIdx = idx;
        } else if (groupIdx === -1 && groupAliases.includes(h)) {
            groupIdx = idx;
        }
    });

    // Fallback: If no exact aliases matched, try partial matching
    if (nameIdx === -1) {
        nameIdx = headers.findIndex(h => {
            const s = String(h || '').trim().toLowerCase();
            return s.includes('name') || s.includes('ስም');
        });
    }
    if (genderIdx === -1) {
        genderIdx = headers.findIndex(h => {
            const s = String(h || '').trim().toLowerCase();
            return s.includes('gender') || s.includes('sex') || s.includes('ፆታ') || s.includes('ጾታ');
        });
    }

    return { nameIdx, genderIdx, groupIdx };
}

/**
 * Fetch set of existing members (name+gender keys) from Firestore for duplicate detection.
 * Queries both `members` and `students` collections.
 */
export async function fetchExistingMembersKeys(): Promise<Set<string>> {
    const existing = new Set<string>();
    try {
        const membersCol = collection(db, 'members');
        const snap = await getDocs(query(membersCol, limit(2000)));
        snap.forEach(docSnap => {
            const data = docSnap.data();
            const name = data.fullName || data.name;
            const gender = data.gender;
            if (name && gender) {
                existing.add(createDuplicateKey(name, gender));
            }
        });
    } catch (e) {
        console.warn('[parseMembersExcel] Failed to query existing members from Firestore:', e);
    }

    try {
        const studentsCol = collection(db, 'students');
        const snapStudents = await getDocs(query(studentsCol, limit(2000)));
        snapStudents.forEach(docSnap => {
            const data = docSnap.data();
            const name = data.fullName || data.name;
            const gender = data.gender;
            if (name && gender) {
                existing.add(createDuplicateKey(name, gender));
            }
        });
    } catch (e) {
        console.warn('[parseMembersExcel] Failed to query existing students from Firestore:', e);
    }

    return existing;
}

/**
 * Parses an Excel or CSV file buffer/arrayBuffer and classifies every row.
 */
export async function parseMembersExcel(
    fileData: ArrayBuffer | Uint8Array,
    existingDbKeys?: Set<string>,
    importDuplicatesAnyway = false
): Promise<ParseResult> {
    const workbook = XLSX.read(fileData, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
        return {
            rows: [],
            summary: { total: 0, valid: 0, invalid: 0, duplicate: 0 },
            error: "Uploaded file contains no sheets."
        };
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: '',
        blankrows: false
    });

    if (!rawRows || rawRows.length < 2) {
        return {
            rows: [],
            summary: { total: 0, valid: 0, invalid: 0, duplicate: 0 },
            error: "File has no data rows. Must contain at least a header and 1 row."
        };
    }

    // Header inspection
    const headerRow = rawRows[0].map(h => String(h || '').trim());
    const { nameIdx, genderIdx, groupIdx } = identifyColumns(headerRow);

    if (nameIdx === -1 || genderIdx === -1) {
        return {
            rows: [],
            summary: { total: 0, valid: 0, invalid: 0, duplicate: 0 },
            error: `Could not identify required columns in header: ${headerRow.join(' | ')}. Required: "Name" (or ስም) and "Gender" (or ፆታ).`
        };
    }

    // Limit to max allowed rows
    const dataRows = rawRows.slice(1);
    if (dataRows.length > MEMBERS_CONFIG.maxRowsPerFile) {
        return {
            rows: [],
            summary: { total: 0, valid: 0, invalid: 0, duplicate: 0 },
            error: `File contains ${dataRows.length} rows, which exceeds the maximum limit of ${MEMBERS_CONFIG.maxRowsPerFile} rows per batch.`
        };
    }

    // If existingDbKeys not provided, load from Firestore
    const dbKeys = existingDbKeys || await fetchExistingMembersKeys();

    const parsedRows: ParsedMemberRow[] = [];
    const inMemoryFileKeys = new Set<string>();

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    dataRows.forEach((row, i) => {
        const rowNumber = i + 2; // 1-indexed, accounting for header

        // Skip completely empty rows
        const isCompletelyEmpty = row.every(cell => String(cell || '').trim() === '');
        if (isCompletelyEmpty) {
            return;
        }

        const rawNameVal = row[nameIdx];
        const rawGenderVal = row[genderIdx];
        const rawGroupVal = groupIdx !== -1 ? row[groupIdx] : '';

        const fullName = normalizeName(rawNameVal);
        const gender = normalizeGender(rawGenderVal);
        const group = normalizeName(rawGroupVal);

        let status: RowStatus = 'valid';
        let reason: string | undefined = undefined;

        // Validation 1: Name required
        if (!fullName) {
            status = 'invalid';
            reason = 'Name is required (empty or whitespace only)';
        }
        // Validation 2: Gender normalized to Male or Female
        else if (!gender) {
            status = 'invalid';
            const displayRaw = String(rawGenderVal || '').trim();
            reason = `Invalid gender "${displayRaw || '(blank)'}". Must be Male/ወንድ or Female/ሴት`;
        } else {
            // Validation 3: Duplicate detection
            const key = createDuplicateKey(fullName, gender);
            if (inMemoryFileKeys.has(key)) {
                status = 'duplicate';
                reason = 'Duplicate in file: same name & gender already listed in previous row';
            } else if (dbKeys.has(key)) {
                status = 'duplicate';
                reason = 'Duplicate in database: member with same name & gender already exists in Firestore';
            } else {
                inMemoryFileKeys.add(key);
            }
        }

        if (status === 'invalid') {
            invalidCount++;
        } else if (status === 'duplicate') {
            duplicateCount++;
            if (importDuplicatesAnyway) {
                validCount++;
            }
        } else {
            validCount++;
        }

        parsedRows.push({
            rowNumber,
            rawName: String(rawNameVal || ''),
            fullName,
            rawGender: String(rawGenderVal || ''),
            gender: gender || '',
            phone: '',
            group,
            status,
            reason
        });
    });

    return {
        rows: parsedRows,
        summary: {
            total: parsedRows.length,
            valid: validCount,
            invalid: invalidCount,
            duplicate: duplicateCount
        }
    };
}

/**
 * Generates an Excel template file (members-template.xlsx) and triggers a browser download.
 */
export function downloadMembersTemplate(): void {
    const headers = ['Name', 'Gender', 'Group'];
    const sampleRows = [
        ['ዮናስ ታደሰ', 'ወንድ', 'Choir A'],
        ['Sara Bekele', 'Female', 'Choir B'],
        ['ተስፋዬ ገብሬ', 'Male', 'Choir A'],
        ['ማርታ አለሙ', 'ሴት', 'Choir C']
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

    // Set column widths
    ws['!cols'] = [
        { wch: 30 }, // Name
        { wch: 15 }, // Gender
        { wch: 20 }  // Group
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Members');
    XLSX.writeFile(wb, 'members-template.xlsx');
}

/**
 * 10-Row Sample Data specifically testing the edge cases described in the prompt:
 * 1. 2 Amharic names
 * 2. 1 invalid gender
 * 3. 1 empty name
 * 4. 1 duplicate
 * 5. 1 very long name
 */
export const SAMPLE_10_ROWS: Array<[string, string, string]> = [
    // 1. Amharic Name #1 (Valid)
    ['ዮናስ ታደሰ', 'ወንድ', 'Choir A'],
    // 2. Amharic Name #2 (Valid)
    ['ማርታ አለሙ', 'ሴት', 'Choir B'],
    // 3. Invalid Gender (Invalid)
    ['ዳዊት ከበደ', 'NotSpecified', 'Choir A'],
    // 4. Empty Name (Invalid)
    ['   ', 'Female', 'Choir C'],
    // 5. Duplicate of #1 (Duplicate)
    ['ዮናስ ታደሰ', 'ወንድ', 'Choir A'],
    // 6. Very Long Name (Valid)
    ['መርስኤሐዘን ወልደሚካኤል ተክለሃይማኖት ገብረእግዚአብሔር', 'Male', 'Honorary Choir'],
    // 7. English Valid
    ['Samuel Tadesse', 'Male', 'Choir B'],
    // 8. English Valid
    ['Bethlehem Haile', 'Female', 'Choir C'],
    // 9. Amharic Valid
    ['አበበ ቢቂላ', 'ወንድ', 'Athletics & Choir'],
    // 10. Amharic Valid
    ['ብርቱካን ፀጋዬ', 'ሴት', 'Choir A']
];

/**
 * Generates and downloads the 10-Row test sample file as `sample-10-members-test.xlsx`.
 */
export function downloadSampleTestExcel(): void {
    const headers = ['Name', 'Gender', 'Group'];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...SAMPLE_10_ROWS]);
    ws['!cols'] = [{ wch: 45 }, { wch: 15 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample_Test');
    XLSX.writeFile(wb, 'sample-10-members-test.xlsx');
}

/**
 * Converts array of rows into a sample ArrayBuffer for in-browser instant test preview.
 */
export function createSampleTestBuffer(): ArrayBuffer {
    const headers = ['Name', 'Gender', 'Group'];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...SAMPLE_10_ROWS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Test');
    const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return u8.buffer;
}

/**
 * Generates and downloads the post-import CSV report.
 */
export function downloadImportReportCSV(
    rows: ParsedMemberRow[],
    filename = 'member-import-report.csv'
): void {
    const headers = ['Row', 'Full Name', 'Gender', 'Group', 'Status', 'Assigned Member ID', 'Reason / Notes'];
    const dataLines = rows.map(r => [
        r.rowNumber,
        `"${(r.fullName || r.rawName || '').replace(/"/g, '""')}"`,
        r.gender || r.rawGender || '',
        r.group || '',
        r.assignedId ? 'CREATED' : r.status.toUpperCase(),
        r.assignedId ? `${r.assignedId.display} (${r.assignedId.stored})` : 'N/A',
        `"${(r.reason || (r.assignedId ? 'Successfully imported' : '')).replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...dataLines.map(line => line.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
