import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Activity, Mail, Download, ShieldCheck, FileText, Database, Filter, Printer } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function AdminKPI() {
  const { getAuthHeaders } = useAuth();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productFilter, setProductFilter] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, productsRes] = await Promise.all([
          fetch('/api/admin/metrics', { headers: getAuthHeaders() }),
          fetch('/api/public/products')
        ]);
        
        if (metricsRes.ok) {
          const data = await metricsRes.json();
          setMetrics(data);
        }
        if (productsRes.ok) {
          const data = await productsRes.json();
          setProducts(data);
        }
      } catch (err) {
        console.error('Failed to load KPIs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getAuthHeaders]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading KPI metrics...</div>;
  }

  // Filter metrics
  const filteredMetrics = metrics.filter(m => {
    if (productFilter !== 'all' && m.product_slug !== productFilter) return false;
    
    const metricDate = new Date(m.created_at);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (metricDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (metricDate > end) return false;
    }
    
    return true;
  });

  // Calculate totals and grouping
  const requests = filteredMetrics.filter(m => m.event_type.startsWith('request_'));
  const downloads = filteredMetrics.filter(m => m.event_type.startsWith('download_'));

  // Group by document type/name
  const getTopDocuments = (typePrefix: string, limit = 5) => {
    const grouped: Record<string, { name: string, product: string, count: number }> = {};
    const relevant = filteredMetrics.filter(m => m.event_type.startsWith(typePrefix));
    
    for (const m of relevant) {
      const key = `${m.item_name}-${m.product_slug}`;
      if (!grouped[key]) {
        grouped[key] = { name: m.item_name, product: m.product_slug, count: 0 };
      }
      grouped[key].count++;
    }
    
    return Object.values(grouped).sort((a, b) => b.count - a.count).slice(0, limit);
  };

  const topRequested = getTopDocuments('request_', 5);
  const topDownloaded = getTopDocuments('download_', 5);

  // Generate last 30 days chart data
  const getChartData = () => {
    const data = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      data.push({
        date: dateStr,
        displayDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        downloads: 0,
        requests: 0,
      });
    }

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    filteredMetrics.forEach((m: any) => {
      const metricDate = new Date(m.created_at);
      if (metricDate > thirtyDaysAgo) {
        const dateStr = metricDate.toISOString().split('T')[0];
        const dayData = data.find(d => d.date === dateStr);
        if (dayData) {
          if (m.event_type.startsWith('download_')) {
            dayData.downloads++;
          } else if (m.event_type.startsWith('request_')) {
            dayData.requests++;
          }
        }
      }
    });

    return data;
  };

  const chartData = getChartData();

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            KPI Dashboard
          </h1>
          <p className="text-slate-500 mt-1">Analytics and user access metrics for regulatory documents.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="print:hidden flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors shadow-sm font-medium text-sm"
        >
          <Printer className="w-4 h-4" />
          Print Report
        </button>
      </div>

      <Card className="mb-8 print:hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
              <select
                value={productFilter}
                onChange={e => setProductFilter(e.target.value)}
                className="w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="all">All Products</option>
                <option value="general">General Updates / Unspecified</option>
                {products.map(p => (
                  <option key={p.slug} value={p.slug}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            {(startDate || endDate || productFilter !== 'all') && (
              <div className="w-full sm:w-auto flex justify-end">
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setProductFilter('all');
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-md hover:bg-slate-200"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total Requests</p>
                <h3 className="text-2xl font-bold text-slate-900">{requests.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Direct Downloads</p>
                <h3 className="text-2xl font-bold text-slate-900">{downloads.length}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Unique Products</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  {new Set(filteredMetrics.map(m => m.product_slug)).size}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Document Types</p>
                <h3 className="text-2xl font-bold text-slate-900">
                  {new Set(filteredMetrics.map(m => m.item_name)).size}
                </h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">30-Day Activity Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="displayDate" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => Math.floor(value) === value ? value : ''} />
                <Tooltip 
                  contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '0.25rem' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line type="monotone" name="Downloads" dataKey="downloads" stroke="#4f46e5" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" name="Requests" dataKey="requests" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Requested Documents</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Document Name</th>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3 text-right">Requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topRequested.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-900">{item.name || 'Unknown'}</td>
                    <td className="px-6 py-3 text-slate-600">{item.product}</td>
                    <td className="px-6 py-3 text-right font-bold text-blue-600">{item.count}</td>
                  </tr>
                ))}
                {topRequested.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-slate-500 text-sm">
                      No requests found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 5 Downloaded Documents</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Document Name</th>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3 text-right">Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topDownloaded.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-medium text-slate-900">{item.name || 'Unknown'}</td>
                    <td className="px-6 py-3 text-slate-600">{item.product}</td>
                    <td className="px-6 py-3 text-right font-bold text-indigo-600">{item.count}</td>
                  </tr>
                ))}
                {topDownloaded.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-6 text-center text-slate-500 text-sm">
                      No downloads found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtered Activity Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action Type</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Item Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMetrics.slice(0, 100).map((m: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 whitespace-nowrap text-slate-500 font-mono text-xs">
                    {new Date(m.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-900">
                    {m.user_email || <span className="text-slate-400 italic">Unknown / Public</span>}
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={m.event_type.startsWith('request_') ? 'default' : 'secondary'} className="bg-blue-50 text-blue-700">
                      {m.event_type.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {m.product_slug}
                  </td>
                  <td className="px-6 py-3 text-slate-600 font-medium">
                    {m.item_name}
                  </td>
                </tr>
              ))}
              {filteredMetrics.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No metric events found for the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
