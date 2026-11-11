import { db } from '../firebase/config';
import { runTransaction, doc, collection, getDocs, limit, query } from 'firebase/firestore';
import { MEMBERS_CONFIG, formatMemberId } from '../config/members';

export interface GeneratedMemberId {
    stored: string;
    display: string;
    num: number;
}

export interface ReservedIdsResult {
    startNumber: number;
    endNumber: number;
    count: number;
    ids: GeneratedMemberId[];
}

/**
 * Searches existing members to find the highest existing numeric ID
 * if counters/members has not been initialized yet.
 */
export async function findHighestExistingMemberId(): Promise<number> {
    try {
        const membersCol = collection(db, 'members');
        const snap = await getDocs(query(membersCol, limit(500)));
        if (snap.empty) {
            return MEMBERS_CONFIG.startNumber - 1;
        }

        let maxNum = MEMBERS_CONFIG.startNumber - 1;
        const prefix = MEMBERS_CONFIG.prefix;

        snap.forEach(docSnap => {
            const docId = docSnap.id;
            const data = docSnap.data();
            
            // Check document ID (e.g. JY001 or JY002)
            if (typeof docId === 'string' && docId.startsWith(prefix)) {
                const numericPart = parseInt(docId.replace(prefix, '').trim(), 10);
                if (!isNaN(numericPart) && numericPart > maxNum) {
                    maxNum = numericPart;
                }
            }

            // Also check idNo or employeeId field if stored on data
            const memberIdField = data.idNo || data.employeeId || data.memberId;
            if (typeof memberIdField === 'string' && memberIdField.startsWith(prefix)) {
                const numericPart = parseInt(memberIdField.replace(prefix, '').trim(), 10);
                if (!isNaN(numericPart) && numericPart > maxNum) {
                    maxNum = numericPart;
                }
            }
        });

        return maxNum;
    } catch (err) {
        console.warn('[MemberIds] Error finding highest existing member ID:', err);
        return MEMBERS_CONFIG.startNumber - 1;
    }
}

/**
 * Atomically reserves a sequential block of `count` member IDs in a single Firestore transaction.
 * Updates counters/members { last: currentLast + count }.
 * IDs are strictly reserved so concurrent uploads never collide or duplicate.
 */
export async function reserveMemberIdBatch(count: number): Promise<ReservedIdsResult> {
    if (count <= 0) {
        throw new Error("Reservation count must be at least 1");
    }

    const counterRef = doc(db, 'counters', 'members');

    // Run reservation in a single atomic transaction
    const reservation = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let currentLast: number;

        if (!counterSnap.exists()) {
            // First run: fallback to finding highest existing member ID
            const highestExisting = await findHighestExistingMemberId();
            currentLast = Math.max(MEMBERS_CONFIG.startNumber - 1, highestExisting);
        } else {
            const data = counterSnap.data();
            currentLast = typeof data.last === 'number' ? data.last : MEMBERS_CONFIG.startNumber - 1;
        }

        const newLast = currentLast + count;

        transaction.set(counterRef, {
            last: newLast,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return {
            startNumber: currentLast + 1,
            endNumber: newLast,
            count
        };
    });

    // Assign IDs in file order
    const ids: GeneratedMemberId[] = [];
    for (let n = reservation.startNumber; n <= reservation.endNumber; n++) {
        ids.push(formatMemberId(n));
    }

    return {
        ...reservation,
        ids
    };
}
