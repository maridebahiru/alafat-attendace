import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Phone } from 'lucide-react';
import footerImg from '../assets/ELFAZ-01 (2).png';
import singerLogo from '../assets/singer_logo.png';
import { cleanChristianName } from '../utils/studentUtils';

const QRCard = forwardRef(({ studentData, logo }, ref) => {
    const { name, phone, idNo, employeeId, department, profilePhotoUrl, qrToken } = studentData;

    // Ethiopian Geometric Pattern (SVG String for repeating background)
    const borderPattern = `url("data:image/svg+xml,%3Csvg width='40' height='20' viewBox='0 0 40 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 L10 0 L20 10 L10 20 Z M20 10 L30 0 L40 10 L30 20 Z' fill='none' stroke='%23d3a200' stroke-width='2'/%3E%3C/svg%3E")`;

    const qrValue = employeeId || phone || qrToken || JSON.stringify({ name, phone, idNo: employeeId || idNo });

    return (
        <div
            ref={ref}
            style={{
                width: '400px',
                height: '650px',
                backgroundColor: '#fffdf7',
                borderRadius: '16px',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                border: '1px solid #65081b',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {/* Top Section (42%) */}
            <div style={{
                height: '42%',
                backgroundColor: '#65081b',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px 20px',
                zIndex: 1 // Ensure top section is above background but below QR shadow
            }}>
                {/* Decorative Circles/Blobs */}
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '200px', height: '200px', backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '150px', height: '150px', backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: '50%' }} />

                {/* Top Gold Border */}
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    height: '12px',
                    backgroundImage: borderPattern,
                    backgroundRepeat: 'repeat-x'
                }} />

                {/* Logo Section */}
                <div style={{ marginTop: '5px', marginBottom: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px' }}>
                    <img
                        src={logo || "/logo.png"}
                        alt="Logo"
                        style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                        onError={(e) => { e.target.src = "https://placehold.co/85x85/65081b/d3a200?text=Logo"; }}
                    />
                    <img
                        src={singerLogo}
                        alt="Singer Logo"
                        style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                    />
                </div>

                {/* Title */}
                <h1 style={{
                    color: '#d3a200',
                    fontSize: '22px',
                    textAlign: 'center',
                    fontWeight: '900',
                    lineHeight: '1.2',
                    marginTop: '4px',
                    textShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    width: '100%',
                    padding: '0 10px',
                    letterSpacing: '0.5px'
                }}>ኢጃት ድሬ</h1>

                {/* QR Code Container */}
                <div style={{
                    position: 'absolute',
                    bottom: '-40px',
                    backgroundColor: '#fff',
                    padding: '8px',
                    borderRadius: '12px',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                    zIndex: 20,
                    border: '1.5px solid #d3a200'
                }}>
                    <QRCodeSVG
                        value={qrValue}
                        size={110}
                        level="H"
                        includeMargin={false}
                    />
                </div>
            </div>

            {/* Bottom Section (58%) */}
            <div style={{
                height: '58%',
                padding: '50px 30px 10px 30px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                background: 'linear-gradient(45deg, #fffdf7 25%, #f9f6e5 25%, #f9f6e5 50%, #fffdf7 50%, #fffdf7 75%, #f9f6e5 75%, #f9f6e5 100%)',
                backgroundSize: '20px 20px'
            }}>
                <div style={{ position: 'absolute', top: 0, left: 1, right: 0, bottom: 0, opacity: 0.05, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(45deg, #65081b, #65081b 1px, transparent 1px, transparent 10px)' }} />

                {/* Profile Header Row with optional Photo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '12px' }}>
                    {profilePhotoUrl ? (
                        <img
                            src={profilePhotoUrl}
                            alt={name}
                            style={{
                                width: '60px',
                                height: '60px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid #65081b'
                            }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    ) : null}

                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', color: '#65081b', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase' }}>Full Name</label>
                        <div style={{ color: '#65081b', fontSize: '17px', fontWeight: '700' }}>{name}</div>

                        {(employeeId || idNo) && (
                            <div style={{ color: '#d3a200', backgroundColor: '#65081b', display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', marginTop: '3px' }}>
                                ID: {employeeId || idNo}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', color: '#65081b', fontWeight: '800', fontSize: '11px' }}>Phone</label>
                    <div style={{ color: '#65081b', fontSize: '14px', fontWeight: '600' }}>{phone}</div>
                </div>

                {/* Spacer - Reduced to push content up */}
                <div style={{ flexGrow: 1 }} />

                {/* Bottom Decorative Border */}
                <div style={{
                    height: '10px',
                    width: '100%',
                    backgroundImage: borderPattern,
                    backgroundRepeat: 'repeat-x',
                    marginBottom: '8px'
                }} />

                {/* Footer Bar */}
                <div style={{
                    backgroundColor: '#65081b',
                    margin: '0 -40px -10px -40px',
                    padding: '12px 20px',
                    color: '#d3a200',
                    fontSize: '11px',
                    textAlign: 'center',
                    fontWeight: '700',
                    backgroundImage: `url(${footerImg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    minHeight: '60px', // Ensure enough space for background image
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                }}>
                    <div style={{ zIndex: 1, textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
                        <div style={{ fontSize: '13px', fontWeight: '800' }}>ሱባዔ ጉባኤ 4ኛ ትውልድ</div>
                        <div style={{ fontSize: '13px', fontWeight: '700', marginTop: '2px' }}>ድሬዳዋ</div>
                    </div>
                    {/* Add an overlay if the background image is too bright */}
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(101, 8, 27, 0.4)',
                        zIndex: 0
                    }} />
                </div>
            </div>
        </div>

    );
});

export default QRCard;
