import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Dashboard = ({ token, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Endpoint form state
  const [newEndpoint, setNewEndpoint] = useState({
    endpoint: '',
    method: 'GET',
    requests_per_minute: 60,
    burst_size: 10
  });

  // User override form state
  const [newUserOverride, setNewUserOverride] = useState({
    user_id: '',
    requests_per_minute: 100,
    burst_size: 20
  });

  const apiCall = async (url, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (response.status === 401) {
      onLogout();
      return null;
    }

    return response;
  };

  const loadConfig = async () => {
    try {
      const response = await apiCall('/api/config');
      if (response && response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (err) {
      setError('Failed to load configuration');
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiCall('/api/stats');
      if (response && response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadConfig(), loadStats()]);
      setLoading(false);
    };

    loadData();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAddEndpoint = async () => {
    if (!newEndpoint.endpoint) {
      setError('Endpoint path is required');
      return;
    }

    try {
      const response = await apiCall('/api/endpoints', {
        method: 'POST',
        body: JSON.stringify(newEndpoint)
      });

      if (response && response.ok) {
        await loadConfig();
        setNewEndpoint({
          endpoint: '',
          method: 'GET',
          requests_per_minute: 60,
          burst_size: 10
        });
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add endpoint');
      }
    } catch (err) {
      setError('Failed to add endpoint');
    }
  };

  const handleAddUserOverride = async () => {
    if (!newUserOverride.user_id) {
      setError('User ID is required');
      return;
    }

    try {
      const response = await apiCall('/api/users', {
        method: 'POST',
        body: JSON.stringify(newUserOverride)
      });

      if (response && response.ok) {
        await loadConfig();
        setNewUserOverride({
          user_id: '',
          requests_per_minute: 100,
          burst_size: 20
        });
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add user override');
      }
    } catch (err) {
      setError('Failed to add user override');
    }
  };

  const handleDeleteEndpoint = async (endpoint, method) => {
    try {
      const response = await apiCall(`/api/endpoints/${encodeURIComponent(endpoint)}/${method}`, {
        method: 'DELETE'
      });

      if (response && response.ok) {
        await loadConfig();
      }
    } catch (err) {
      setError('Failed to delete endpoint');
    }
  };

  const handleDeleteUserOverride = async (userId) => {
    try {
      const response = await apiCall(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      });

      if (response && response.ok) {
        await loadConfig();
      }
    } catch (err) {
      setError('Failed to delete user override');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">API Gateway Admin</h1>
            </div>
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: 'Overview', icon: '📊' },
              { id: 'endpoints', name: 'Endpoints', icon: '🔗' },
              { id: 'users', name: 'User Overrides', icon: '👥' },
              { id: 'stats', name: 'Statistics', icon: '📈' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
            <button
              onClick={() => setError('')}
              className="float-right text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Configuration Overview
                </h3>
                {config && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {config.default_requests_per_minute}
                      </div>
                      <div className="text-sm text-blue-800">Default RPM</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {Object.keys(config.endpoints || {}).length}
                      </div>
                      <div className="text-sm text-green-800">Configured Endpoints</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {Object.keys(config.user_overrides || {}).length}
                      </div>
                      <div className="text-sm text-purple-800">User Overrides</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {stats && (
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    Recent Activity (Last 5 Minutes)
                  </h3>
                  <div className="space-y-2">
                    {stats.global_stats.map((stat, index) => (
                      <div key={index} className="flex justify-between items-center py-2 border-b">
                        <div className="text-sm text-gray-600">
                          Minute {stat.minute}
                        </div>
                        <div className="flex space-x-4 text-sm">
                          <span className="text-green-600">✓ {stat.allowed}</span>
                          <span className="text-red-600">✗ {stat.blocked}</span>
                          <span className="text-gray-600">Total: {stat.total}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'endpoints' && (
          <div className="space-y-6">
            {/* Add New Endpoint */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Add New Endpoint Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input
                    type="text"
                    placeholder="Endpoint path (e.g., /api/users)"
                    className="border border-gray-300 rounded-md px-3 py-2"
                    value={newEndpoint.endpoint}
                    onChange={(e) => setNewEndpoint({...newEndpoint, endpoint: e.target.value})}
                  />
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2"
                    value={newEndpoint.method}
                    onChange={(e) => setNewEndpoint({...newEndpoint, method: e.target.value})}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Requests per minute"
                    className="border border-gray-300 rounded-md px-3 py-2"
                    value={newEndpoint.requests_per_minute}
                    onChange={(e) => setNewEndpoint({...newEndpoint, requests_per_minute: parseInt(e.target.value)})}
                  />
                  <input
                    type="number"
                    placeholder="Burst size"
                    className="border border-gray-300 rounded-md px-3 py-2"
                    value={newEndpoint.burst_size}
                    onChange={(e) => setNewEndpoint({...newEndpoint, burst_size: parseInt(e.target.value)})}
                  />
                </div>
                <button
                  onClick={handleAddEndpoint}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Add Endpoint
                </button>
              </div>
            </div>

            {/* Existing Endpoints */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Configured Endpoints
                </h3>
                {config && config.endpoints && Object.keys(config.endpoints).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(config.endpoints).map(([endpoint, methods]) => (
                      <div key={endpoint} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{endpoint}</h4>
                        <div className="space-y-2">
                          {Object.entries(methods).map(([method, config]) => (
                            <div key={method} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                              <div className="flex items-center space-x-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {method}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {config.requests_per_minute} RPM, {config.burst_size} burst
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteEndpoint(endpoint, method)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No endpoint configurations found.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Add New User Override */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Add User Override
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="User ID"
                    className="border border-gray-300 rounded-md px-3 py-2"
                    value={newUserOverride.user_id}
                    onChange={(e) => setNewUserOverride({...newUserOverride, user_id: e.target.value})}
                  />
                  <input
                    type="number"
                    placeholder="Requests per minute"
                    className="border border-gray-300 rounded-md px-3 py-2"
                    value={newUserOverride.requests_per_minute}
                    onChange={(e) => setNewUserOverride({...newUserOverride, requests_per_minute: parseInt(e.target.value)})}
                  />
                  <input
                    type="number"
                    placeholder="Burst size"
                    className="border border-gray-300 rounded-md px-3 py-2"
                    value={newUserOverride.burst_size}
                    onChange={(e) => setNewUserOverride({...newUserOverride, burst_size: parseInt(e.target.value)})}
                  />
                </div>
                <button
                  onClick={handleAddUserOverride}
                  className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Add User Override
                </button>
              </div>
            </div>

            {/* Existing User Overrides */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  User Overrides
                </h3>
                {config && config.user_overrides && Object.keys(config.user_overrides).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(config.user_overrides).map(([userId, userConfig]) => (
                      <div key={userId} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{userId}</div>
                          <div className="text-sm text-gray-600">
                            {userConfig.requests_per_minute} RPM, {userConfig.burst_size} burst
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteUserOverride(userId)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No user overrides configured.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Rate Limiting Statistics
                  </h3>
                  <button
                    onClick={loadStats}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Refresh
                  </button>
                </div>
                
                {stats ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {stats.global_stats.slice(0, 1).map((stat) => (
                        <div key="current" className="space-y-4">
                          <div className="bg-green-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{stat.allowed}</div>
                            <div className="text-sm text-green-800">Requests Allowed</div>
                          </div>
                          <div className="bg-red-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-red-600">{stat.blocked}</div>
                            <div className="text-sm text-red-800">Requests Blocked</div>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{stat.total}</div>
                            <div className="text-sm text-blue-800">Total Requests</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8">
                      <h4 className="text-md font-medium text-gray-900 mb-4">Request History (Last 5 Minutes)</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Minute
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Allowed
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Blocked
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Block Rate
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {stats.global_stats.map((stat, index) => (
                              <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {new Date(stat.minute * 60 * 1000).toLocaleTimeString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {stat.total}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                                  {stat.allowed}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                                  {stat.blocked}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {stat.total > 0 ? ((stat.blocked / stat.total) * 100).toFixed(1) : 0}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">Loading statistics...</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;