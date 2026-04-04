import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import Auth from './components/Auth';
import Settings from './components/Settings';
import logo from './assets/logo.png';

import Inventory from './components/Inventory';
import Sales from './components/Sales';
import Dashboard from './components/Dashboard';
import Reports from './components/Reports';
import SalesHistory from './components/SalesHistory';
import { PrivacyPolicy, TermsOfService } from './components/Legal';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [legalView, setLegalView] = useState(null); // 'privacy' | 'terms' | null
  const [userProfile, setUserProfile] = useState(null); // { businessId, role }
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [globalSettings, setGlobalSettings] = useState({ currency: '$' });
  const [pendingInvite, setPendingInvite] = useState(null);

  // Hash Routing for Privacy & Terms
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash.toLowerCase();
      if (h === '#privacy') setLegalView('privacy');
      else if (h === '#terms') setLegalView('terms');
      else setLegalView(null);
    };
    handleHash();
    window.addEventListener('hashchange', () => handleHash());
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    let profileUnsub = null;
    let inviteUnsub = null;

    const authUnsub = onAuthStateChanged(auth, async (u) => {
      // Cleanup previous listeners if user changes
      if (profileUnsub) profileUnsub();
      if (inviteUnsub) inviteUnsub();

      if (u) {
        setUser(u);
        
        // 1. Listen to User Profile (Real-time)
        const profRef = doc(db, 'users', u.uid);
        profileUnsub = onSnapshot(profRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setUserProfile({ businessId: data.businessId || u.uid, role: data.role || 'admin' });
          } else {
            // Initial/Old user fallback
            setUserProfile({ businessId: u.uid, role: 'admin' });
          }
        });

        // 2. Check for invitations (Real-time listener for current user email)
        const inviteRef = doc(db, 'staffInvites', u.email.toLowerCase());
        inviteUnsub = onSnapshot(inviteRef, (snap) => {
          if (snap.exists()) {
            setPendingInvite({ id: snap.id, ...snap.data() });
          } else {
            setPendingInvite(null);
          }
        });

        // 3. Fetch Initial Business Settings (One-time or could be real-time)
        // We'll update this once the profile is confirmed
      } else {
        setUser(null);
        setUserProfile(null);
        setPendingInvite(null);
      }
      setLoadingConfig(false);
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
      if (inviteUnsub) inviteUnsub();
    };
  }, []);

  // Fetch settings once businessId is known
  useEffect(() => {
    if (!userProfile?.businessId) return;
    const fetchSettings = async () => {
      const setRef = doc(db, `businesses/${userProfile.businessId}/data/settings`);
      const setSnap = await getDoc(setRef);
      if (setSnap.exists()) {
        setGlobalSettings(prev => ({ ...prev, ...setSnap.data() }));
      }
    };
    fetchSettings();
  }, [userProfile?.businessId]);

  const acceptInvite = async () => {
    if (!pendingInvite || !user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        businessId: pendingInvite.businessId,
        role: pendingInvite.role,
        joinedAt: new Date().toISOString()
      }, { merge: true });
      await deleteDoc(doc(db, 'staffInvites', user.email.toLowerCase()));
      setPendingInvite(null);
    } catch (err) {
      alert("Failed to join: " + err.message);
    }
  };

  const declineInvite = async () => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'staffInvites', user.email.toLowerCase()));
      setPendingInvite(null);
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // Handle auto-tab switching for restricted roles
  useEffect(() => {
    if (userProfile?.role === 'cashier') {
      const restricted = ['dashboard', 'inventory', 'history', 'reports', 'settings'];
      if (restricted.includes(activeTab)) {
        setActiveTab('sales');
      }
    }
  }, [userProfile?.role, activeTab]);

  if (loadingConfig) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-dark)', color: '#fff' }}>Loading secure environment...</div>;
  }

  // Render Legal Views (Publicly Accessible)
  if (legalView === 'privacy') return <div style={{ background: 'var(--bg-dark)', minHeight: '100vh', padding: '1px' }}><PrivacyPolicy onBack={() => { window.location.hash = ''; setLegalView(null); }} /></div>;
  if (legalView === 'terms') return <div style={{ background: 'var(--bg-dark)', minHeight: '100vh', padding: '1px' }}><TermsOfService onBack={() => { window.location.hash = ''; setLegalView(null); }} /></div>;

  if (!user) return <Auth onAuthSuccess={() => {}} />;

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100vw', position: 'relative' }}>
      {/* Invitation Modal */}
      {pendingInvite && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel scale-in" style={{ maxWidth: '440px', width: '100%', padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>✉️</div>
            <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Business Invitation</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', marginBottom: '32px' }}>
              <strong>{pendingInvite.inviterEmail}</strong> has invited you to join 
              <span style={{ color: '#fff', fontWeight: 'bold' }}> {pendingInvite.businessName || 'their business'}</span> as a 
              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}> {pendingInvite.role}</span>.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={declineInvite} style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>Decline</button>
              <button onClick={acceptInvite} style={{ flex: 1, padding: '14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>Accept & Join</button>
            </div>
            <p style={{ marginTop: '24px', fontSize: '12px', color: 'rgba(239,68,68,0.7)' }}>Note: Accepting will switch your account to this business.</p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="glass-panel sidebar-nav" style={{ width: '260px', margin: '16px', display: 'flex', flexDirection: 'column', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '36px' }}>
          <img src={logo} alt="BAS Logo" style={{ width: '54px', height: '54px', objectFit: 'contain', marginRight: '14px' }} />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px' }}>BAS</h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Accounting Software
            </p>
          </div>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['dashboard', 'inventory', 'sales', 'history', 'reports', 'settings'].map(tab => {
            const isCashier = userProfile?.role === 'cashier';
            const restricted = ['dashboard', 'inventory', 'history', 'reports', 'settings'].includes(tab);
            if (isCashier && restricted) return null;

            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  border: '1px solid transparent',
                  borderColor: activeTab === tab ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                  color: activeTab === tab ? 'var(--primary)' : 'var(--text-main)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  fontWeight: activeTab === tab ? '600' : '400',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '18px' }}>
                    {tab === 'dashboard' ? '📊' : tab === 'inventory' ? '📦' : tab === 'sales' ? '💰' : tab === 'history' ? '🧾' : tab === 'reports' ? '📈' : '⚙️'}
                  </span>
                  {tab}
                </div>
              </button>
            );
          })}
        </nav>
        
        <button 
          onClick={() => signOut(auth)}
          style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: 'none', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '16px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px' }}>🚪</span> Logout
        </button>
        <div style={{
          marginTop: '12px',
          borderTop: '1px solid var(--glass-border)',
          paddingTop: '16px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          textAlign: 'center',
          letterSpacing: '0.3px',
          lineHeight: '1.6'
        }}>
          <p style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '10px', marginBottom: '4px' }}>Developed by</p>
          <p style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '12px' }}>Martins Kingsley Chigozie</p>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '16px 16px 16px 0', overflow: 'hidden' }}>
        <div className="glass-panel main-content-area" style={{ height: '100%', padding: '32px', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <header className="main-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '28px', textTransform: 'capitalize', fontWeight: '700', color: '#fff' }}>
                {activeTab}
              </h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Overview and management</p>
            </div>
            {activeTab !== 'sales' && activeTab !== 'reports' && (
              <button 
                onClick={() => setActiveTab('sales')}
                className="glass-panel" style={{ 
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', 
                color: '#fff', border: 'none', padding: '12px 24px', 
                cursor: 'pointer', fontWeight: '600', fontSize: '14px' 
              }}>
                + New Invoice
              </button>
            )}
          </header>

          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '32px' }}>
            {/* Augmented user object with businessId and role */}
            {(() => {
              const augmentedUser = { ...user, uid: userProfile?.businessId || user.uid, actualUid: user.uid, role: userProfile?.role || 'admin' };
              
              if (activeTab === 'dashboard') return <Dashboard user={augmentedUser} settings={globalSettings} />;
              if (activeTab === 'inventory') return <Inventory user={augmentedUser} settings={globalSettings} />;
              if (activeTab === 'sales') return <Sales user={augmentedUser} settings={globalSettings} />;
              if (activeTab === 'history') return <SalesHistory user={augmentedUser} settings={globalSettings} />;
              if (activeTab === 'reports') return <Reports user={augmentedUser} settings={globalSettings} />;
              if (activeTab === 'settings') return <Settings user={augmentedUser} settings={globalSettings} setSettings={setGlobalSettings} />;
              return null;
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}

export function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);

  return (
    <div 
      onMouseEnter={() => setShow(true)} 
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow(!show)}
      style={{ position: 'relative', display: 'inline-block', marginLeft: '6px', cursor: 'help' }}
    >
      <span style={{ 
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '16px', height: '16px', borderRadius: '50%', 
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
        fontSize: '10px', color: 'var(--text-muted)'
      }}>?</span>
      
      {show && (
        <div className="glass-panel animate-fade-in" style={{ 
          position: 'absolute', bottom: '125%', left: '50%', transform: 'translateX(-50%)',
          width: '200px', padding: '10px 14px', zIndex: 2000, 
          fontSize: '12px', lineHeight: '1.4', color: '#fff',
          background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--glass-border)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
        }}>
          {text}
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', border: '6px solid transparent', borderTopColor: 'rgba(15, 23, 42, 0.95)' }} />
        </div>
      )}
    </div>
  );
}

export default App;
