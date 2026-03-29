import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { InfoTooltip } from '../App';

export default function Dashboard({ user, settings }) {
// ... existing state ...
  const [sales, setSales] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [expenses, setExpenses] = useState(null);

  const currency = settings?.currency || '$';

  useEffect(() => {
    if (!user) return;
    const unsub1 = onSnapshot(collection(db, `businesses/${user.uid}/sales`), s => setSales(s.docs.map(d => d.data())));
    const unsub2 = onSnapshot(collection(db, `businesses/${user.uid}/inventory`), s => setInventory(s.docs.map(d => d.data())));
    const unsub3 = onSnapshot(collection(db, `businesses/${user.uid}/expenses`), s => setExpenses(s.docs.map(d => d.data())));
    
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [user]);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);

  const analytics = React.useMemo(() => {
    if (!sales || !expenses) return { todaySales: 0, monthSales: 0, monthProfit: 0, monthExpenses: 0, netProfit: 0 };
    const ts = sales.filter(s => s.date.startsWith(today)).reduce((sum, s) => sum + s.total, 0);
    const ms = sales.filter(s => s.date.startsWith(thisMonth)).reduce((sum, s) => sum + s.total, 0);
    const mp = sales.filter(s => s.date.startsWith(thisMonth)).reduce((sum, s) => sum + s.profit, 0);
    const me = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((sum, e) => sum + e.amount, 0);
    return { todaySales: ts, monthSales: ms, monthProfit: mp, monthExpenses: me, netProfit: mp - me };
  }, [sales, expenses, today, thisMonth]);

  const { todaySales, monthSales, netProfit } = analytics;
  const lowStockThreshold = settings?.lowStockThreshold ?? 5;
  const lowStockItems = React.useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(p => p.quantity <= lowStockThreshold && p.quantity > 0);
  }, [inventory, lowStockThreshold]);

  const outOfStockItems = React.useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(p => p.quantity <= 0);
  }, [inventory]);

  if (!sales || !inventory || !expenses) return <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)' }}>Loading remote analytics...</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Value Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--primary)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Today's Revenue <InfoTooltip text="Total amount from sales made today." /></p>
          <h2 style={{ fontSize: '32px', color: '#fff' }}>{currency}{todaySales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid var(--accent)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>This Month's Revenue <InfoTooltip text="Total amount from all sales this month." /></p>
          <h2 style={{ fontSize: '32px', color: '#fff' }}>{currency}{monthSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '24px', borderLeft: `4px solid ${netProfit >= 0 ? '#10b981' : 'var(--danger)'}` }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Net Profit (Month) <InfoTooltip text="Revenue minus purchase costs and operating expenses for this month." /></p>
          <h2 style={{ fontSize: '32px', color: '#fff' }}>{currency}{netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '24px', borderLeft: '4px solid #f59e0b' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: '600' }}>Active Inventory <InfoTooltip text="Total units of all products currently in stock." /></p>
          <h2 style={{ fontSize: '32px', color: '#fff' }}>{inventory.reduce((sum, p) => sum + (p.quantity || 0), 0).toLocaleString()}</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Across {inventory.length} target product{inventory.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Recent Sales Table */}
        <div className="glass-panel" style={{ padding: '24px', minHeight: 0 }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>Recent Transactions <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '400' }}>(last 5)</span></h3>
          {sales.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No sales recorded yet.</p>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: '280px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '12px 8px' }}>Date / Time</th>
                  <th style={{ padding: '12px 8px' }}>Items</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Total Sum</th>
                </tr>
              </thead>
              <tbody>
                {[...sales].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '14px 8px', color: 'var(--text-main)' }}>
                      <span style={{ fontWeight: '500' }}>{new Date(s.date).toLocaleDateString()}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '8px', fontSize: '11px' }}>{new Date(s.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </td>
                    <td style={{ padding: '14px 8px' }}>
                       <span className="badge badge-blue">{s.items.reduce((acc, i) => acc + i.qty, 0)} units</span>
                    </td>
                    <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: '700', color: '#fff' }}>{currency}{s.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Alerts Panel */}
        <div className="glass-panel" style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚠️</span> Inventory Alerts
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {outOfStockItems.length > 0 && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <strong style={{ color: '#fff' }}>Out of Stock ({outOfStockItems.length})</strong>
                <p style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '4px' }}>
                  {outOfStockItems.map(i => i.name).join(', ')}
                </p>
              </div>
            )}
            
            {lowStockItems.length > 0 && (
              <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                   <strong style={{ color: '#fff', fontSize: '14px' }}>Low Stock Alert</strong>
                   <span className="badge badge-yellow">{lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''}</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  {lowStockItems.map(i => i.name).join(', ')}
                </p>
              </div>
            )}

            {outOfStockItems.length === 0 && lowStockItems.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>All stock levels are healthy.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
