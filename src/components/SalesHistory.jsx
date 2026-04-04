import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// ── Date helpers ─────────────────────────────────────────────────────────────
const tod     = () => new Date().toISOString().split('T')[0];
const yest    = () => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; };
const wkStart = (off=0) => { const d=new Date(); d.setDate(d.getDate()-d.getDay()+off*7); return d.toISOString().split('T')[0]; };
const wkEnd   = (off=0) => { const d=new Date(); d.setDate(d.getDate()-d.getDay()+6+off*7); return d.toISOString().split('T')[0]; };
const yrStart = (off=0) => `${new Date().getFullYear()+off}-01-01`;
const yrEnd   = (off=0) => `${new Date().getFullYear()+off}-12-31`;

const PRESETS = [
  { label: 'All',         range: () => ({ from: '2020-01-01', to: '2099-12-31' }) },
  { label: 'Today',       range: () => ({ from: tod(),  to: tod()  }) },
  { label: 'Yesterday',   range: () => ({ from: yest(), to: yest() }) },
  { label: 'This Week',   range: () => ({ from: wkStart(0), to: wkEnd(0) }) },
  { label: 'Last Week',   range: () => ({ from: wkStart(-1), to: wkEnd(-1) }) },
  { label: 'This Year',   range: () => ({ from: yrStart(0), to: yrEnd(0) }) },
  { label: 'Last Year',   range: () => ({ from: yrStart(-1), to: yrEnd(-1) }) },
];

function filterSales(sales, from, to) {
  return sales.filter(s => { const d = s.date.split('T')[0]; return d >= from && d <= to; });
}
// ─────────────────────────────────────────────────────────────────────────────

export default function SalesHistory({ user, settings }) {
  const [sales, setSales] = useState(null);
  const [activePreset, setActivePreset] = useState('All');
  const [from, setFrom]   = useState('2020-01-01');
  const [to, setTo]       = useState('2099-12-31');
  const [expanded, setExpanded] = useState(null);

  const currency = settings?.currency || '$';

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, `businesses/${user.uid}/sales`), snap =>
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [user]);

  const applyPreset = (preset) => {
    const r = preset.range();
    setActivePreset(preset.label);
    setFrom(r.from);
    setTo(r.to);
  };

  if (!sales) return <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)' }}>Loading records...</div>;

  const sorted   = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
  const filtered = filterSales(sorted, from, to);
  const periodTotal = filtered.reduce((s, t) => s + t.total, 0);
  const periodItems = filtered.reduce((s, t) => s + (t.items || []).reduce((a, i) => a + i.qty, 0), 0);

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ fontSize: '24px', fontWeight: '800' }}>Sales History</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>Complete log of all business transactions</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              style={{
                padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                background: activePreset === p.label ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                color: activePreset === p.label ? '#fff' : 'var(--text-main)',
                transition: 'all 0.2s'
              }}>
              {p.label}
            </button>
          ))}
        </div>
        
        {/* Stats Row */}
        <div style={{ display: 'flex', gap: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Period</span>
            <span style={{ fontSize: '14px', fontWeight: '700' }}>{activePreset}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Transactions</span>
            <span style={{ fontSize: '14px', fontWeight: '700' }} className="badge badge-blue">{filtered.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Revenue</span>
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--accent)' }}>{currency}{periodTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '48px', opacity: 0.1, marginBottom: '12px' }}>📊</div>
          <p>No transactions found for this period.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(sale => {
            const isOpen = expanded === sale.id;
            return (
              <div key={sale.id} className="glass-panel" style={{ border: `1px solid ${isOpen ? 'rgba(79,142,247,0.3)' : 'var(--glass-border)'}`, borderRadius: '12px', overflow: 'hidden', transition: 'all 0.2s' }}>
                <div onClick={() => setExpanded(isOpen ? null : sale.id)}
                  style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isOpen ? 'rgba(79,142,247,0.05)' : 'transparent' }}>
                  <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#fff' }}>
                        {sale.invoiceId && <span style={{ color: 'var(--accent)', marginRight: '8px', fontSize: '13px' }}>{sale.invoiceId}</span>}
                        {new Date(sale.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span className="badge badge-blue">{sale.items?.length || 0} items</span>
                      {sale.customer?.name && <span className="badge badge-blue">👤 {sale.customer.name}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '17px', fontWeight: '800', color: '#fff' }}>{currency}{sale.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    <span style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.1)' }}>
                    {sale.customer?.phone && (
                      <div style={{ padding: '10px 20px', background: 'rgba(79,142,247,0.05)', borderBottom: '1px solid var(--glass-border)', fontSize: '13px', color: 'var(--text-muted)' }}>
                        📞 Customer Phone: <strong style={{ color: '#fff' }}>{sale.customer.phone}</strong>
                      </div>
                    )}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <th style={{ padding: '12px 20px', textAlign: 'left', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', fontWeight: '700' }}>Item</th>
                          <th style={{ padding: '12px 20px', textAlign: 'right', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', fontWeight: '700' }}>Qty</th>
                          <th style={{ padding: '12px 20px', textAlign: 'right', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', fontWeight: '700' }}>Price</th>
                          <th style={{ padding: '12px 20px', textAlign: 'right', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '11px', fontWeight: '700' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.items?.map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '12px 20px', fontWeight: '500', color: '#e2e8f0' }}>{item.name}</td>
                            <td style={{ padding: '12px 20px', textAlign: 'right' }}>{item.qty}</td>
                            <td style={{ padding: '12px 20px', textAlign: 'right', color: 'var(--text-muted)' }}>{currency}{item.price?.toLocaleString()}</td>
                            <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: '700' }}>{currency}{(item.qty * item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
