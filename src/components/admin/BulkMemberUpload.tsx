import React, { useState, useRef, useCallback } from 'react';
import {
    Upload, FileSpreadsheet, Download, CheckCircle2, XCircle, AlertTriangle,
    RefreshCw, ArrowRight, FileText, Check, ShieldAlert, Sparkles, Filter
} from 'lucide-react';
import {
    parseMembersExcel, ParsedMemberRow, ParseResult,
    downloadMembersTemplate, downloadSampleTestExcel, createSampleTestBuffer,
    downloadImportReportCSV
} from '../../utils/parseMembersExcel';
import { importMembersToFirestore, ImportProgress, CreatedMemberSummary } from '../../utils/importMembersBatch';
import { isAdminOrSuperAdmin } from '../../utils/rbac';
import { useNavigate } from 'react-router-dom';

interface BulkMemberUploadProps {
    onNavigateToGenerator?: (members?: CreatedMemberSummary[]) => void;
    onImportSuccess?: () => void;
}

export const BulkMemberUpload: React.FC<BulkMemberUploadProps> = ({ onNavigateToGenerator, onImportSuccess }) => {
    const navigate = useNavigate();
    const hasAdminAccess = isAdminOrSuperAdmin();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string>('');
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isParsing, setIsParsing] = useState<boolean>(false);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [importDuplicatesAnyway, setImportDuplicatesAnyway] = useState<boolean>(false);

    // Import Execution State
    const [isImporting, setIsImporting] = useState<boolean>(false);
    const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
    const [importCompleteResult, setImportCompleteResult] = useState<{
        createdCount: number;
        skippedCount: number;
        createdMembers: CreatedMemberSummary[];
    } | null>(null);
    const [importError, setImportError] = useState<string>('');

    // Preview table filtering & pagination
    const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'invalid' | 'duplicate'>('all');
    const [page, setPage] = useState<number>(1);
    const rowsPerPage = 20;

    // Handle File Processing
    const processFileBuffer = async (buffer: ArrayBuffer, name: string) => {
        setIsParsing(true);
        setImportError('');
        setImportCompleteResult(null);
        setFileName(name);
        try {
            const result = await parseMembersExcel(buffer, undefined, importDuplicatesAnyway);
            setParseResult(result);
            setPage(1);
        } catch (err: any) {
            console.error('File parse error:', err);
            setImportError(err?.message || 'Failed to parse Excel file.');
        } finally {
            setIsParsing(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const buffer = await file.arrayBuffer();
        await processFileBuffer(buffer, file.name);
        // Reset input value so same file can be re-uploaded if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        const validExts = ['.xlsx', '.xls', '.csv'];
        const isMatch = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
        if (!isMatch) {
            setImportError('Please upload an Excel (.xlsx, .xls) or CSV file.');
            return;
        }
        const buffer = await file.arrayBuffer();
        await processFileBuffer(buffer, file.name);
    }, [importDuplicatesAnyway]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    // Load 10-Row Built-in Test Sample
    const handleLoadTestSample = async () => {
        setIsParsing(true);
        setImportError('');
        setImportCompleteResult(null);
        setFileName('sample-10-members-test.xlsx');
        try {
            const testBuffer = createSampleTestBuffer();
            const result = await parseMembersExcel(testBuffer, undefined, importDuplicatesAnyway);
            setParseResult(result);
            setPage(1);
        } catch (err: any) {
            setImportError('Failed to parse test sample.');
        } finally {
            setIsParsing(false);
        }
    };

    // Toggle Duplicates Option
    const handleToggleDuplicates = async (checked: boolean) => {
        setImportDuplicatesAnyway(checked);
        if (parseResult) {
            // Recompute counts with updated setting
            const updatedRows = parseResult.rows.map(r => ({ ...r }));
            let valid = 0;
            let invalid = 0;
            let duplicate = 0;
            updatedRows.forEach(r => {
                if (r.status === 'invalid') invalid++;
                else if (r.status === 'duplicate') {
                    duplicate++;
                    if (checked) valid++;
                } else {
                    valid++;
                }
            });
            setParseResult({
                ...parseResult,
                summary: {
                    total: updatedRows.length,
                    valid,
                    invalid,
                    duplicate
                }
            });
        }
    };

    // Reset / Cancel
    const handleCancel = () => {
        setFileName('');
        setParseResult(null);
        setImportCompleteResult(null);
        setImportProgress(null);
        setImportError('');
        setPage(1);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Confirm & Execute Import
    const handleConfirmImport = async () => {
        if (!parseResult || parseResult.summary.valid === 0) return;
        setIsImporting(true);
        setImportError('');
        setImportProgress({
            current: 0,
            total: parseResult.summary.valid,
            batchNumber: 1,
            totalBatches: Math.ceil(parseResult.summary.valid / 500),
            percent: 0
        });

        try {
            const result = await importMembersToFirestore(
                parseResult.rows,
                importDuplicatesAnyway,
                (progress) => setImportProgress(progress)
            );

            setImportCompleteResult({
                createdCount: result.createdCount,
                skippedCount: result.skippedCount,
                createdMembers: result.createdMembers
            });

            if (onImportSuccess) {
                onImportSuccess();
            }
        } catch (err: any) {
            console.error('Import execution error:', err);
            setImportError(err?.message || 'Error occurred during Firestore bulk writes.');
        } finally {
            setIsImporting(false);
        }
    };

    // Download CSV Report
    const handleDownloadReport = () => {
        if (!parseResult) return;
        downloadImportReportCSV(parseResult.rows, `import-report-${Date.now()}.csv`);
    };

    // Go to ID Card Generation
    const handleGoToIdCards = () => {
        if (onNavigateToGenerator) {
            onNavigateToGenerator(importCompleteResult?.createdMembers);
        } else {
            navigate('/register');
        }
    };

    // RBAC Guard check
    if (!hasAdminAccess) {
        return (
            <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: 'rgba(255, 77, 77, 0.1)',
                border: '1px solid #ff4d4d',
                borderRadius: '16px',
                color: '#ff4d4d'
            }}>
                <ShieldAlert size={48} style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>Admin Access Required</h3>
                <p style={{ opacity: 0.8, fontSize: '14px' }}>
                    Bulk upload is strictly reserved for authorized administrators. Please log in with admin privileges.
                </p>
            </div>
        );
    }

    // Filtered Rows for Preview Table
    const filteredRows = parseResult?.rows.filter(r => {
        if (filterStatus === 'all') return true;
        return r.status === filterStatus;
    }) || [];

    const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
    const paginatedRows = filteredRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '16px',
                backgroundColor: 'var(--bg-secondary)',
                padding: '24px 30px',
                borderRadius: '16px',
                border: '1px solid var(--glass-border)'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            backgroundColor: 'rgba(211, 162, 0, 0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--accent-gold)'
                        }}>
                            <FileSpreadsheet size={22} />
                        </div>
                        <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                            Bulk Upload Members
                        </h2>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, maxWidth: '650px' }}>
                        Import new members with auto-generated unique IDs (JY 001, JY 002...) using SheetJS client-side parsing, duplicate detection, and atomic Firestore batch writes.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Download Template Button */}
                    <button
                        onClick={downloadMembersTemplate}
                        className="header-action-btn"
                        style={{ padding: '10px 18px', fontSize: '13px', backgroundColor: 'rgba(211, 162, 0, 0.12)' }}
                    >
                        <Download size={16} />
                        <span>Download Template (.xlsx)</span>
                    </button>

                    {/* Test with 10-Row Sample Button */}
                    <button
                        onClick={handleLoadTestSample}
                        className="header-action-btn"
                        style={{ padding: '10px 18px', fontSize: '13px', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                        title="Load 10-row test dataset (2 Amharic, 1 invalid gender, 1 empty name, 1 duplicate, 1 long name)"
                    >
                        <Sparkles size={16} />
                        <span>Load 10-Row Test Sample</span>
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {importError && (
                <div style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 77, 77, 0.12)',
                    border: '1px solid #ff4d4d',
                    color: '#ff4d4d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '14px'
                }}>
                    <XCircle size={20} style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: '600' }}>{importError}</span>
                </div>
            )}

            {/* Upload Drag & Drop Area */}
            {!parseResult && !isParsing && (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        padding: '60px 30px',
                        borderRadius: '16px',
                        border: `2px dashed ${isDragging ? 'var(--accent-gold)' : 'rgba(211, 162, 0, 0.3)'}`,
                        backgroundColor: isDragging ? 'rgba(211, 162, 0, 0.06)' : 'rgba(26, 10, 15, 0.6)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out'
                    }}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                    <div style={{
                        width: '68px', height: '68px', borderRadius: '50%',
                        backgroundColor: 'rgba(211, 162, 0, 0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 18px',
                        color: 'var(--accent-gold)'
                    }}>
                        <Upload size={34} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--accent-gold)', marginBottom: '8px' }}>
                        Choose an Excel / CSV file or drag & drop here
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                        Supported formats: <strong style={{ color: 'var(--text-primary)' }}>.xlsx, .xls, .csv</strong> (Max 2,000 rows per batch).
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px', opacity: 0.7 }}>
                        Required columns: <strong style={{ color: 'var(--accent-gold)' }}>Name</strong> (or ስም) and <strong style={{ color: 'var(--accent-gold)' }}>Gender</strong> (or ፆታ). Optional: Group.
                    </p>
                </div>
            )}

            {/* Parsing Spinner */}
            {isParsing && (
                <div style={{
                    padding: '60px 30px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(26, 10, 15, 0.6)',
                    border: '1px solid var(--glass-border)',
                    textAlign: 'center'
                }}>
                    <RefreshCw size={36} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-gold)', margin: '0 auto 16px' }} />
                    <h4 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                        Parsing and validating rows client-side...
                    </h4>
                </div>
            )}

            {/* Import In-Progress Card */}
            {isImporting && importProgress && (
                <div style={{
                    padding: '30px',
                    borderRadius: '16px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--accent-gold)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-gold)' }} />
                            <div>
                                <h4 style={{ margin: 0, color: 'var(--accent-gold)', fontWeight: '800', fontSize: '16px' }}>
                                    Writing Batches to Firestore...
                                </h4>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    Batch {importProgress.batchNumber} of {importProgress.totalBatches} ({importProgress.current} / {importProgress.total} members)
                                </span>
                            </div>
                        </div>
                        <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--accent-gold)' }}>
                            {importProgress.percent}%
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ width: '100%', height: '12px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${importProgress.percent}%`,
                            height: '100%',
                            backgroundColor: 'var(--accent-gold)',
                            borderRadius: '6px',
                            transition: 'width 0.3s ease-in-out'
                        }} />
                    </div>
                </div>
            )}

            {/* Import Completion Summary Card */}
            {importCompleteResult && (
                <div style={{
                    padding: '28px 30px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(0, 255, 128, 0.08)',
                    border: '1px solid #00ff80',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            width: '44px', height: '44px', borderRadius: '50%',
                            backgroundColor: 'rgba(0, 255, 128, 0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#00ff80'
                        }}>
                            <CheckCircle2 size={26} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, color: '#00ff80', fontSize: '20px', fontWeight: '800' }}>
                                Import Successfully Completed!
                            </h3>
                            <p style={{ margin: '4px 0 0', color: 'var(--text-primary)', fontSize: '14px' }}>
                                Successfully created <strong style={{ color: '#00ff80' }}>{importCompleteResult.createdCount}</strong> new member records in Firestore with reserved sequential IDs.
                                {importCompleteResult.skippedCount > 0 && ` Skipped ${importCompleteResult.skippedCount} invalid or duplicate rows.`}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
                        <button
                            onClick={handleDownloadReport}
                            className="header-action-btn"
                            style={{ padding: '10px 20px', fontSize: '13px', backgroundColor: 'rgba(0, 255, 128, 0.15)', color: '#00ff80', borderColor: 'rgba(0, 255, 128, 0.3)' }}
                        >
                            <FileText size={16} />
                            <span>Download Report CSV</span>
                        </button>

                        <button
                            onClick={handleGoToIdCards}
                            className="header-action-btn"
                            style={{ padding: '10px 20px', fontSize: '13px', backgroundColor: 'var(--accent-gold)', color: 'var(--bg-primary)', fontWeight: '800' }}
                        >
                            <span>Go to ID Card Generation</span>
                            <ArrowRight size={16} />
                        </button>

                        <button
                            onClick={handleCancel}
                            className="header-action-btn"
                            style={{ padding: '10px 20px', fontSize: '13px', backgroundColor: 'rgba(255,255,255,0.05)' }}
                        >
                            <span>Upload Another File</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Preview Section & Summary */}
            {parseResult && !importCompleteResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Summary Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '16px'
                    }}>
                        {/* Total Rows */}
                        <div style={{
                            padding: '18px 20px', borderRadius: '12px',
                            backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--glass-border)'
                        }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>
                                Total Rows
                            </span>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '4px' }}>
                                {parseResult.summary.total}
                            </div>
                        </div>

                        {/* Valid Rows */}
                        <div style={{
                            padding: '18px 20px', borderRadius: '12px',
                            backgroundColor: 'rgba(0, 255, 128, 0.08)', border: '1px solid rgba(0, 255, 128, 0.3)'
                        }}>
                            <span style={{ fontSize: '12px', color: '#00ff80', fontWeight: '700', textTransform: 'uppercase' }}>
                                Valid for Import
                            </span>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: '#00ff80', marginTop: '4px' }}>
                                {parseResult.summary.valid}
                            </div>
                        </div>

                        {/* Invalid Rows */}
                        <div style={{
                            padding: '18px 20px', borderRadius: '12px',
                            backgroundColor: 'rgba(255, 77, 77, 0.08)', border: '1px solid rgba(255, 77, 77, 0.3)'
                        }}>
                            <span style={{ fontSize: '12px', color: '#ff4d4d', fontWeight: '700', textTransform: 'uppercase' }}>
                                Invalid Rows
                            </span>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: '#ff4d4d', marginTop: '4px' }}>
                                {parseResult.summary.invalid}
                            </div>
                        </div>

                        {/* Duplicates */}
                        <div style={{
                            padding: '18px 20px', borderRadius: '12px',
                            backgroundColor: 'rgba(255, 170, 0, 0.08)', border: '1px solid rgba(255, 170, 0, 0.3)'
                        }}>
                            <span style={{ fontSize: '12px', color: '#ffaa00', fontWeight: '700', textTransform: 'uppercase' }}>
                                Duplicates
                            </span>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: '#ffaa00', marginTop: '4px' }}>
                                {parseResult.summary.duplicate}
                            </div>
                        </div>
                    </div>

                    {/* Controls & Duplicate Checkbox */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '16px',
                        padding: '16px 20px',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                File: <strong style={{ color: 'var(--text-primary)' }}>{fileName}</strong>
                            </div>

                            {/* Checkbox: Import duplicates anyway */}
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: 'var(--accent-gold)'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={importDuplicatesAnyway}
                                    onChange={(e) => handleToggleDuplicates(e.target.checked)}
                                    style={{ accentColor: 'var(--accent-gold)', width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                                <span>Import duplicates anyway</span>
                            </label>
                        </div>

                        {/* Filter Tabs */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {(['all', 'valid', 'duplicate', 'invalid'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => { setFilterStatus(f); setPage(1); }}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        border: '1px solid var(--glass-border)',
                                        backgroundColor: filterStatus === f ? 'var(--accent-gold)' : 'transparent',
                                        color: filterStatus === f ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview Table */}
                    <div style={{
                        overflowX: 'auto',
                        borderRadius: '12px',
                        border: '1px solid var(--glass-border)',
                        backgroundColor: 'var(--bg-secondary)'
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--glass-border)' }}>
                                    <th style={{ padding: '14px 16px', color: 'var(--accent-gold)', fontWeight: '700' }}>Row</th>
                                    <th style={{ padding: '14px 16px', color: 'var(--accent-gold)', fontWeight: '700' }}>Full Name</th>
                                    <th style={{ padding: '14px 16px', color: 'var(--accent-gold)', fontWeight: '700' }}>Gender</th>
                                    <th style={{ padding: '14px 16px', color: 'var(--accent-gold)', fontWeight: '700' }}>Group</th>
                                    <th style={{ padding: '14px 16px', color: 'var(--accent-gold)', fontWeight: '700' }}>Status</th>
                                    <th style={{ padding: '14px 16px', color: 'var(--accent-gold)', fontWeight: '700' }}>Notes / Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                            No rows matching current filter "{filterStatus}".
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedRows.map(row => {
                                        const isRowImportable = row.status === 'valid' || (row.status === 'duplicate' && importDuplicatesAnyway);
                                        return (
                                            <tr
                                                key={row.rowNumber}
                                                style={{
                                                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                    backgroundColor: row.status === 'invalid'
                                                        ? 'rgba(255, 77, 77, 0.04)'
                                                        : row.status === 'duplicate'
                                                        ? 'rgba(255, 170, 0, 0.04)'
                                                        : 'transparent'
                                                }}
                                            >
                                                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>#{row.rowNumber}</td>
                                                <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                                    {row.fullName || <span style={{ color: '#ff4d4d', fontStyle: 'italic' }}>(Empty)</span>}
                                                </td>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                                                    {row.gender || <span style={{ color: '#ff4d4d' }}>{row.rawGender || 'Missing'}</span>}
                                                </td>
                                                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                                                    {row.group || '-'}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {row.status === 'valid' && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            padding: '4px 8px', borderRadius: '6px',
                                                            fontSize: '11px', fontWeight: '700',
                                                            backgroundColor: 'rgba(0, 255, 128, 0.15)', color: '#00ff80'
                                                        }}>
                                                            <Check size={12} /> Valid
                                                        </span>
                                                    )}
                                                    {row.status === 'duplicate' && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            padding: '4px 8px', borderRadius: '6px',
                                                            fontSize: '11px', fontWeight: '700',
                                                            backgroundColor: 'rgba(255, 170, 0, 0.15)', color: '#ffaa00'
                                                        }}>
                                                            <AlertTriangle size={12} /> {importDuplicatesAnyway ? 'Duplicate (Allowed)' : 'Duplicate'}
                                                        </span>
                                                    )}
                                                    {row.status === 'invalid' && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            padding: '4px 8px', borderRadius: '6px',
                                                            fontSize: '11px', fontWeight: '700',
                                                            backgroundColor: 'rgba(255, 77, 77, 0.15)', color: '#ff4d4d'
                                                        }}>
                                                            <XCircle size={12} /> Invalid
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 16px', fontSize: '12px', color: row.reason ? (row.status === 'invalid' ? '#ff4d4d' : '#ffaa00') : 'var(--text-secondary)' }}>
                                                    {row.reason || 'Ready for import'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <span>Showing {((page - 1) * rowsPerPage) + 1} to {Math.min(page * rowsPerPage, filteredRows.length)} of {filteredRows.length} rows</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    className="header-action-btn"
                                    style={{ padding: '6px 14px', opacity: page === 1 ? 0.4 : 1 }}
                                >
                                    Previous
                                </button>
                                <button
                                    disabled={page === totalPages}
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    className="header-action-btn"
                                    style={{ padding: '6px 14px', opacity: page === totalPages ? 0.4 : 1 }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Action Bar */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '14px',
                        padding: '20px 0',
                        borderTop: '1px solid var(--glass-border)'
                    }}>
                        <button
                            onClick={handleCancel}
                            disabled={isImporting}
                            className="header-action-btn"
                            style={{ padding: '12px 24px', backgroundColor: 'transparent' }}
                        >
                            Cancel
                        </button>

                        <button
                            onClick={handleConfirmImport}
                            disabled={isImporting || parseResult.summary.valid === 0}
                            className="header-action-btn"
                            style={{
                                padding: '12px 28px',
                                backgroundColor: parseResult.summary.valid > 0 ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)',
                                color: parseResult.summary.valid > 0 ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                fontWeight: '800',
                                opacity: parseResult.summary.valid > 0 ? 1 : 0.5,
                                cursor: parseResult.summary.valid > 0 ? 'pointer' : 'not-allowed'
                            }}
                        >
                            {isImporting ? (
                                <>
                                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                    <span>Importing...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} />
                                    <span>Confirm & Import ({parseResult.summary.valid} valid members)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BulkMemberUpload;
