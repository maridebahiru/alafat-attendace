import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Lock, Shield, User, Key } from 'lucide-react';

const SUPERADMINS = [
    {
        username: "maramawit@gmail.com",
        password: "maramawit@1221",
        role: "superadmin",
        name: "Maramawit (Super Admin)"
    },
    {
        username: "maramawitdereje93@gmail.com",
        password: "maramawitdereje93@gmail.com",
        role: "superadmin",
        name: "Default Administrator"
    }
];

const AdminLogin = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [attempts, setAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setInterval(() => setCountdown(c => c - 1), 1000);
        } else {
            setIsLocked(false);
        }
        return () => clearInterval(timer);
    }, [countdown]);

    // Ensure super admin account is initialized in Firestore
    useEffect(() => {
        const seedSuperAdmin = async () => {
            try {
                const superAdminDocRef = doc(db, 'admins', 'maramawit@gmail.com');
                const snap = await getDoc(superAdminDocRef);
                if (!snap.exists()) {
                    await setDoc(superAdminDocRef, {
                        username: 'maramawit@gmail.com',
                        password: 'maramawit@1221',
                        role: 'superadmin',
                        name: 'Maramawit (Super Admin)',
                        createdAt: serverTimestamp()
                    });
                }
            } catch (err) {
                console.warn('[AdminLogin] Super admin seeding check:', err);
            }
        };
        seedSuperAdmin();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (isLocked) return;
        setError('');
        setLoading(true);

        const inputUser = username.trim().toLowerCase();
        const inputPass = password.trim();

        try {
            let authenticatedAdmin = null;

            // 1. Direct match with configured Super Admins
            const directSuperAdminMatch = SUPERADMINS.find(
                sa => sa.username.toLowerCase() === inputUser && sa.password === inputPass
            );
            if (directSuperAdminMatch) {
                authenticatedAdmin = {
                    username: directSuperAdminMatch.username,
                    role: 'superadmin',
                    name: directSuperAdminMatch.name
                };
                // Ensure synced to Firestore
                try {
                    await setDoc(doc(db, 'admins', directSuperAdminMatch.username), {
                        username: directSuperAdminMatch.username,
                        password: directSuperAdminMatch.password,
                        name: directSuperAdminMatch.name,
                        role: 'superadmin',
                        createdAt: serverTimestamp()
                    }, { merge: true });
                } catch {
                    // ignore if network unavailable
                }
            }

            // 2. Query Firestore 'admins' collection
            if (!authenticatedAdmin) {
                const adminsCol = collection(db, 'admins');
                const q = query(adminsCol, where('username', '==', inputUser));
                const querySnap = await getDocs(q);

                if (!querySnap.empty) {
                    const adminDoc = querySnap.docs[0].data();
                    if (adminDoc.password === inputPass || adminDoc.passwordHash === inputPass) {
                        authenticatedAdmin = {
                            username: inputUser,
                            role: adminDoc.role || 'superadmin',
                            name: adminDoc.name || inputUser
                        };
                    }
                } else {
                    const directDoc = await getDoc(doc(db, 'admins', inputUser));
                    if (directDoc.exists()) {
                        const adminDoc = directDoc.data();
                        if (adminDoc.password === inputPass || adminDoc.passwordHash === inputPass) {
                            authenticatedAdmin = {
                                username: inputUser,
                                role: adminDoc.role || 'superadmin',
                                name: adminDoc.name || inputUser
                            };
                        }
                    }
                }
            }

            if (authenticatedAdmin) {
                sessionStorage.setItem('isAdminAuth', 'true');
                sessionStorage.setItem('adminUser', JSON.stringify(authenticatedAdmin));
                onLoginSuccess();
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                setError('Invalid username or password.');

                const card = document.getElementById('lock-card');
                card?.classList.add('shake');
                setTimeout(() => card?.classList.remove('shake'), 500);

                if (newAttempts >= 5) {
                    setIsLocked(true);
                    setCountdown(30);
                    setError('Too many failed attempts. Locked for 30s.');
                }
            }
        } catch (err) {
            console.error("Admin login error:", err);
            // Fallback match check for offline/interrupted scenarios
            const fallbackMatch = SUPERADMINS.find(
                sa => sa.username.toLowerCase() === inputUser && sa.password === inputPass
            );
            if (fallbackMatch) {
                const fallbackAdmin = { username: fallbackMatch.username, role: 'superadmin', name: fallbackMatch.name };
                sessionStorage.setItem('isAdminAuth', 'true');
                sessionStorage.setItem('adminUser', JSON.stringify(fallbackAdmin));
                onLoginSuccess();
            } else {
                setError('Authentication service error. Please check credentials.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#1a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
        }}>
            <style>
                {`
        .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}
            </style>
            <div id="lock-card" style={{
                backgroundColor: '#2a0f18', padding: '40px 30px', borderRadius: '20px',
                width: '100%', maxWidth: '420px', textAlign: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)', border: '1px solid rgba(211, 162, 0, 0.2)'
            }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(211,162,0,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                    color: '#d3a200', border: '1px solid rgba(211,162,0,0.3)'
                }}>
                    <Shield size={32} />
                </div>

                <h2 style={{ color: '#d3a200', marginBottom: '8px', fontSize: '1.4rem', fontWeight: '800' }}>Admin Authentication</h2>
                <p style={{ color: '#f5e6c8', opacity: 0.7, marginBottom: '24px', fontSize: '13px' }}>Restricted access for system administrators & scanners.</p>

                <form onSubmit={handleLogin}>
                    <div style={{ textTransform: 'none', marginBottom: '16px', textAlign: 'left' }}>
                        <label style={{ display: 'block', color: '#d3a200', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>Username / Email</label>
                        <input
                            type="text"
                            required
                            placeholder="maramawit@gmail.com"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={isLocked}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #65081b',
                                backgroundColor: '#1a0a0f', color: '#f5e6c8', outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                        <label style={{ display: 'block', color: '#d3a200', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>Password</label>
                        <input
                            type="password"
                            required
                            placeholder="Enter Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLocked}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #65081b',
                                backgroundColor: '#1a0a0f', color: '#f5e6c8', outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLocked || loading}
                        style={{
                            width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                            backgroundColor: '#d3a200', color: '#1a0a0f', fontWeight: '800',
                            cursor: isLocked || loading ? 'not-allowed' : 'pointer', fontSize: '15px'
                        }}
                    >
                        {isLocked ? `Locked (${countdown}s)` : (loading ? 'Authenticating...' : 'Unlock Console')}
                    </button>
                </form>

                {error && <p style={{ color: '#ff4d4d', marginTop: '16px', fontSize: '13px' }}>⚠️ {error}</p>}
            </div>
        </div>
    );
};

export default AdminLogin;
