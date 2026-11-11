import React, { useState } from 'react';
import { Search, Plus, Edit2, Trash2, X, User, Phone, Hash, Save, AlertCircle, Shield, Lock, Users } from 'lucide-react';
import { isSuperAdmin, checkPermission, getUserRole } from '../../utils/rbac';
import AdminAccountsSection from './AdminAccountsSection';


const AdminUserManagementTab = ({ students, onAdd, onUpdate, onDelete }) => {
    const [subTab, setSubTab] = useState('students');
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', idNo: '' });

    const sortedStudents = students.map(s => {
        const partner = s.partnerPhone ? students.find(st => st.phone === s.partnerPhone) : null;
        return { ...s, partnerName: partner ? partner.name : null };
    }).filter(s =>
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone || '').includes(searchTerm) ||
        (s.idNo && String(s.idNo).toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => {
        const getGroupSortName = (st) => {
            if (!st.partnerPhone) return st.name || '';
            const pName = st.partnerName || 'Unknown';
            return (st.name || '').localeCompare(pName) < 0 ? (st.name || '') : pName;
        };

        const groupA = getGroupSortName(a);
        const groupB = getGroupSortName(b);
        
        if (groupA !== groupB) {
            return groupA.localeCompare(groupB);
        }
        return (a.name || '').localeCompare(b.name || '');
    });

    const resetForm = () => {
        setFormData({ name: '', phone: '', idNo: '' });
        setEditingStudent(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editingStudent) {
            const success = await onUpdate(editingStudent.phone, formData);
            if (success) {
                setEditingStudent(null);
                resetForm();
            }
        } else {
            const success = await onAdd(formData);
            if (success) {
                setIsAddModalOpen(false);
                resetForm();
            }
        }
    };

    const handleEdit = (student) => {
        setEditingStudent(student);
        setFormData({ name: student.name, phone: student.phone, idNo: student.idNo || '' });
    };

    const thStyle = { 
        padding: '18px 15px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', 
        letterSpacing: '1px', color: 'var(--accent-gold)', borderBottom: '2px solid var(--accent-red)',
        position: 'sticky', top: 0, backgroundColor: 'var(--bg-tertiary)', zIndex: 10
    };
    const tdStyle = { padding: '15px', borderBottom: '1px solid rgba(101, 8, 27, 0.2)', fontSize: '14px' };

    const Modal = ({ title, isOpen, onClose, children }) => {
        if (!isOpen) return null;
        return (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
                <div 
                    className="glass-effect animate-slide-up" 
                    style={{ width: '100%', maxWidth: '500px', padding: '30px', borderRadius: '24px', border: '1px solid var(--glass-border)' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                        <h3 style={{ color: 'var(--accent-gold)', margin: 0, fontSize: '20px' }}>{title}</h3>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24}/></button>
                    </div>
                    {children}
                </div>
            </div>
        );
    };

    const hasWriteAccess = isSuperAdmin();

    const handleAddClick = () => {
        const perm = checkPermission('create_user');
        if (!perm.allowed) {
            alert(perm.reason);
            return;
        }
        setIsAddModalOpen(true);
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Sub-Tab Navigation Bar */}
            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={() => setSubTab('students')}
                    style={{
                        padding: '12px 22px', borderRadius: '12px', border: '1px solid var(--glass-border)',
                        backgroundColor: subTab === 'students' ? 'var(--accent-gold)' : 'var(--bg-secondary)',
                        color: subTab === 'students' ? 'var(--bg-primary)' : 'var(--text-primary)',
                        fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                        transition: 'var(--transition-smooth)'
                    }}
                >
                    <Users size={18} /> Student Accounts
                </button>
                <button
                    onClick={() => setSubTab('admins')}
                    style={{
                        padding: '12px 22px', borderRadius: '12px', border: '1px solid var(--glass-border)',
                        backgroundColor: subTab === 'admins' ? 'var(--accent-gold)' : 'var(--bg-secondary)',
                        color: subTab === 'admins' ? 'var(--bg-primary)' : 'var(--text-primary)',
                        fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                        transition: 'var(--transition-smooth)'
                    }}
                >
                    <Shield size={18} /> Admin Accounts
                </button>
            </div>

            {subTab === 'admins' ? (
                <AdminAccountsSection />
            ) : (
                <>
                    {/* Header Section */}
                    <div className="glass-effect" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h3 style={{ color: 'var(--accent-gold)', fontSize: '20px', margin: 0 }}>Student Management</h3>
                                <span style={{ 
                                    fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '20px',
                                    backgroundColor: hasWriteAccess ? 'rgba(211, 162, 0, 0.15)' : 'rgba(255, 77, 77, 0.15)',
                                    color: hasWriteAccess ? 'var(--accent-gold)' : '#ff4d4d',
                                    border: `1px solid ${hasWriteAccess ? 'var(--accent-gold)' : '#ff4d4d'}`,
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}>
                                    {hasWriteAccess ? <Shield size={12} /> : <Lock size={12} />}
                                    {hasWriteAccess ? 'SUPER ADMIN (Full Access)' : 'ADMIN (Read-Only)'}
                                </span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                                {hasWriteAccess ? 'Add, edit, or remove students and manage records.' : 'View and search student records (Scanning / Read Only).'}
                            </p>
                        </div>
                        {hasWriteAccess ? (
                            <button 
                                onClick={handleAddClick}
                                style={{ 
                                    backgroundColor: 'var(--accent-gold)', color: 'var(--bg-primary)', 
                                    padding: '12px 24px', borderRadius: '12px', border: 'none', 
                                    fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px',
                                    cursor: 'pointer', transition: 'var(--transition-smooth)',
                                    boxShadow: '0 4px 15px rgba(211, 162, 0, 0.3)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <Plus size={20} /> Add Student
                            </button>
                        ) : (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                Student creation requires Super Admin privileges
                            </div>
                        )}
                    </div>

            {/* Search and Table */}
            <div className="glass-effect animate-slide-up" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-gold)', opacity: 0.5 }} />
                        <input
                            type="text"
                            placeholder="Search by name, phone, or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 12px 12px 44px', borderRadius: '12px', border: '1px solid var(--glass-border)',
                                backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none',
                                fontSize: '14px'
                            }}
                        />
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Student Info</th>
                                <th style={thStyle}>ID Number</th>
                                <th style={thStyle}>Partner Status</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStudents.map((s, i) => {
                                const next = sortedStudents[i + 1];
                                const prev = sortedStudents[i - 1];
                                const isPartnerWithNext = next && (s.partnerPhone === next.phone);
                                const isPartnerWithPrev = prev && (prev.partnerPhone === s.phone);
                                const isStartOfGroup = isPartnerWithNext && !isPartnerWithPrev;
                                const isEndOfGroup = isPartnerWithPrev && !isPartnerWithNext;
                                const inGroup = isPartnerWithNext || isPartnerWithPrev;

                                return (
                                <React.Fragment key={s.phone}>
                                    {isStartOfGroup && i !== 0 && <tr style={{ height: '24px' }}><td colSpan="4"></td></tr>}
                                    <tr 
                                        className="table-row-hover"
                                        style={{ 
                                            backgroundColor: inGroup ? 'rgba(211, 162, 0, 0.04)' : 'transparent',
                                            borderLeft: inGroup ? '4px solid var(--accent-gold)' : '4px solid transparent',
                                            transition: 'var(--transition-smooth)'
                                        }}
                                    >
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                                                    {s.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '600' }}>{s.name}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{s.phone}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>{s.idNo || '—'}</td>
                                        <td style={tdStyle}>
                                            {s.partnerPhone ? (
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ color: 'var(--accent-gold)', fontSize: '12px', fontWeight: '700' }}>Linked</span>
                                                    <span style={{ fontSize: '10px', opacity: 0.5 }}>{s.partnerName}</span>
                                                </div>
                                            ) : (
                                                <span style={{ opacity: 0.4, fontSize: '12px' }}>Unlinked</span>
                                            )}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            {hasWriteAccess ? (
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                                    <button onClick={() => handleEdit(s)} className="action-circle-btn" style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'transparent', color: 'var(--accent-gold)', cursor: 'pointer' }} title="Edit">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => onDelete(s.phone)} className="action-circle-btn" style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'transparent', color: '#ff4d4d', cursor: 'pointer' }} title="Delete">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.5 }}>View Only</span>
                                            )}
                                        </td>
                                    </tr>
                                    {isEndOfGroup && i !== sortedStudents.length - 1 && <tr style={{ height: '24px' }}><td colSpan="4"></td></tr>}
                                </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                    {sortedStudents.length === 0 && (
                        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <AlertCircle size={40} style={{ opacity: 0.1, marginBottom: '10px' }} />
                            <p>No students found matching your search.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal 
                title={editingStudent ? "Edit Student" : "Add New Student"} 
                isOpen={isAddModalOpen || !!editingStudent} 
                onClose={() => { setIsAddModalOpen(false); resetForm(); }}
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold)', textTransform: 'uppercase' }}>Full Name</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                            <input
                                required
                                type="text"
                                placeholder="Student Name"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', outline: 'none' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold)', textTransform: 'uppercase' }}>Phone Number (Used as Unique ID)</label>
                        <div style={{ position: 'relative' }}>
                            <Phone size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                            <input
                                required
                                type="tel"
                                disabled={!!editingStudent}
                                placeholder="e.g. 0912345678"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', backgroundColor: editingStudent ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', outline: 'none' }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold)', textTransform: 'uppercase' }}>ID Number (Optional)</label>
                        <div style={{ position: 'relative' }}>
                            <Hash size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                            <input
                                type="text"
                                placeholder="ID No"
                                value={formData.idNo}
                                onChange={e => setFormData({ ...formData, idNo: e.target.value })}
                                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', outline: 'none' }}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        style={{ 
                            marginTop: '10px', backgroundColor: 'var(--accent-gold)', color: 'var(--bg-primary)', 
                            padding: '14px', borderRadius: '12px', border: 'none', 
                            fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            cursor: 'pointer', transition: '0.2s'
                        }}
                    >
                        <Save size={20} /> {editingStudent ? "Update Student" : "Register Student"}
                    </button>
                </form>
            </Modal>
                </>
            )}
        </div>
    );
};

export default AdminUserManagementTab;
