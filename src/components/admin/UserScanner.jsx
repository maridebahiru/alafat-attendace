import React, { useState } from 'react';
import defaultSupabase from '../../supabase/client';
import { getStudentByIdentifier } from '../../utils/studentUtils';

/**
 * UserScanner React Component with Direct ID Lookup & Modal Popup
 * 
 * @param {Object} props
 * @param {Object} props.supabase - Supabase client instance (defaults to project configured client)
 * @param {Object} props.currentUser - Currently authenticated user object containing { id, email, role }
 */
const UserScanner = ({ supabase = defaultSupabase, currentUser }) => {
    const [users, setUsers] = useState([]);
    const [searchId, setSearchId] = useState('');
    const [loading, setLoading] = useState(false);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [hasScanned, setHasScanned] = useState(false);

    const userRole = (currentUser?.role || 'user').toLowerCase();
    const canScan = userRole === 'admin' || userRole === 'superadmin';

    // 1. Scan All Users
    const handleScanUsers = async () => {
        setError(null);

        if (!canScan) {
            const deniedMsg = "Access Denied: You must have an Admin or Superadmin role to scan user records.";
            setError(deniedMsg);
            alert(deniedMsg);
            return;
        }

        setLoading(true);
        try {
            const { data, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .order('name', { ascending: true });

            if (fetchError) {
                throw new Error(fetchError.message || "Failed to fetch user list from database.");
            }

            setUsers(data || []);
            setHasScanned(true);
        } catch (err) {
            console.error("Scan users error:", err);
            setError(err.message || "An unexpected error occurred while scanning user records.");
        } finally {
            setLoading(false);
        }
    };

    // 2. Direct ID Lookup (When Admin has specific User ID / Form ID / Email)
    const handleDirectIdLookup = async (e) => {
        e?.preventDefault();
        setError(null);

        if (!canScan) {
            setError("Access Denied: You must have an Admin or Superadmin role to lookup user IDs.");
            return;
        }

        const queryId = searchId.trim();
        if (!queryId) {
            setError("Please enter a User ID, Form ID, or Email to lookup.");
            return;
        }

        setLookupLoading(true);
        try {
            // First check if user is already loaded in state
            const inState = users.find(u =>
                String(u.form_id || '').toLowerCase() === queryId.toLowerCase() ||
                String(u.id || '').toLowerCase() === queryId.toLowerCase() ||
                String(u.email || '').toLowerCase() === queryId.toLowerCase()
            );

            if (inState) {
                setSelectedUser(inState);
                setLookupLoading(false);
                return;
            }

            // Direct Supabase query matching form_id, email, or id
            const { data, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .or(`form_id.eq.${queryId},email.eq.${queryId},id.eq.${queryId}`)
                .limit(1);

            if (fetchError) {
                throw new Error(fetchError.message);
            }

            if (data && data.length > 0) {
                setSelectedUser(data[0]);
                return;
            }

            // Fallback: Check Firestore students & members collections
            const student = await getStudentByIdentifier(queryId);
            if (student) {
                setSelectedUser({
                    id: student.employeeId || student.memberId || student.docId,
                    email: student.phone || student.email || `${student.employeeId}@alafat.org`,
                    form_id: student.idNo || student.memberId || student.employeeId,
                    full_name: student.name || student.fullName,
                    role: student.position || 'Singer',
                    created_at: student.createdAt?.toDate ? student.createdAt.toDate().toISOString() : new Date().toISOString()
                });
            } else {
                setError(`No user found matching ID: "${queryId}"`);
            }
        } catch (err) {
            // Check Firestore fallback in case Supabase threw connection error
            try {
                const student = await getStudentByIdentifier(queryId);
                if (student) {
                    setSelectedUser({
                        id: student.employeeId || student.memberId || student.docId,
                        email: student.phone || student.email || `${student.employeeId}@alafat.org`,
                        form_id: student.idNo || student.memberId || student.employeeId,
                        full_name: student.name || student.fullName,
                        role: student.position || 'Singer',
                        created_at: student.createdAt?.toDate ? student.createdAt.toDate().toISOString() : new Date().toISOString()
                    });
                    return;
                }
            } catch (fsErr) {}
            console.error("Direct ID lookup error:", err);
            setError(err.message || "Failed to lookup user ID.");
        } finally {
            setLookupLoading(false);
        }
    };

    return (
        <div style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '24px',
            backgroundColor: '#1f0d14',
            borderRadius: '16px',
            border: '1px solid rgba(211, 162, 0, 0.2)',
            color: '#f5e6c8',
            maxWidth: '900px',
            margin: '0 auto'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '15px'
            }}>
                <div>
                    <h2 style={{ color: '#d3a200', margin: 0, fontSize: '1.4rem' }}>User Scanner & ID Lookup</h2>
                    <p style={{ color: 'rgba(245, 230, 200, 0.7)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                        Scan all users or lookup a specific user directly by ID
                    </p>
                </div>

                <button
                    onClick={handleScanUsers}
                    disabled={loading}
                    style={{
                        backgroundColor: '#d3a200',
                        color: '#1a0a0f',
                        padding: '12px 24px',
                        borderRadius: '10px',
                        border: 'none',
                        fontWeight: '800',
                        fontSize: '0.95rem',
                        cursor: loading ? 'wait' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 15px rgba(211, 162, 0, 0.2)'
                    }}
                >
                    {loading ? 'Scanning All...' : '🔍 Scan All Users'}
                </button>
            </div>

            {/* Direct ID Lookup Form */}
            {canScan && (
                <form
                    onSubmit={handleDirectIdLookup}
                    style={{
                        display: 'flex',
                        gap: '10px',
                        marginBottom: '24px',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        padding: '14px',
                        borderRadius: '12px',
                        border: '1px solid rgba(211, 162, 0, 0.15)'
                    }}
                >
                    <input
                        type="text"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        placeholder="Enter or scan Form ID / User ID / Email..."
                        style={{
                            flex: 1,
                            padding: '12px 16px',
                            borderRadius: '8px',
                            border: '1px solid rgba(211, 162, 0, 0.3)',
                            backgroundColor: '#1a0a0f',
                            color: '#f5e6c8',
                            fontSize: '0.95rem',
                            outline: 'none'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={lookupLoading}
                        style={{
                            padding: '12px 20px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(211, 162, 0, 0.2)',
                            color: '#d3a200',
                            border: '1px solid #d3a200',
                            fontWeight: '700',
                            cursor: lookupLoading ? 'wait' : 'pointer',
                            transition: '0.2s'
                        }}
                    >
                        {lookupLoading ? 'Searching...' : 'Lookup ID 🎯'}
                    </button>
                </form>
            )}

            {/* Error Notification */}
            {error && (
                <div style={{
                    padding: '14px 18px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 77, 77, 0.15)',
                    border: '1px solid #ff4d4d',
                    color: '#ff4d4d',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    marginBottom: '20px'
                }}>
                    ⚠️ {error}
                </div>
            )}

            {/* Scanning Status / Results */}
            {!canScan ? (
                <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    borderRadius: '12px',
                    border: '1px dashed rgba(255, 77, 77, 0.4)',
                    color: '#ff4d4d'
                }}>
                    🔒 Access Restricted: Your role ("{userRole}") does not have scanner privileges.
                </div>
            ) : hasScanned && users.length === 0 ? (
                <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: '12px',
                    color: 'rgba(245, 230, 200, 0.6)'
                }}>
                    No registered user records found in database.
                </div>
            ) : (
                hasScanned && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            color: '#d3a200',
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                            marginBottom: '4px'
                        }}>
                            Registered Users ({users.length}) — Click user to view ID details
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                            gap: '12px'
                        }}>
                            {users.map((u) => {
                                const isSuper = (u.role || '').toLowerCase() === 'superadmin';
                                const isAdminRole = (u.role || '').toLowerCase() === 'admin';
                                return (
                                    <div
                                        key={u.id || u.email}
                                        onClick={() => setSelectedUser(u)}
                                        style={{
                                            padding: '14px 16px',
                                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                            border: '1px solid rgba(211, 162, 0, 0.15)',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'rgba(211, 162, 0, 0.08)';
                                            e.currentTarget.style.borderColor = '#d3a200';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                                            e.currentTarget.style.borderColor = 'rgba(211, 162, 0, 0.15)';
                                        }}
                                    >
                                        <div style={{ fontWeight: '700', color: '#f5e6c8', fontSize: '0.95rem' }}>
                                            {u.name}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'rgba(245, 230, 200, 0.6)', marginTop: '2px' }}>
                                            {u.email}
                                        </div>
                                        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '800',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                backgroundColor: isSuper ? 'rgba(211, 162, 0, 0.2)' : (isAdminRole ? 'rgba(101, 8, 27, 0.4)' : 'rgba(255, 255, 255, 0.05)'),
                                                color: isSuper ? '#d3a200' : (isAdminRole ? '#ff9999' : 'rgba(245, 230, 200, 0.7)'),
                                                border: `1px solid ${isSuper ? '#d3a200' : 'rgba(255, 255, 255, 0.1)'}`
                                            }}>
                                                {(u.role || 'user').toUpperCase()}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: '#d3a200', fontWeight: '600' }}>
                                                View ID Details →
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            )}

            {/* User Details Modal Popup */}
            {selectedUser && (
                <div
                    onClick={() => setSelectedUser(null)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        backdropFilter: 'blur(6px)',
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: '#2a0f18',
                            border: '1px solid #d3a200',
                            borderRadius: '20px',
                            padding: '28px',
                            width: '100%',
                            maxWidth: '450px',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                            position: 'relative'
                        }}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedUser(null)}
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'none',
                                border: 'none',
                                color: '#f5e6c8',
                                fontSize: '1.2rem',
                                cursor: 'pointer',
                                opacity: 0.7
                            }}
                        >
                            ✕
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                backgroundColor: '#65081b',
                                color: '#d3a200',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.4rem',
                                fontWeight: '800'
                            }}>
                                {selectedUser.name ? selectedUser.name.charAt(0) : '?'}
                            </div>
                            <div>
                                <h3 style={{ color: '#d3a200', margin: 0, fontSize: '1.2rem' }}>
                                    {selectedUser.name}
                                </h3>
                                <span style={{ fontSize: '0.8rem', color: 'rgba(245, 230, 200, 0.6)' }}>
                                    User Registration Record
                                </span>
                            </div>
                        </div>

                        {/* Details Fields */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '6px' }}>
                            {/* Form ID Field */}
                            <div style={{ padding: '12px 14px', backgroundColor: '#1a0a0f', borderRadius: '10px', border: '1px solid rgba(211, 162, 0, 0.3)' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#d3a200', textTransform: 'uppercase' }}>Form ID / Phone ID</div>
                                <div style={{ fontSize: '1.05rem', fontWeight: '800', marginTop: '4px', color: selectedUser.form_id ? '#f5e6c8' : '#ff9999' }}>
                                    {selectedUser.form_id ? selectedUser.form_id : "ID not available"}
                                </div>
                            </div>

                            {selectedUser.christian_name && (
                                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(245, 230, 200, 0.6)', textTransform: 'uppercase' }}>የክርስትና ስም (Christian Name)</div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#d3a200', marginTop: '2px' }}>{selectedUser.christian_name}</div>
                                </div>
                            )}

                            {selectedUser.phone && (
                                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(245, 230, 200, 0.6)', textTransform: 'uppercase' }}>ስልክ ቁጥር (Phone Number)</div>
                                    <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#f5e6c8', marginTop: '2px' }}>{selectedUser.phone}</div>
                                </div>
                            )}

                            <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(245, 230, 200, 0.6)', textTransform: 'uppercase' }}>Email Address</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#f5e6c8', marginTop: '2px' }}>{selectedUser.email}</div>
                            </div>

                            {selectedUser.education && (
                                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(245, 230, 200, 0.6)', textTransform: 'uppercase' }}>የትምህርት ደረጃ (Education)</div>
                                    <div style={{ fontSize: '0.9rem', color: '#f5e6c8', marginTop: '2px' }}>{selectedUser.education}</div>
                                </div>
                            )}

                            {selectedUser.church && (
                                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(245, 230, 200, 0.6)', textTransform: 'uppercase' }}>አጥቢያ ቤተክርስቲያን (Church)</div>
                                    <div style={{ fontSize: '0.85rem', color: '#f5e6c8', marginTop: '2px' }}>{selectedUser.church}</div>
                                </div>
                            )}

                            {selectedUser.id_photo_url && (
                                <div style={{ padding: '12px 14px', backgroundColor: 'rgba(211, 162, 0, 0.08)', borderRadius: '10px', border: '1px solid rgba(211, 162, 0, 0.3)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#d3a200', textTransform: 'uppercase', marginBottom: '8px' }}>መታወቂያ (ID Photo Attachment)</div>
                                    <img
                                        src={selectedUser.id_photo_url}
                                        alt="Uploaded ID Photo"
                                        style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #d3a200', marginBottom: '8px' }}
                                    />
                                    <div>
                                        <a href={selectedUser.id_photo_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: '#d3a200', fontWeight: '700', textDecoration: 'underline', display: 'inline-block' }}>
                                            🔗 View High-Res ID Document →
                                        </a>
                                    </div>
                                </div>
                            )}

                            <div style={{ padding: '10px 14px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '10px' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(245, 230, 200, 0.6)', textTransform: 'uppercase' }}>Assigned System Role</div>
                                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#d3a200', marginTop: '2px', textTransform: 'uppercase' }}>{selectedUser.role || 'user'}</div>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setSelectedUser(null)}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(211, 162, 0, 0.4)',
                                    backgroundColor: 'transparent',
                                    color: '#f5e6c8',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    transition: '0.2s'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserScanner;
