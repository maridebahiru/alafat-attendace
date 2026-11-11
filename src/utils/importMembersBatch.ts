import { db } from '../firebase/config';
import { writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { reserveMemberIdBatch } from './generateMemberIds';
import { ParsedMemberRow } from './parseMembersExcel';
import { MEMBERS_CONFIG } from '../config/members';
import { getAuthenticatedAdmin } from './rbac';

export interface ImportProgress {
    current: number;
    total: number;
    batchNumber: number;
    totalBatches: number;
    percent: number;
}

export interface CreatedMemberSummary {
    memberId: string;
    displayId: string;
    fullName: string;
    gender: string;
    phone: string;
    group: string;
}

export interface ImportResult {
    success: boolean;
    createdCount: number;
    skippedCount: number;
    createdMembers: CreatedMemberSummary[];
    error?: string;
}

/**
 * Sequential batched writes to Firestore `members` collection with retry and progress feedback.
 */
export async function importMembersToFirestore(
    rows: ParsedMemberRow[],
    importDuplicatesAnyway = false,
    onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
    // Filter importable rows
    const importableRows = rows.filter(r => {
        if (r.status === 'valid') return true;
        if (r.status === 'duplicate' && importDuplicatesAnyway) return true;
        return false;
    });

    if (importableRows.length === 0) {
        return {
            success: true,
            createdCount: 0,
            skippedCount: rows.length,
            createdMembers: []
        };
    }

    const admin = getAuthenticatedAdmin();
    const adminUid = admin?.username || admin?.email || admin?.name || 'admin';

    // Reserve exact IDs in ONE transaction
    const reservation = await reserveMemberIdBatch(importableRows.length);

    // Assign IDs in file order
    importableRows.forEach((row, idx) => {
        row.assignedId = reservation.ids[idx];
    });

    const batchSize = MEMBERS_CONFIG.batchSize;
    const totalBatches = Math.ceil(importableRows.length / batchSize);
    let createdCount = 0;
    const createdMembers: CreatedMemberSummary[] = [];

    // Sequential batch commits
    for (let b = 0; b < totalBatches; b++) {
        const chunk = importableRows.slice(b * batchSize, (b + 1) * batchSize);

        let retries = 3;
        let success = false;
        let lastError: any = null;

        while (retries > 0 && !success) {
            try {
                const batch = writeBatch(db);

                chunk.forEach(row => {
                    const memberId = row.assignedId!.stored;
                    const docRef = doc(db, 'members', memberId);

                    const data: Record<string, any> = {
                        fullName: row.fullName,
                        gender: row.gender,
                        photoUrl: null,
                        idNo: row.assignedId!.display,
                        memberId: memberId,
                        createdAt: serverTimestamp(),
                        createdBy: adminUid
                    };
                    if (row.phone) data.phone = row.phone;
                    if (row.group) data.group = row.group;

                    batch.set(docRef, data);
                });

                await batch.commit();
                success = true;
                createdCount += chunk.length;

                chunk.forEach(r => {
                    createdMembers.push({
                        memberId: r.assignedId!.stored,
                        displayId: r.assignedId!.display,
                        fullName: r.fullName,
                        gender: r.gender,
                        phone: r.phone,
                        group: r.group
                    });
                });

                if (onProgress) {
                    onProgress({
                        current: createdCount,
                        total: importableRows.length,
                        batchNumber: b + 1,
                        totalBatches,
                        percent: Math.round((createdCount / importableRows.length) * 100)
                    });
                }
            } catch (err) {
                lastError = err;
                retries--;
                console.warn(`[importMembersToFirestore] Batch ${b + 1}/${totalBatches} failed. Retrying... (${retries} attempts left)`, err);
                if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)));
                }
            }
        }

        if (!success) {
            throw new Error(`Failed to commit batch ${b + 1} of ${totalBatches}: ${lastError?.message || 'Firestore write failed'}`);
        }
    }

    return {
        success: true,
        createdCount,
        skippedCount: rows.length - createdCount,
        createdMembers
    };
}
