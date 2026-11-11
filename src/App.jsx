import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import Admin from './pages/Admin';

function App() {
  return (
    <Router>
      <div style={{ minHeight: '100vh', backgroundColor: '#1a0a0f', color: '#f5e6c8' }}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/bulk-upload" element={<Admin defaultTab="bulk-upload" />} />
          <Route path="/register" element={<Generator />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
