import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import logo from '../assets/logo.png';


// ── Date helper utilities ────────────────────────────────────────────────────
const today     = () => new Date().toISOString().split('T')[0];
const yesterday = () => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; };
const weekStart = (offset = 0) => {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day + offset * 7);
  return d.toISOString().split('T')[0];
};
const weekEnd = (offset = 0) => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + 6 + offset * 7);
  return d.toISOString().split('T')[0];
};
const monthStart = (offset = 0) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toISOString().split('T')[0];
};
const monthEnd = (offset = 0) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset + 1, 0).toISOString().split('T')[0];
};
const yearStart = (offset = 0) => `${new Date().getFullYear() + offset}-01-01`;
const yearEnd   = (offset = 0) => `${new Date().getFullYear() + offset}-12-31`;

const PRESETS = [
  { label: 'All Time',   range: () => ({ from: '2020-01-01', to: '2099-12-31' }) },
  { label: 'Today',      range: () => ({ from: today(), to: today() }) },
  { label: 'Yesterday',  range: () => ({ from: yesterday(), to: yesterday() }) },
  { label: 'This Week',  range: () => ({ from: weekStart(0), to: weekEnd(0) }) },
  { label: 'Last Week',  range: () => ({ from: weekStart(-1), to: weekEnd(-1) }) },
  { label: 'This Month', range: () => ({ from: monthStart(0), to: monthEnd(0) }) },
  { label: 'Last Month', range: () => ({ from: monthStart(-1), to: monthEnd(-1) }) },
  { label: 'This Year',  range: () => ({ from: yearStart(0), to: yearEnd(0) }) },
  { label: 'Last Year',  range: () => ({ from: yearStart(-1), to: yearEnd(-1) }) },
];

function filterSalesByRange(sales, from, to) {
  if (!from || !to) return sales;
  return sales.filter(s => {
    const d = s.date.split('T')[0];
    return d >= from && d <= to;
  });
}
// ────────────────────────────────────────────────────────────────────────────

export default function Reports({ user, settings }) {
  const [sales, setSales] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' });

  // Filter state — null = show all (default)
  const [activePreset, setActivePreset] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const currency = settings?.currency || '$';

  useEffect(() => {
    if (!user) return;
    
    // Expenses is low-volume, keep live sync for add/delete
    const unsub2 = onSnapshot(collection(db, `businesses/${user.uid}/expenses`), s => setExpenses(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    // Sales uses manual fetch bounded by date
    const fetchSales = async () => {
      setSales(null); // Show loading temporarily while fetching
      let q = collection(db, `businesses/${user.uid}/sales`);
      
      if (fromDate && toDate) {
        q = query(q, where('date', '>=', fromDate), where('date', '<=', toDate + 'T23:59:59'));
      } else if (activePreset && activePreset !== 'All Time') {
        const { from, to } = PRESETS.find(p => p.label === activePreset)?.range() || {};
        if (from && to) {
          q = query(q, where('date', '>=', from), where('date', '<=', to + 'T23:59:59'));
        }
      }
      
      try {
        const snap = await getDocs(q);
        setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(err) {
        console.error("Reports sales fetch error:", err);
        setSales([]);
      }
    };
    
    fetchSales();
    
    return () => unsub2();
  }, [user, activePreset, fromDate, toDate]);

  const applyPreset = (preset) => {
    const { from, to } = preset.range();
    setActivePreset(preset.label);
    setFromDate(from);
    setToDate(to);
  };

  const clearFilter = () => {
    setActivePreset(null);
    setFromDate('');
    setToDate('');
  };

  const addExpense = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, `businesses/${user.uid}/expenses`), {
      date: new Date().toISOString(),
      description: expenseForm.description,
      amount: Number(expenseForm.amount)
    });
    setExpenseForm({ description: '', amount: '' });
  };

  const deleteExpense = async (id) => {
    if (window.confirm('Delete this expense?')) await deleteDoc(doc(db, `businesses/${user.uid}/expenses/${id}`));
  };

  if (!sales || !expenses) return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading reports...</div>;

  const sortedSales = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));
  const filteredSales = (activePreset || (fromDate && toDate))
    ? filterSalesByRange(sortedSales, fromDate, toDate)
    : sortedSales;

  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const grossProfit  = filteredSales.reduce((sum, s) => sum + (s.profit || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0); // expenses not date-filtered
  const netProfit = grossProfit - totalExpenses;

  const allItemsSold = filteredSales.flatMap(sale =>
    (sale.items || []).map(item => ({
      date: new Date(sale.date).toLocaleDateString(),
      time: new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      name: item.name,
      qty: item.qty,
      unitPrice: item.price,
      lineTotal: item.qty * item.price
    }))
  );

  const cellStyle = { padding: '10px 14px', borderBottom: '1px solid #e5e7eb', fontSize: '13px' };
  const headStyle = { ...cellStyle, background: '#f1f5f9', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.5px' };

  const rangeLabel = activePreset
    ? activePreset
    : (fromDate && toDate ? `${fromDate} → ${toDate}` : 'All Time (Recent First)');

  const exportCSV = (rows, headers, filename) => {
    const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportSalesCSV = () => {
    const headers = ['Date', 'Time', 'Item Name', 'Qty', 'Unit Price', 'Line Total'];
    const rows = allItemsSold.map(r => [r.date, r.time, r.name, r.qty, r.unitPrice, r.lineTotal]);
    exportCSV(rows, headers, `sales-${rangeLabel.replace(/[^a-z0-9]/gi, '_')}.csv`);
  };

  const exportInventoryCSV = () => {
    // We need the full inventory — fetch from already-loaded sales if available, or just note we need it
    // Since Reports doesn't load inventory, we'll build from sales item names only
    // For a proper inventory export, use this placeholder to notify user
    alert('To export inventory, go to the Inventory tab — full export from there coming in a future update.');
  };

  return (
    <div className="printable-a4 animate-fade-in" style={{ paddingBottom: '40px' }}>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '24px', fontWeight: '800' }}>Financial Reports</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={exportSalesCSV} style={{ background: 'rgba(6,214,160,0.1)', color: '#06d6a0', border: '1px solid rgba(6,214,160,0.25)', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>⬇ Export CSV</button>
          <button onClick={() => window.print()} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 8px 20px rgba(79,142,247,0.25)' }}>🖨️ Print Report</button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="no-print glass-panel" style={{ padding: '16px 20px', marginBottom: '20px', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginRight: '4px' }}>Quick Select:</span>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => p.label === 'All Time' ? clearFilter() : applyPreset(p)}
              style={{
                padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
                background: activePreset === p.label || (p.label === 'All Time' && !activePreset) ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                color: activePreset === p.label || (p.label === 'All Time' && !activePreset) ? '#fff' : 'var(--text-main)'
              }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Custom Range:</span>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setActivePreset(null); }}
            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', outline: 'none' }} />
          <span style={{ color: 'var(--text-muted)' }}>to</span>
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setActivePreset(null); }}
            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', outline: 'none' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>Showing: <strong style={{ color: '#fff' }}>{rangeLabel}</strong> · <strong style={{ color: 'var(--accent)' }}>{filteredSales.length} transactions</strong></span>
        </div>
      </div>

      {/* A4 Document */}
      <div className="a4-document" style={{ minHeight: '800px' }}>
        {/* Company Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '24px', marginBottom: '32px' }}>
          <div>
            <img src={settings?.logo || logo} alt="Logo" style={{ height: '72px', marginBottom: '16px', objectFit: 'contain' }} />
            <h1 style={{ fontSize: '28px', margin: 0, fontWeight: '800', color: '#0f172a' }}>{settings?.companyName || 'Business Report'}</h1>
            {settings?.address && <p style={{ color: '#64748b', fontSize: '13px', whiteSpace: 'pre-wrap', marginTop: '6px' }}>{settings.address}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '18px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '2px', fontWeight: '700' }}>Sales Statement</h2>
            <p style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600', marginTop: '8px' }}>Period: {rangeLabel}</p>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Period Revenue', value: `${currency}${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, bg: '#f8fafc', border: '#e2e8f0', color: '#0f172a' },
            { label: 'Gross Profit', value: `${currency}${grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, bg: '#f0fdf4', border: '#bbf7d0', color: '#166534' },
            { label: 'Total Expenses', value: `-${currency}${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
            { label: 'Net Profit', value: `${currency}${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, bg: netProfit >= 0 ? '#f0fdf4' : '#fef2f2', border: netProfit >= 0 ? '#bbf7d0' : '#fecaca', color: netProfit >= 0 ? '#166534' : '#991b1b' },
          ].map(c => (
            <div key={c.label} style={{ padding: '16px', background: c.bg, borderRadius: '8px', border: `1px solid ${c.border}` }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>{c.label}</p>
              <h3 style={{ margin: 0, fontSize: '20px', color: c.color }}>{c.value}</h3>
            </div>
          ))}
        </div>

        {/* Itemized Sales */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '15px', color: '#1e293b', borderBottom: '2px solid #334155', paddingBottom: '8px', marginBottom: '0' }}>
            Itemized Sales Record ({allItemsSold.length} line items)
          </h3>
          {allItemsSold.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic', padding: '16px 0' }}>No sales in this period.</p>
          ) : (
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Date', 'Time', 'Item Name', 'Qty', 'Unit Price', 'Line Total'].map((h, i) => (
                      <th key={h} style={{ ...headStyle, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allItemsSold.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={cellStyle}>{row.date}</td>
                      <td style={cellStyle}>{row.time}</td>
                      <td style={{ ...cellStyle, fontWeight: '500', color: '#1e293b' }}>{row.name}</td>
                      <td style={{ ...cellStyle, textAlign: 'right' }}>{row.qty}</td>
                      <td style={{ ...cellStyle, textAlign: 'right' }}>{currency}{row.unitPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td style={{ ...cellStyle, textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>{currency}{row.lineTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f1f5f9', fontWeight: '700' }}>
                    <td colSpan={5} style={{ ...cellStyle, textAlign: 'right', color: '#334155' }}>TOTAL REVENUE</td>
                    <td style={{ ...cellStyle, textAlign: 'right', color: '#0f172a', fontSize: '14px' }}>{currency}{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Expenses */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '15px', color: '#1e293b', borderBottom: '2px solid #334155', paddingBottom: '8px', marginBottom: '0' }}>
            Expense Tracking (All Time)
          </h3>

          <form className="no-print" onSubmit={addExpense} style={{ display: 'flex', gap: '12px', padding: '12px 0 16px' }}>
            <input required type="text" placeholder="Description" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
              style={{ flex: 2, padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', outline: 'none' }} />
            <input required type="number" step="0.01" placeholder={`Amount (${currency})`} value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', outline: 'none' }} />
            <button type="submit" style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Record</button>
          </form>

          {expenses.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No expenses recorded.</p>
          ) : (
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={headStyle}>Date</th>
                    <th style={headStyle}>Description</th>
                    <th style={{ ...headStyle, textAlign: 'right' }}>Amount</th>
                    <th className="no-print" style={{ ...headStyle, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).map((e, i) => (
                    <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={cellStyle}>{new Date(e.date).toLocaleDateString()}</td>
                      <td style={cellStyle}>{e.description}</td>
                      <td style={{ ...cellStyle, textAlign: 'right', fontWeight: '700', color: '#991b1b' }}>{currency}{e.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="no-print" style={{ ...cellStyle, textAlign: 'right' }}>
                        <button onClick={() => deleteExpense(e.id)} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px' }}>Remove</button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f1f5f9', fontWeight: '700' }}>
                    <td colSpan={2} style={{ ...cellStyle, textAlign: 'right', color: '#334155' }}>TOTAL EXPENSES</td>
                    <td style={{ ...cellStyle, textAlign: 'right', color: '#991b1b', fontSize: '14px' }}>{currency}{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="no-print" style={cellStyle}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Net Result */}
        <div style={{ padding: '16px 20px', background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '8px', border: `1px solid ${netProfit >= 0 ? '#bbf7d0' : '#fecaca'}`, textAlign: 'right' }}>
          <span style={{ fontSize: '14px', color: '#64748b', marginRight: '16px' }}>NET PROFIT:</span>
          <span style={{ fontSize: '22px', fontWeight: '800', color: netProfit >= 0 ? '#166534' : '#991b1b' }}>{currency}{netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>

        <div style={{ marginTop: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
          BAS — Business Accounting Software © {new Date().getFullYear()} · Developed by Martins Kingsley Chigozie
        </div>
      </div>
    </div>
  );
}
