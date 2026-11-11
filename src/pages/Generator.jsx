import React, { useState, useRef } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import QRCard from '../components/QRCard';
import html2canvas from 'html2canvas';
import logo from '../assets/logo.png';
import { ensureQrToken } from '../utils/studentUtils';
import { Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Generator = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        employeeId: '',
        department: '',
        position: '',
        email: '',
        profilePhotoUrl: ''
    });
    const [studentData, setStudentData] = useState(null);
    const [loading, setLoading] = useState(false);
    const cardRef = useRef(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const cleanPhone = formData.phone.trim().replace(/[^\d+]/g, '');
        const cleanId = formData.employeeId.trim();
        if (!cleanPhone && !cleanId) {
            alert("Please provide at least a Phone Number or Singer ID");
            return;
        }
        if (cleanPhone && cleanPhone.length < 10) {
            alert("Phone number must be at least 10 digits");
            return;
        }
        setLoading(true);

        try {
            const docId = cleanPhone || cleanId;
            const studentDoc = {
                name: formData.name.trim(),
                phone: cleanPhone || '',
                employeeId: cleanId || cleanPhone,
                idNo: cleanId || cleanPhone,
                memberId: cleanId || cleanPhone,
                department: formData.department.trim() || 'Choir',
                position: formData.position.trim() || 'Singer',
                email: formData.email.trim(),
                profilePhotoUrl: formData.profilePhotoUrl.trim(),
                createdAt: serverTimestamp()
            };

            // Upsert to Firestore using docId
            await setDoc(doc(db, "students", docId), studentDoc);

            // Ensure QR token exists
            const withToken = await ensureQrToken(studentDoc);
            setStudentData(withToken);
        } catch (error) {
            console.error("Error saving student:", error);
            alert("Error saving student data to Firebase");
        } finally {
            setLoading(false);
        }
    };

    const downloadCard = async () => {
        if (!cardRef.current) return;
        const canvas = await html2canvas(cardRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: null
        });
        const link = document.createElement('a');
        link.download = `ID_${studentData.employeeId || studentData.phone}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const [bulkMembers, setBulkMembers] = useState(() => {
        try {
            const raw = sessionStorage.getItem('bulkCreatedMembers');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    const resetForm = () => {
        setStudentData(null);
        setFormData({
            name: '', phone: '', employeeId: '',
            department: '', position: '', email: '', profilePhotoUrl: ''
        });
    };

    if (studentData) {
        return (
            <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <QRCard ref={cardRef} studentData={studentData} logo={logo} />

                <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
                    <button
                        onClick={downloadCard}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#d3a200',
                            color: '#1a0a0f',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: '0 4px 10px rgba(211, 162, 0, 0.3)'
                        }}
                    >
                        ⬇ Download Card as PNG
                    </button>
                    <button
                        onClick={resetForm}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: 'transparent',
                            color: '#d3a200',
                            border: '2px solid #d3a200',
                            borderRadius: '8px',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >
                        Register Another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
            <button
                onClick={() => navigate('/')}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    backgroundColor: 'transparent', border: 'none', color: '#d3a200',
                    cursor: 'pointer', fontWeight: '700', marginBottom: '20px'
                }}
            >
                <ArrowLeft size={18} /> Back to Login
            </button>

            {/* Quick Card Selector for Bulk Created Members */}
            {bulkMembers.length > 0 && (
                <div style={{
                    marginBottom: '24px',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(211, 162, 0, 0.1)',
                    border: '1px solid var(--accent-gold)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '800', color: 'var(--accent-gold)', fontSize: '14px' }}>
                            ✨ Bulk Upload Batch: {bulkMembers.length} Members Ready for ID Cards
                        </span>
                        <button
                            onClick={() => {
                                sessionStorage.removeItem('bulkCreatedMembers');
                                setBulkMembers([]);
                            }}
                            style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '12px' }}
                        >
                            Dismiss
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxHeight: '130px', overflowY: 'auto' }}>
                        {bulkMembers.map((m, idx) => (
                            <button
                                key={m.memberId || idx}
                                type="button"
                                onClick={() => {
                                    setStudentData({
                                        name: m.fullName,
                                        phone: m.phone || '',
                                        employeeId: m.memberId,
                                        idNo: m.displayId || m.memberId,
                                        memberId: m.memberId,
                                        department: m.group || 'Choir',
                                        position: 'Singer',
                                        qrToken: m.memberId
                                    });
                                }}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(211,162,0,0.3)',
                                    backgroundColor: 'rgba(0,0,0,0.3)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '600'
                                }}
                            >
                                {m.displayId || m.memberId} - {m.fullName}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '16px' }}>
                    <img src={logo} alt="Logo" style={{ height: '80px', objectFit: 'contain' }} />
                </div>
                <h1 style={{ color: '#d3a200', fontSize: '1.4rem', marginBottom: '8px', fontWeight: '800' }}>
                    ኢጃት ድሬ
                </h1>
                <p style={{ color: '#f5e6c8', opacity: 0.8, fontSize: '0.9rem' }}>
                    Manual Student Registration (Admin Fallback)
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                style={{
                    backgroundColor: '#2a0f18',
                    padding: '30px',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                    border: '1px solid rgba(211, 162, 0, 0.15)'
                }}
            >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#d3a200', fontSize: '13px', fontWeight: '600' }}>Full Name *</label>
                        <input
                            type="text"
                            required
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #65081b',
                                backgroundColor: '#1a0a0f', color: '#f5e6c8', outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#d3a200', fontSize: '13px', fontWeight: '600' }}>Phone Number *</label>
                        <input
                            type="tel"
                            required
                            placeholder="0911223344"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #65081b',
                                backgroundColor: '#1a0a0f', color: '#f5e6c8', outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#d3a200', fontSize: '13px', fontWeight: '600' }}>ID</label>
                        <input
                            type="text"
                            placeholder="EJAT-00"
                            value={formData.employeeId}
                            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #65081b',
                                backgroundColor: '#1a0a0f', color: '#f5e6c8', outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#d3a200', fontSize: '13px', fontWeight: '600' }}>Department</label>
                        <input
                            type="text"
                            placeholder="Engineering / Choir"
                            value={formData.department}
                            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #65081b',
                                backgroundColor: '#1a0a0f', color: '#f5e6c8', outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#d3a200', fontSize: '13px', fontWeight: '600' }}>Position (Optional)</label>
                        <input
                            type="text"
                            placeholder="Member / Team Lead"
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #65081b',
                                backgroundColor: '#1a0a0f', color: '#f5e6c8', outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#d3a200', fontSize: '13px', fontWeight: '600' }}>Email (Optional)</label>
                        <input
                            type="email"
                            placeholder="student@example.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #65081b',
                                backgroundColor: '#1a0a0f', color: '#f5e6c8', outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', color: '#d3a200', fontSize: '13px', fontWeight: '600' }}>Profile Photo URL (Optional)</label>
                    <input
                        type="url"
                        placeholder="https://example.com/photo.jpg"
                        value={formData.profilePhotoUrl}
                        onChange={(e) => setFormData({ ...formData, profilePhotoUrl: e.target.value })}
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #65081b',
                            backgroundColor: '#1a0a0f', color: '#f5e6c8', outline: 'none', boxSizing: 'border-box'
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
                        backgroundColor: '#d3a200', color: '#1a0a0f', fontWeight: '800',
                        fontSize: '1rem', cursor: 'pointer', transition: '0.2s',
                        opacity: loading ? 0.7 : 1
                    }}
                >
                    {loading ? 'Processing...' : 'Register Student & Generate Card'}
                </button>
            </form>
        </div>
    );
};

export default Generator;
