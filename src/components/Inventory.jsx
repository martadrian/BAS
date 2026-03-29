import React, { useState, useEffect, useMemo, memo } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { InfoTooltip } from '../App';

const emptyPackaging = { name: '', unitsPerPackage: 1, sellingPrice: '' };
const emptyForm = { name: '', sku: '', category: '', costPrice: '', quantity: '', packagingOptions: [{ ...emptyPackaging }] };

const InventoryRow = memo(({ product, currency, threshold, getMargin, onAdjust, onEdit, onDelete }) => {
  const margin = useMemo(() => getMargin(product), [product, getMargin]);
  const isLowStock = product.quantity <= threshold && product.quantity > 0;
  const isOutOfStock = product.quantity <= 0;

  return (
    <tr style={{ borderTop: '1px solid var(--glass-border)' }}>
      <td style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: '500' }}>{product.name}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{product.category || 'Uncategorized'}</div>
      </td>
      <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>{product.sku || '—'}</td>
      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{currency}{product.costPrice?.toLocaleString()}</td>
      <td style={{ padding: '14px 16px' }}>
        {margin !== null ? (
          <span className={`badge ${margin >= 30 ? 'badge-green' : margin >= 10 ? 'badge-yellow' : 'badge-red'}`}>
            {margin.toFixed(1)}%
          </span>
        ) : '—'}
      </td>
      <td style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(product.packagingOptions || []).map((opt, i) => (
            <span key={i} className="badge badge-blue" style={{ fontSize: '11px' }}>
              {opt.name} ({currency}{opt.sellingPrice?.toLocaleString()})
            </span>
          ))}
        </div>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <span className={`badge ${isOutOfStock ? 'badge-red' : isLowStock ? 'badge-yellow' : 'badge-green'}`}>
          {product.quantity.toLocaleString()} units
        </span>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onAdjust(product)} style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Adjust</button>
          <button onClick={() => onEdit(product)} style={{ background: 'rgba(79,142,247,0.1)', color: 'var(--primary)', border: '1px solid rgba(79,142,247,0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>Edit</button>
          <button onClick={() => onDelete(product.id)} style={{ background: 'rgba(244,63,94,0.1)', color: 'var(--danger)', border: '1px solid rgba(244,63,94,0.2)', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>✕</button>
        </div>
      </td>
    </tr>
  );
});

export default function Inventory({ user, settings }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ delta: '', reason: '' });

  const currency = settings?.currency || '$';
  const threshold = settings?.lowStockThreshold ?? 5;

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, `businesses/${user.uid}/inventory`), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const openAddForm = () => {
    setEditingProduct(null);
    setFormData(emptyForm);
    setIsAdding(true);
  };

  const openEditForm = React.useCallback((product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      costPrice: product.costPrice?.toString() || '',
      quantity: product.quantity?.toString() || '',
      packagingOptions: product.packagingOptions?.map(o => ({ ...o, sellingPrice: o.sellingPrice?.toString() })) || [{ ...emptyPackaging }]
    });
    setIsAdding(true);
  }, []);

  const openAdjust = React.useCallback((product) => {
    setAdjustingProduct(product);
    setAdjustForm({ delta: '', reason: '' });
  }, []);

  const addPackagingTier = () =>
    setFormData(prev => ({ ...prev, packagingOptions: [...prev.packagingOptions, { ...emptyPackaging }] }));

  const removePackagingTier = (index) => {
    if (formData.packagingOptions.length <= 1) return;
    setFormData(prev => ({ ...prev, packagingOptions: prev.packagingOptions.filter((_, i) => i !== index) }));
  };

  const updateTier = (index, field, value) =>
    setFormData(prev => ({ ...prev, packagingOptions: prev.packagingOptions.map((opt, i) => i === index ? { ...opt, [field]: value } : opt) }));

  const toMoney = (val) => Math.round(Number(val) * 100) / 100;

  const handleSave = async (e) => {
    e.preventDefault();
    const cleanOptions = formData.packagingOptions
      .filter(o => o.name && o.unitsPerPackage && o.sellingPrice)
      .map(o => ({ name: o.name, unitsPerPackage: Number(o.unitsPerPackage), sellingPrice: toMoney(o.sellingPrice) }))
      .sort((a, b) => a.unitsPerPackage - b.unitsPerPackage);

    const payload = {
      name: formData.name, sku: formData.sku, category: formData.category,
      costPrice: toMoney(formData.costPrice),
      quantity: Number(formData.quantity),
      packagingOptions: cleanOptions
    };

    if (editingProduct) {
      await updateDoc(doc(db, `businesses/${user.uid}/inventory/${editingProduct.id}`), payload);
    } else {
      await addDoc(collection(db, `businesses/${user.uid}/inventory`), payload);
    }

    setIsAdding(false); setEditingProduct(null); setFormData(emptyForm);
  };

  const handleStockAdjust = async (e) => {
    e.preventDefault();
    const delta = parseInt(adjustForm.delta, 10);
    if (isNaN(delta) || delta === 0) return;

    const newQty = Math.max(0, adjustingProduct.quantity + delta);
    await updateDoc(doc(db, `businesses/${user.uid}/inventory/${adjustingProduct.id}`), { quantity: newQty });
    await addDoc(collection(db, `businesses/${user.uid}/stockAdjustments`), {
      date: new Date().toISOString(),
      productId: adjustingProduct.id,
      productName: adjustingProduct.name,
      delta,
      reason: adjustForm.reason,
      quantityBefore: adjustingProduct.quantity,
      quantityAfter: newQty
    });

    setAdjustingProduct(null);
  };

  const { totalValuation, totalUnits } = useMemo(() => ({
    totalValuation: products.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0),
    totalUnits: products.reduce((sum, p) => sum + p.quantity, 0)
  }), [products]);

  const getMargin = React.useCallback((product) => {
    if (!product.packagingOptions?.length || !product.costPrice) return null;
    const smallest = product.packagingOptions.reduce((a, b) => a.unitsPerPackage <= b.unitsPerPackage ? a : b);
    const sellPerUnit = smallest.sellingPrice / smallest.unitsPerPackage;
    const margin = ((sellPerUnit - product.costPrice) / sellPerUnit) * 100;
    return margin;
  }, []);

  const deleteProduct = React.useCallback(async (id) => {
    if (window.confirm('Delete this product?'))
      await deleteDoc(doc(db, `businesses/${user.uid}/inventory/${id}`));
  }, [user.uid]);

  if (loading) return <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)' }}>Loading...</div>;

  const inputStyle = { width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', outline: 'none', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>

      {/* Stock Adjustment Modal */}
      {adjustingProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleStockAdjust} className="glass-panel" style={{ padding: '32px', width: '380px', background: 'var(--bg-dark)', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ marginBottom: '6px', fontSize: '18px' }}>Adjust Stock</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
              <strong style={{ color: '#fff' }}>{adjustingProduct.name}</strong> — Current: {adjustingProduct.quantity} units
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Adjustment Amount</label>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Use a positive number to add stock, negative to remove (e.g. -5 for damage).</p>
                <input required type="number" placeholder="e.g. +50 or -5" value={adjustForm.delta}
                  onChange={e => setAdjustForm({ ...adjustForm, delta: e.target.value })}
                  style={inputStyle} />
                {adjustForm.delta && !isNaN(parseInt(adjustForm.delta)) && (
                  <p style={{ fontSize: '12px', marginTop: '6px', color: 'var(--accent)' }}>
                    New quantity will be: <strong>{Math.max(0, adjustingProduct.quantity + parseInt(adjustForm.delta, 10))}</strong>
                  </p>
                )}
              </div>
              <div>
                <label style={labelStyle}>Reason</label>
                <input required type="text" placeholder="e.g. New delivery, Damaged goods, Stock count" value={adjustForm.reason}
                  onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setAdjustingProduct(null)} style={{ padding: '10px 18px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ padding: '10px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Apply Adjustment</button>
            </div>
          </form>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '24px' }}>Inventory Stock</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Products with multiple packaging tiers. Adjust stock anytime.</p>
        </div>
        <button onClick={openAddForm} style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>+ Add Product</button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { label: 'Stock Valuation', value: `${currency}${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
          { label: 'Total Single Units', value: totalUnits.toLocaleString() },
          { label: 'Total Products', value: products.length },
        ].map(c => (
          <div key={c.label} className="glass-panel" style={{ padding: '18px 22px', background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '6px' }}>{c.label}</p>
            <h4 style={{ fontSize: '24px', color: '#fff' }}>{c.value}</h4>
          </div>
        ))}
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <form onSubmit={handleSave} className="glass-panel animate-fade-in"
          style={{ padding: '24px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(59,130,246,0.4)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ color: 'var(--primary)' }}>{editingProduct ? `Editing: ${editingProduct.name}` : 'New Product'}</h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div><label style={labelStyle}>Product Name *</label><input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>SKU / Barcode <InfoTooltip text="Unique identifier for the product. Can be scanned via barcode reader." /></label><input type="text" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Category</label><input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Cost Price per Unit ({currency}) * <InfoTooltip text="The price YOU paid to buy one single unit of this product." /></label><input required type="number" step="1" min="0" value={formData.costPrice} onChange={e => setFormData({ ...formData, costPrice: e.target.value })} style={inputStyle} /></div>
            <div><label style={labelStyle}>Total Single Units in Stock * <InfoTooltip text="How many individual units are currently on your shelves." /></label><input required type="number" min="0" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} style={inputStyle} /></div>
          </div>

          {/* Packaging Tiers */}
          <div style={{ borderTop: '1px dashed var(--glass-border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h4 style={{ color: 'var(--accent)', marginBottom: '2px' }}>Packaging / Selling Tiers</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Each tier gets its own button on the POS screen.</p>
              </div>
              <button type="button" onClick={addPackagingTier}
                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>+ Add Tier</button>
            </div>
            {formData.packagingOptions.map((opt, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: '10px', alignItems: 'end', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div><label style={{ ...labelStyle, fontSize: '11px' }}>Package Name</label><input required type="text" placeholder="e.g. Sachet, Roll, Carton" value={opt.name} onChange={e => updateTier(index, 'name', e.target.value)} style={inputStyle} /></div>
                <div><label style={{ ...labelStyle, fontSize: '11px' }}>Units in Package</label><input required type="number" min="1" placeholder="e.g. 12" value={opt.unitsPerPackage} onChange={e => updateTier(index, 'unitsPerPackage', e.target.value)} style={inputStyle} /></div>
                <div><label style={{ ...labelStyle, fontSize: '11px' }}>Selling Price ({currency})</label><input required type="number" step="1" min="0" placeholder="e.g. 500" value={opt.sellingPrice} onChange={e => updateTier(index, 'sellingPrice', e.target.value)} style={inputStyle} /></div>
                <button type="button" onClick={() => removePackagingTier(index)} disabled={formData.packagingOptions.length === 1}
                  style={{ padding: '8px 12px', background: formData.packagingOptions.length === 1 ? 'transparent' : 'rgba(239,68,68,0.1)', color: formData.packagingOptions.length === 1 ? 'rgba(255,255,255,0.1)' : 'var(--danger)', border: 'none', borderRadius: '6px', cursor: formData.packagingOptions.length === 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => { setIsAdding(false); setEditingProduct(null); }} style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '10px 28px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              {editingProduct ? 'Save Changes' : 'Save Product'}
            </button>
          </div>
        </form>
      )}

      {/* Products Table */}
      {products.length === 0 && !isAdding ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
          <div style={{ fontSize: '48px', opacity: 0.3 }}>📦</div>
          <p style={{ marginTop: '16px' }}>No products yet. Click '+ Add Product' to get started.</p>
        </div>
      ) : products.length > 0 && (
        <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.1)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Product</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>SKU <InfoTooltip text="Stock Keeping Unit / Barcode" /></th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Cost/Unit</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Margin <InfoTooltip text="Profit percentage based on your smallest selling unit." /></th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Packaging Tiers</th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>In Stock <InfoTooltip text="Red: Out of stock. Yellow: Low stock." /></th>
                <th style={{ padding: '14px 16px', color: 'var(--text-muted)', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <InventoryRow key={p.id} product={p} currency={currency} threshold={threshold} getMargin={getMargin} onAdjust={openAdjust} onEdit={openEditForm} onDelete={deleteProduct} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
