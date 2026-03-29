import React, { useState, useEffect } from 'react';
import { doc, setDoc, collection, getDocs, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { InfoTooltip } from '../App';

export default function Settings({ user, settings, setSettings }) {
  const [formData, setFormData] = useState({
    companyName: '', address: '', logo: '', currency: '$',
    lowStockThreshold: 5, taxRate: 0
  });
  const [isEditing, setIsEditing] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (settings && !isEditing) {
      setFormData({
        companyName: settings.companyName || '',
        address: settings.address || '',
        logo: settings.logo || '',
        currency: settings.currency || '$',
        lowStockThreshold: settings.lowStockThreshold ?? 5,
        taxRate: settings.taxRate ?? 0
      });
    }
  }, [settings, isEditing]);

  const handleSave = async () => {
    if (!user) return;
    const docRef = doc(db, `businesses/${user.uid}/data/settings`);
    await setDoc(docRef, formData, { merge: true });
    setSettings(formData);
    setIsEditing(false);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, logo: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleResetAllData = async () => {
    const c1 = window.confirm('⚠️ WARNING: This permanently deletes ALL Sales, Expenses, and Inventory. Cannot be undone. Are you sure?');
    if (!c1) return;
    const c2 = window.confirm('Final confirmation: Reset everything to zero?');
    if (!c2) return;
    try {
      setResetting(true);
      const batch = writeBatch(db);
      for (const col of ['sales', 'expenses', 'inventory', 'stockAdjustments']) {
        const snap = await getDocs(collection(db, `businesses/${user.uid}/${col}`));
        snap.docs.forEach(d => batch.delete(d.ref));
      }
      await batch.commit();
      alert('All data cleared. Dashboard is now at zero.');
    } catch (err) {
      alert('Reset failed: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  const inputStyle = { width: '100%', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontWeight: '500' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' }}>

      {/* Company Profile */}
      <div className="glass-panel animate-fade-in" style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '22px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          Company Profile & App Preferences
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '12px', background: formData.logo ? `url(${formData.logo}) center/cover` : 'rgba(255,255,255,0.05)', border: '2px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {!formData.logo && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No Logo</span>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Company Logo</label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={!isEditing} style={{ color: 'var(--text-main)' }} />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Appears on printed A4 reports.</p>
            </div>
          </div>

          {/* Currency */}
          <div>
            <label style={labelStyle}>Currency Symbol <InfoTooltip text="This symbol will appear next to all prices and on receipts (e.g. $, €, ₦)." /></label>
            <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })} disabled={!isEditing} style={{ ...inputStyle, height: '46px' }}>
              <option value="$">$ (USD / AUD / CAD)</option>
              <option value="€">€ (EUR)</option>
              <option value="£">£ (GBP)</option>
              <option value="₦">₦ (NGN - Nigerian Naira)</option>
              <option value="₹">₹ (INR)</option>
              <option value="R">R (ZAR)</option>
              <option value="Ksh">Ksh (KES)</option>
              <option value="GH₵">GH₵ (GHS)</option>
            </select>
          </div>

          {/* Company Name */}
          <div>
            <label style={labelStyle}>Company Name</label>
            <input type="text" value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} disabled={!isEditing} style={inputStyle} />
          </div>

          {/* Address */}
          <div>
            <label style={labelStyle}>Company Address</label>
            <textarea rows="3" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} disabled={!isEditing} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* Low Stock Threshold */}
          <div>
            <label style={labelStyle}>Low Stock Alert Threshold (units) <InfoTooltip text="Dashboard will flag any product with stock at or below this number." /></label>
            <input type="number" min="1" value={formData.lowStockThreshold} onChange={e => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })} disabled={!isEditing} style={inputStyle} />
          </div>

          {/* VAT / Tax Rate */}
          <div>
            <label style={labelStyle}>VAT / Tax Rate (%) <InfoTooltip text="Set to 0 to disable tax. When set, VAT is shown in the POS cart and on receipts." /></label>
            <input type="number" min="0" max="100" step="0.1" value={formData.taxRate} onChange={e => setFormData({ ...formData, taxRate: Number(e.target.value) })} disabled={!isEditing} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
            {isEditing ? (
              <>
                <button onClick={() => setIsEditing(false)} style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--glass-border)', cursor: 'pointer', borderRadius: '8px' }}>Cancel</button>
                <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Save Profile</button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} style={{ padding: '10px 24px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Edit Profile</button>
            )}
          </div>
        </div>
      </div>

      {/* Staff Management (Owner only) */}
      {user.role === 'admin' && (
        <StaffManager user={user} />
      )}

      {/* Danger Zone */}
      <div className="glass-panel" style={{ padding: '32px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
        <h3 style={{ fontSize: '22px', marginBottom: '8px', color: 'var(--danger)' }}>⚠️ Danger Zone</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>Permanent actions that cannot be undone.</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(239,68,68,0.08)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div>
            <p style={{ fontWeight: '600', color: '#fff', marginBottom: '4px' }}>Reset All Business Data</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Deletes all Sales, Expenses, Inventory and Stock Adjustments.</p>
          </div>
          <button onClick={handleResetAllData} disabled={resetting}
            style={{ marginLeft: '20px', flexShrink: 0, padding: '10px 20px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '8px', cursor: resetting ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: resetting ? 0.6 : 1 }}>
            {resetting ? 'Clearing...' : 'Reset All Data'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffManager({ user }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('cashier');
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, `businesses/${user.uid}/staff`), snap => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user.uid]);

  const addStaff = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      // 1. Root-level invite for Auth lookup
      const globalRef = doc(db, 'staffInvites', cleanEmail);
      batch.set(globalRef, { 
        businessId: user.uid, 
        businessName: user.name || user.email, // Use business name if available
        role: role, 
        inviterEmail: user.email 
      });
      
      // 2. Business-level record for management
      const localRef = doc(db, `businesses/${user.uid}/staff`, cleanEmail);
      batch.set(localRef, { 
        email: cleanEmail, 
        role: role, 
        status: 'pending',
        addedAt: new Date().toISOString() 
      });
      
      await batch.commit();
      setEmail('');
      alert(`Success! Invitation sent to ${cleanEmail} as ${role}.`);
    } catch (err) {
      alert('Failed to add staff: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeStaff = async (staffEmail) => {
    if (!window.confirm(`Remove access for ${staffEmail}?`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'staffInvites', staffEmail));
      batch.delete(doc(db, `businesses/${user.uid}/staff`, staffEmail));
      await batch.commit();
    } catch (err) { alert('Error: ' + err.message); }
  };

  return (
    <div className="glass-panel" style={{ padding: '32px', marginBottom: '24px' }}>
      <h3 style={{ fontSize: '22px', marginBottom: '8px' }}>Staff Management <InfoTooltip text="Invite others to help manage your business. Admins have full access, while Cashiers can only perform sales." /></h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Authorize others to access your business. You can grant full Admin rights or restricted Cashier access.</p>
      
      <form onSubmit={addStaff} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
        <input required type="email" placeholder="Staff Email Address" value={email} onChange={e => setEmail(e.target.value)} 
          style={{ flex: '1 1 200px', padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff' }} />
        
        <select value={role} onChange={e => setRole(e.target.value)}
          style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}>
          <option value="cashier" style={{ background: '#1a1a1a' }}>Cashier (Sales only)</option>
          <option value="admin" style={{ background: '#1a1a1a' }}>Admin (Full Access)</option>
        </select>

        <button type="submit" disabled={loading}
          style={{ padding: '12px 24px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          {loading ? '...' : 'Send Invite'}
        </button>
      </form>

      {invites.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Authorized Staff</p>
          {invites.map(inv => (
            <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <div>
                <p style={{ fontWeight: '600', color: '#fff', fontSize: '14px' }}>{inv.email}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Role: Cashier · Added {new Date(inv.addedAt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => removeStaff(inv.email)} style={{ background: 'transparent', color: 'var(--danger)', border: 'none', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>Remove Access</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

