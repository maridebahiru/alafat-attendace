export interface MembersConfig {
    prefix: string;
    startNumber: number;
    minPaddingDigits: number;
    batchSize: number;
    maxRowsPerFile: number;
}

export const MEMBERS_CONFIG: MembersConfig = {
    prefix: 'JY',
    startNumber: 1,
    minPaddingDigits: 3,
    batchSize: 500,
    maxRowsPerFile: 2000
};

/**
 * Format a numeric ID into stored and display representation.
 * For num = 1 -> stored: "JY001", display: "JY 001"
 * For num = 999 -> stored: "JY999", display: "JY 999"
 * For num = 1000 -> stored: "JY1000", display: "JY 1000"
 */
export const formatMemberId = (
    num: number,
    prefix: string = MEMBERS_CONFIG.prefix,
    minDigits: number = MEMBERS_CONFIG.minPaddingDigits
) => {
    const padded = String(num).padStart(minDigits, '0');
    return {
        stored: `${prefix}${padded}`,
        display: `${prefix} ${padded}`,
        num
    };
};
