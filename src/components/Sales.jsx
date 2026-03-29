import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { collection, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Html5Qrcode } from 'html5-qrcode';
import { InfoTooltip } from '../App';

// Memoized Product Card for performance
const ProductCard = memo(({ product, currency, threshold, onAdd }) => {
  const isOutOfStock = product.quantity <= 0;
  const isLowStock = product.quantity <= threshold && product.quantity > 0;

  return (
    <div style={{ padding: '16px 18px', borderRadius: '12px', border: `1px solid ${isOutOfStock ? 'rgba(244,63,94,0.3)' : 'var(--glass-border)'}`, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <p style={{ fontWeight: '600', fontSize: '15px', color: '#e2e8f0', marginBottom: '3px' }}>{product.name}</p>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
            {product.category && <span>📁 {product.category}</span>}
            {product.sku && <span>SKU: {product.sku}</span>}
          </div>
        </div>
        <span className={`badge ${isOutOfStock ? 'badge-red' : isLowStock ? 'badge-yellow' : 'badge-green'}`}>
          {isOutOfStock ? 'Out of Stock' : `${product.quantity} units`}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {(product.packagingOptions || []).map((opt, i) => {
          const disabled = product.quantity < opt.unitsPerPackage;
          return (
            <button key={i} onClick={() => !disabled && onAdd(product, opt)} disabled={disabled}
              style={{
                padding: '9px 16px', borderRadius: '8px', border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: disabled ? 'rgba(255,255,255,0.04)' : i === 0 ? 'rgba(79,142,247,0.18)' : 'rgba(6,214,160,0.15)',
                color: disabled ? 'var(--text-muted)' : i === 0 ? 'var(--primary)' : 'var(--accent)',
                border: `1px solid ${disabled ? 'transparent' : i === 0 ? 'rgba(79,142,247,0.3)' : 'rgba(6,214,160,0.3)'}`,
                fontSize: '13px', fontWeight: '600',
                opacity: disabled ? 0.5 : 1
              }}>
              + {opt.name}
              <span style={{ opacity: 0.7, marginLeft: '6px' }}>{currency}{opt.sellingPrice?.toLocaleString()}</span>
              {opt.unitsPerPackage > 1 && <span style={{ opacity: 0.5, fontSize: '11px', marginLeft: '4px' }}>×{opt.unitsPerPackage}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default function Sales({ user, settings }) {
  const [inventory, setInventory] = useState(null);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [customerEnabled, setCustomerEnabled] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '' });
  const [receipt, setReceipt] = useState(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);

  const currency = settings?.currency || '$';
  const taxRate = settings?.taxRate ?? 0;
  const threshold = settings?.lowStockThreshold ?? 5;

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, `businesses/${user.uid}/inventory`), snap =>
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [user]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Barcode Scanning logic
  useEffect(() => {
    if (!scanning || !scannerRef.current) return;
    const scanner = new Html5Qrcode('barcode-reader');
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        setSearchTerm(decodedText);
        setScanning(false);
        scanner.stop();
      },
      () => {}
    ).catch(err => console.error(err));
    return () => {
      try { scanner.stop(); } catch(e){}
    };
  }, [scanning]);

  const addToCart = React.useCallback((product, opt) => {
    const { name: pkgName, unitsPerPackage, sellingPrice } = opt;
    const cartItemId = `${product.id}_${pkgName}`;
    const label = unitsPerPackage === 1 ? `${product.name} (${pkgName})` : `${product.name} — ${pkgName}`;
    setCart(prev => {
      const unitsInCart = prev.filter(i => i.productId === product.id)
        .reduce((s, i) => s + i.cartQty * i.unitsPerPackage, 0);
      if (unitsInCart + unitsPerPackage > product.quantity) {
        alert(`Not enough stock. ${product.quantity - unitsInCart} units remain.`); return prev;
      }
      const existing = prev.find(i => i.cartItemId === cartItemId);
      if (existing) {
        return prev.map(i => i.cartItemId === cartItemId ? { ...i, cartQty: i.cartQty + 1 } : i);
      } else {
        return [...prev, { cartItemId, productId: product.id, name: label, sellingPrice, costPrice: product.costPrice * unitsPerPackage, unitsPerPackage, cartQty: 1 }];
      }
    });
  }, []);

  const removeFromCart = React.useCallback((id) => setCart(c => c.filter(i => i.cartItemId !== id)), []);

  const updateQty = React.useCallback((cartItemId, val) => {
    let qty = parseInt(val, 10);
    if (isNaN(qty) || qty < 1) qty = 1;
    setCart(prev => prev.map(item => {
      if (item.cartItemId !== cartItemId) return item;
      const other = prev.filter(i => i.productId === item.productId && i.cartItemId !== cartItemId)
        .reduce((s, i) => s + i.cartQty * i.unitsPerPackage, 0);
      const p = inventory?.find(p => p.id === item.productId);
      const max = Math.floor(((p?.quantity || 0) - other) / item.unitsPerPackage);
      if (qty > max) { alert(`Max allowed: ${max}`); return { ...item, cartQty: max }; }
      return { ...item, cartQty: qty };
    }));
  }, [inventory]);

  const completeSale = async () => {
    if (cart.length === 0 || !user) return;
    try {
      const batch = writeBatch(db);
      let subtotalTotal = 0, grossProfit = 0;
      const productUpdates = {};
      for (const item of cart) {
        subtotalTotal += item.sellingPrice * item.cartQty;
        grossProfit += (item.sellingPrice - item.costPrice) * item.cartQty;
        productUpdates[item.productId] = (productUpdates[item.productId] || 0) + item.cartQty * item.unitsPerPackage;
      }
      const taxAmountVal = Math.round(subtotalTotal * (taxRate / 100) * 100) / 100;
      const totalVal = subtotalTotal + taxAmountVal;
      for (const [pId, used] of Object.entries(productUpdates)) {
        const p = inventory.find(i => i.id === pId);
        batch.update(doc(db, `businesses/${user.uid}/inventory/${pId}`), { quantity: p.quantity - used });
      }
      const saleData = {
        date: new Date().toISOString(), subtotal: subtotalTotal, taxRate, taxAmount: taxAmountVal, total: totalVal,
        profit: grossProfit,
        items: cart.map(i => ({ id: i.productId, name: i.name, qty: i.cartQty, price: i.sellingPrice })),
        ...(customerEnabled && customerInfo.name ? { customer: customerInfo } : {})
      };
      const saleRef = doc(collection(db, `businesses/${user.uid}/sales`));
      batch.set(saleRef, saleData);
      await batch.commit();
      setReceipt(saleData);
      setCart([]);
      setCustomerInfo({ name: '', phone: '' });
    } catch (err) { alert('Transaction failed: ' + err.message); }
  };

  const filtered = useMemo(() => {
    if (!inventory) return [];
    if (!debouncedSearch) return inventory;
    const low = debouncedSearch.toLowerCase();
    return inventory.filter(p => p.name?.toLowerCase().includes(low) || p.sku?.includes(low));
  }, [inventory, debouncedSearch]);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.sellingPrice * i.cartQty, 0), [cart]);
  const taxAmount = useMemo(() => Math.round(subtotal * (taxRate / 100) * 100) / 100, [subtotal, taxRate]);
  const cartTotal = subtotal + taxAmount;

  if (!inventory) return <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)' }}>Loading products...</div>;

  const inputBase = { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff', outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ display: 'flex', height: '100%', gap: '20px', overflow: 'hidden' }}>

      {/* ── Receipt Modal ── */}
      {receipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#fff', color: '#0f172a', borderRadius: '16px', padding: '36px', width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #cbd5e1', paddingBottom: '18px', marginBottom: '18px' }}>
              {settings?.logo && <img src={settings.logo} alt="logo" style={{ height: '48px', objectFit: 'contain', marginBottom: '10px' }} />}
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>{settings?.companyName || 'BAS Accounting'}</h2>
              {settings?.address && <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>{settings.address}</p>}
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                {new Date(receipt.date).toLocaleDateString()} · {new Date(receipt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              {receipt.customer?.name && (
                <p style={{ fontSize: '13px', marginTop: '8px', padding: '6px 12px', background: '#f1f5f9', borderRadius: '6px', display: 'inline-block' }}>
                  👤 {receipt.customer.name}{receipt.customer.phone ? ` · ${receipt.customer.phone}` : ''}
                </p>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '6px 4px', textAlign: 'left', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Item</th>
                  <th style={{ padding: '6px 4px', textAlign: 'center', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Qty</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 4px', fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>{item.name}</td>
                    <td style={{ padding: '10px 4px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>{item.qty} × {currency}{item.price.toLocaleString()}</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', fontSize: '13px', fontWeight: '700' }}>{currency}{(item.qty * item.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: receipt.taxRate > 0 ? '6px' : '0' }}>
                <span style={{ color: '#64748b' }}>Subtotal</span>
                <span>{currency}{receipt.subtotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              {receipt.taxRate > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
                  <span style={{ color: '#64748b' }}>VAT ({receipt.taxRate}%)</span>
                  <span>{currency}{receipt.taxAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: '800', marginTop: '10px', borderTop: '2px solid #0f172a', paddingTop: '10px' }}>
                <span>TOTAL</span>
                <span style={{ color: '#0f172a' }}>{currency}{receipt.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', margin: '20px 0 0' }}>Thank you for your business!</p>

            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button onClick={() => window.print()} style={{ flex: 1, padding: '12px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>🖨️ Print</button>
              <button onClick={() => setReceipt(null)} style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Barcode Scanner Overlay ── */}
      {scanning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div id="barcode-reader" ref={scannerRef} style={{ width: '100%', maxWidth: '500px', borderRadius: '12px', overflow: 'hidden' }}></div>
          <button onClick={() => setScanning(false)} style={{ marginTop: '20px', padding: '12px 24px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Close Scanner</button>
        </div>
      )}

      {/* ── LEFT: Product Grid ── */}
      <div className="glass-panel animate-fade-in" style={{ flex: 3, padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Search bar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px' }}>🔍</span>
            <input type="text" placeholder="Search product name or SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ ...inputBase, width: '100%', padding: '12px 14px 12px 42px', fontSize: '14px' }} />
            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}><InfoTooltip text="Find products by name or by scanning their barcode." /></div>
          </div>
          <button onClick={() => setScanning(true)} title="Scan barcode"
            style={{ padding: '12px 16px', background: 'rgba(79,142,247,0.12)', color: 'var(--primary)', border: '1px solid rgba(79,142,247,0.3)', borderRadius: '10px', cursor: 'pointer', fontSize: '20px', fontWeight: '600' }}>
            📷
          </button>
        </div>

        {/* Product cards */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📦</div>
              <p>No products found.</p>
            </div>
          )}
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} currency={currency} threshold={threshold} onAdd={addToCart} />
          ))}
        </div>
      </div>

      {/* ── RIGHT: Checkout Panel ── */}
      <div className="glass-panel animate-fade-in" style={{ width: '380px', flexShrink: 0, padding: '24px', display: 'flex', flexDirection: 'column', gap: '0', overflow: 'hidden' }}>

        {/* Panel Header */}
        <div style={{ marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px' }}>Order Summary</h3>

          {/* Customer Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
            onClick={() => setCustomerEnabled(!customerEnabled)}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', flex: 1 }}>Track Customer <InfoTooltip text="Store customer names and phone numbers on receipts for better record keeping." /></span>
            <div style={{ width: '40px', height: '22px', borderRadius: '11px', background: customerEnabled ? 'var(--primary)' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: customerEnabled ? '21px' : '3px', transition: 'left 0.2s' }} />
            </div>
          </div>

          {customerEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              <input type="text" placeholder="Customer name" value={customerInfo.name} onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                style={{ ...inputBase, padding: '9px 12px', fontSize: '13px', width: '100%' }} />
              <input type="tel" placeholder="Phone number" value={customerInfo.phone} onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                style={{ ...inputBase, padding: '9px 12px', fontSize: '13px', width: '100%' }} />
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
          {cart.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: '12px' }}>
              <span style={{ fontSize: '44px', opacity: 0.2 }}>🛒</span>
              <p style={{ fontSize: '14px' }}>Add products from the left</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cart.map(item => (
                <div key={item.cartItemId} style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', lineHeight: '1.3', color: '#e2e8f0' }}>{item.name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{currency}{item.sellingPrice?.toLocaleString()} each</p>
                    </div>
                    <button onClick={() => removeFromCart(item.cartItemId)}
                      style={{ background: 'rgba(244,63,94,0.1)', border: 'none', color: 'var(--danger)', cursor: 'pointer', width: '26px', height: '26px', borderRadius: '50%', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      ×
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '4px 8px' }}>
                      <button onClick={() => updateQty(item.cartItemId, item.cartQty - 1)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>−</button>
                      <input type="number" min="1" value={item.cartQty} onChange={e => updateQty(item.cartItemId, e.target.value)}
                        style={{ width: '52px', padding: '4px 6px', background: 'transparent', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '6px', textAlign: 'center', fontSize: '14px', fontWeight: '700', outline: 'none' }} />
                      <button onClick={() => updateQty(item.cartItemId, item.cartQty + 1)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '0 4px', lineHeight: 1 }}>+</button>
                    </div>
                    <div style={{ flex: 1, textAlign: 'right', fontSize: '15px', fontWeight: '700', color: '#e2e8f0' }}>
                      {currency}{(item.cartQty * item.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals & Checkout */}
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
          {taxRate > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span>Subtotal</span><span style={{ color: 'var(--text-main)' }}>{currency}{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                <span>VAT ({taxRate}%) <InfoTooltip text="The sales tax rate configured by your business Admin." /></span><span style={{ color: 'var(--text-main)' }}>{currency}{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-muted)' }}>Total</span>
            <span style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>{currency}{cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <button onClick={completeSale} disabled={cart.length === 0}
            style={{
              width: '100%', padding: '16px',
              background: cart.length === 0 ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: cart.length === 0 ? 'var(--text-muted)' : '#fff',
              border: 'none', borderRadius: '12px',
              cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '700', fontSize: '16px', letterSpacing: '0.3px',
              boxShadow: cart.length > 0 ? '0 8px 24px rgba(79,142,247,0.3)' : 'none'
            }}>
            {cart.length === 0 ? 'No items in cart' : `Complete Sale · ${cart.reduce((s, i) => s + i.cartQty, 0)} items`}
          </button>
        </div>
      </div>
    </div>
  );
}
