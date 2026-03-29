import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const friendlyErrors = {
    'auth/invalid-credential':     'Incorrect email or password. Please try again.',
    'auth/user-not-found':         'No account found with that email. Please sign up first.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/email-already-in-use':   'An account with this email already exists. Try logging in instead.',
    'auth/weak-password':          'Password is too weak. Please use at least 6 characters.',
    'auth/invalid-email':          "That email address doesn't look right. Please check and try again.",
    'auth/too-many-requests':      'Too many failed attempts. Please wait a few minutes and try again.',
    'auth/network-request-failed': 'No internet connection. Please check your network and try again.',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);

    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        setSuccess('Password reset email sent! Check your inbox, then come back to log in.');
      } else if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess();
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const { user } = cred;
        
        // Always create a default admin profile for new users
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          businessId: user.uid,
          role: 'admin',
          createdAt: new Date().toISOString()
        });

        await setDoc(doc(db, 'businesses', user.uid), {
          email: user.email,
          createdAt: new Date().toISOString()
        }, { merge: true });

        onAuthSuccess();
      }
    } catch (err) {
      setError(friendlyErrors[err.code] || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(''); setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const { user } = cred;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // Create default profile for new Google users
        await setDoc(userRef, {
          email: user.email,
          businessId: user.uid,
          role: 'admin',
          createdAt: new Date().toISOString()
        });
        
        await setDoc(doc(db, 'businesses', user.uid), {
          email: user.email,
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
      
      onAuthSuccess();
    } catch (err) {
      setError(friendlyErrors[err.code] || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid var(--glass-border)',
    borderRadius: '8px', color: '#fff', fontSize: '15px', outline: 'none', boxSizing: 'border-box'
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-dark)' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '28px', color: '#fff', margin: '0 auto 16px' }}>B</div>
        <h2 style={{ marginBottom: '6px' }}>BAS Accounting</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '28px', fontSize: '14px' }}>
          {mode === 'login'  ? 'Sign in to your dashboard'         :
           mode === 'signup' ? 'Create your account — free forever' :
                               'Reset your password'}
        </p>

        {error   && <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', textAlign: 'left' }}>{error}</div>}
        {success && <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', textAlign: 'left' }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input type="email" placeholder="Email Address" required value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          {mode !== 'reset' && (
            <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
          )}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px', marginTop: '4px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Please wait...' :
             mode === 'login'  ? 'Login to Dashboard' :
             mode === 'signup' ? 'Create Account'     :
                                 'Send Reset Email'}
          </button>
        </form>

        {/* Divider + Google Button — only on login/signup screens */}
        {mode !== 'reset' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0 0 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
            </div>
            <button onClick={handleGoogleSignIn} disabled={googleLoading}
              style={{ width: '100%', marginTop: '12px', padding: '13px', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: googleLoading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: googleLoading ? 0.7 : 1 }}>
              <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.5 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.5 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.4 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8H6.1C9.5 35.6 16.3 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.2C41.1 35.2 44 30 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
              {googleLoading ? 'Signing in...' : 'Continue with Google'}
            </button>
          </>
        )}

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {mode === 'login' && (
            <>
              <span onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
                style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}>
                Forgot your password? <span style={{ color: 'var(--accent)', fontWeight: '500' }}>Reset it</span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Don't have an account?{' '}
                <span onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                  style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: '500' }}>Sign Up</span>
              </span>
            </>
          )}
          {mode !== 'login' && (
            <span onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px' }}>
              ← Back to Login
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
