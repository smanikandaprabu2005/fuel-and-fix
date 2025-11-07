import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import './PricingEditor.css';

const PricingEditor = () => {
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pricePerKm, setPricePerKm] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await api.get('api/pricing');
        if (!mounted) return;
        setPricing(res.data);
        setPricePerKm(res.data.pricePerKm || 7);
      } catch (err) {
        console.error('Failed to load pricing', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { pricePerKm: Number(pricePerKm) };
      const res = await api.post('/pricing', payload);
      setPricing(res.data);
      alert('Pricing updated');
    } catch (err) {
      console.error('Error saving pricing', err);
      alert('Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading pricing...</div>;

  return (
    <div className="pricing-editor">
      <h2>Pricing Editor</h2>
      <div>
        <label>Price per km (₹)</label>
        <input type="number" value={pricePerKm} onChange={e => setPricePerKm(e.target.value)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  );
};

export default PricingEditor;
