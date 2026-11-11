import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudentByIdentifier, ensureQrToken } from '../utils/studentUtils';
import logo from '../assets/logo.png';
import singerLogo from '../assets/singer_logo.png';
import { ArrowRight } from 'lucide-react';

const Login = () => {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        if (!identifier.trim()) {
            setError('Please enter your Phone Number or ID');
            return;
        }

        setLoading(true);
        try {
            const student = await getStudentByIdentifier(identifier);
            if (!student) {
                setError('No student found matching this Phone Number or ID. Please verify or register via the official registration form.');
                setLoading(false);
                return;
            }

            // Ensure permanent QR token exists for this student
            const studentWithToken = await ensureQrToken(student);

            // Save active session
            sessionStorage.setItem('currentStudent', JSON.stringify(studentWithToken));
            navigate('/dashboard');
        } catch (err) {
            console.error('Login error:', err);
            setError('An error occurred while logging in. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backgroundColor: '#1a0a0f',
            backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(101, 8, 27, 0.4), transparent 70%)'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '460px',
                backgroundColor: '#2a0f18',
                borderRadius: '20px',
                padding: '40px 30px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                border: '1px solid rgba(211, 162, 0, 0.2)',
                textAlign: 'center'
            }}>
                {/* Logo & Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '20px',
                    marginBottom: '20px'
                }}>
                    <img src={logo} alt="Logo" style={{ height: '80px', maxWidth: '120px', objectFit: 'contain' }} />
                    <div style={{ width: '1px', height: '55px', backgroundColor: 'rgba(211, 162, 0, 0.25)' }} />
                    <img src={singerLogo} alt="Singer Logo" style={{ height: '80px', maxWidth: '120px', objectFit: 'contain' }} />
                </div>

                <h2 style={{
                    color: '#d3a200',
                    fontSize: '1.4rem',
                    fontWeight: '800',
                    marginBottom: '8px',
                    lineHeight: '1.3'
                }}>
                    ኢጃት ድሬ
                </h2>
                <p style={{ color: '#f5e6c8', opacity: 0.8, fontSize: '0.9rem', marginBottom: '30px' }}>
                    Singer Attendance Portal
                </p>

                {/* Login Form */}
                <form onSubmit={handleLogin}>
                    <div style={{ textAlign: 'left', marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#d3a200', fontSize: '13px', fontWeight: '700', marginBottom: '8px' }}>
                            Phone Number or ID
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                required
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="e.g. 0911223344 or EJAT-00"
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    borderRadius: '10px',
                                    border: '1px solid #65081b',
                                    backgroundColor: '#1a0a0f',
                                    color: '#f5e6c8',
                                    fontSize: '15px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            backgroundColor: 'rgba(255, 77, 77, 0.1)',
                            border: '1px solid #ff4d4d',
                            color: '#ff4d4d',
                            padding: '12px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            marginBottom: '20px',
                            textAlign: 'left'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: '#d3a200',
                            color: '#1a0a0f',
                            fontSize: '16px',
                            fontWeight: '800',
                            cursor: loading ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            opacity: loading ? 0.7 : 1,
                            transition: '0.2s'
                        }}
                    >
                        {loading ? 'Verifying...' : <>Access Dashboard <ArrowRight size={18} /></>}
                    </button>
                </form>


            </div>
        </div>
    );
};

export default Login;
