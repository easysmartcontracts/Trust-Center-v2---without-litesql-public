import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Download, Mail, FileText, AlertCircle } from 'lucide-react';

export function AnalyticsPanel() {
  const { getAuthHeaders } = useAuth();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/metrics', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const rawData = await res.json();
        // Group raw data to get counts
        const grouped: Record<string, any> = {};
        for(const m of rawData) {
          const key = `${m.event_type}-${m.product_slug}-${m.item_name}`;
          if (!grouped[key]) {
            grouped[key] = { ...m, count: 0 };
          }
          grouped[key].count++;
        }
        const groupedArray = Object.values(grouped).sort((a: any, b: any) => b.count - a.count);
        setMetrics(groupedArray);
      } else {
        setError('Failed to fetch metrics');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-slate-500">Loading metrics...</div>;
  if (error) return <div className="text-red-500 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {error}</div>;
  if (metrics.length === 0) return <div className="text-slate-500">No activity recorded yet.</div>;

  const eventTypeLabels: Record<string, { label: string, icon: React.ReactNode }> = {
    download_whitepaper: { label: 'Whitepaper Downloads', icon: <Download className="w-4 h-4" /> },
    request_certification: { label: 'Certification Requests', icon: <Mail className="w-4 h-4" /> },
    download_certification: { label: 'Certification Downloads', icon: <Download className="w-4 h-4" /> },
    request_policy: { label: 'Policy Requests', icon: <Mail className="w-4 h-4" /> },
    download_legal: { label: 'Legal Document Views', icon: <FileText className="w-4 h-4" /> },
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-400" /> Top Downloaded/Requested Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {metrics.slice(0, 10).map((m, i) => (
                <div key={i} className="p-4 flex justify-between items-center hover:bg-slate-50">
                  <div>
                    <h4 className="font-medium text-slate-900">{m.item_name || 'General Product Info'}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <span className="font-semibold text-blue-600">{m.product_slug}</span> &bull; 
                      {eventTypeLabels[m.event_type]?.icon}
                      {eventTypeLabels[m.event_type]?.label || m.event_type}
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-slate-100 text-slate-800 rounded-full font-bold text-sm">
                    {m.count}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
