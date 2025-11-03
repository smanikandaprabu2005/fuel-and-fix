import React, { useState } from 'react';
import './AdminPanel.css';
import { useNavigate } from 'react-router-dom';
import { adminCreateMechanic, adminCreateDelivery } from '../../services/authService';

const AdminPanel = () => {
  const [type, setType] = useState('mechanic');
  const [form, setForm] = useState({ name: '', email: '', phone: '', lat: 0, lng: 0, vehicleType: 'motorcycle' });
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (type === 'mechanic') {
        const res = await adminCreateMechanic({ ...form, specialties: [] });
        setResult(res.data);
      } else {
        const res = await adminCreateDelivery({ ...form });
        setResult(res.data);
      }
    } catch (err) {
      console.error(err);
      setResult({ error: 'Failed to create' });
    }
  };

  return (
    <div className="admin-panel">
      <h2>Admin Panel</h2>
      <div style={{ marginBottom: 12 }}>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/pricing')}>Edit Pricing</button>
        <button className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={() => navigate('/admin/analytics')}>View Analytics</button>
      </div>
      <div>
        <label>
          <input type="radio" checked={type==='mechanic'} onChange={() => setType('mechanic')} /> Mechanic
        </label>
        <label>
          <input type="radio" checked={type==='delivery'} onChange={() => setType('delivery')} /> Delivery
        </label>
      </div>

      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Name" value={form.name} onChange={handleChange} required />
        <input name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} required />
        <input name="lat" placeholder="Latitude" value={form.lat} onChange={handleChange} />
        <input name="lng" placeholder="Longitude" value={form.lng} onChange={handleChange} />
        {type === 'delivery' && (
          <select name="vehicleType" value={form.vehicleType} onChange={handleChange}>
            <option value="motorcycle">Motorcycle</option>
            <option value="car">Car</option>
            <option value="truck">Truck</option>
          </select>
        )}
        <button type="submit">Create</button>
      </form>

      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
};

export default AdminPanel;
