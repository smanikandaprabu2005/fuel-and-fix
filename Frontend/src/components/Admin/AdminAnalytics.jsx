import React, { useEffect, useState } from 'react';
import './AdminAnalytics.css';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import api from '../../services/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const AdminAnalytics = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await api.get('/admin/stats');
        if (!mounted) return;
        setStats(res.data);
      } catch (err) {
        console.error('Failed to load admin stats', err);
        // Fallback sample stats so charts render even in dev/local without backend
        if (mounted) setStats({ users: 12, mechanics: 4, deliveryPersons: 3, requests: 27, activeRequests: 2, completedRequests: 20 });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (e) {
      console.error('Refresh failed', e);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <div>Loading analytics...</div>;
  if (!stats) return <div>No stats available</div>;

  const data = {
    labels: ['Users', 'Mechanics', 'Delivery', 'Requests', 'Active', 'Completed'],
    datasets: [
      {
        label: 'Count',
        data: [stats.users, stats.mechanics, stats.deliveryPersons, stats.requests, stats.activeRequests, stats.completedRequests],
        backgroundColor: ['#1976d2', '#e53935', '#fdd835', '#43a047', '#8e24aa', '#00acc1']
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Platform Overview' }
    }
  };

  return (
    <div style={{ maxWidth: 1200, width: '100%', margin: '8px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -6 }}>
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>Admin Analytics</h2>
        {/* Refresh intentionally removed from UI; data refresh still possible programmatically */}
      </div>

      {/* Top summary cards removed per design — charts shown below */}

      <div style={{ background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginTop: 6, height: 360 }}>
        <Bar data={data} options={options} />
      </div>

      {/* Additional charts: Line (requests over time) and Pie (role distribution) */}
      <div style={{ display: 'flex', gap: 20, marginTop: 24, flexWrap: 'nowrap', alignItems: 'stretch' }}>
        <div style={{ flex: '0 0 360px', minWidth: 260, background: '#fff', padding: 12, borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>User / Provider Mix</h3>
          <Pie
            data={(() => {
              const users = stats.users || 0;
              const mechanics = stats.mechanics || 0;
              const delivery = stats.deliveryPersons || 0;
              const total = Math.max(1, users + mechanics + delivery);
              return {
                labels: ['Users', 'Mechanics', 'Delivery'],
                datasets: [
                  {
                    data: [users, mechanics, delivery],
                    backgroundColor: ['#1976d2', '#e53935', '#fdd835'],
                    hoverOffset: 6
                  }
                ]
              };
            })()}
            options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
          />
        </div>

  <div style={{ flex: '1 1 1%', minWidth: 600, background: '#fff', padding: 12, borderRadius: 8, height: 360 }}>
          <h3 style={{ marginTop: 0 }}>Requests Over Time</h3>
          <Line
            data={(() => {
              // Use server-provided time series if available, otherwise fallback sample
              const labels = stats.requestsOverTime?.labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
              const values = stats.requestsOverTime?.values || [3, 7, 12, 9, 15, 18];
              return {
                labels,
                datasets: [
                  {
                    label: 'Requests',
                    data: values,
                    borderColor: '#1976d2',
                    backgroundColor: 'rgba(25,118,210,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4
                  }
                ]
              };
            })()}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: false } } }}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
