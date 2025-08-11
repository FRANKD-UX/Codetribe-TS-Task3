import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Eye, Filter, ArrowUpDown } from 'lucide-react';

// Types
interface Job {
  id?: number;
  companyName: string;
  role: string;
  status: 'Applied' | 'Interviewed' | 'Rejected';
  dateApplied: string;
  jobDuties: string;
  requirements: string;
  companyAddress: string;
  contactDetails: string;
  userId: number;
}

interface User {
  id?: number;
  username: string;
  password: string;
}

interface URLParams {
  page: string;
  search?: string;
  filter?: string;
  sort?: string;
  jobId?: string;
}

const JobTracker: React.FC = () => {
  // JSON Server base URL - you'll need to start json-server on port 3001
  const API_BASE = 'http://localhost:3001';

  // State management
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // URL parameters state
  const [urlParams, setUrlParams] = useState<URLParams>({
    page: 'landing',
    search: '',
    filter: 'all',
    sort: 'desc'
  });

  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', password: '' });
  const [jobForm, setJobForm] = useState({
    companyName: '',
    role: '',
    status: 'Applied' as Job['status'],
    dateApplied: '',
    jobDuties: '',
    requirements: '',
    companyAddress: '',
    contactDetails: ''
  });

  // URL management
  const updateURL = (params: Partial<URLParams>) => {
    const newParams = { ...urlParams, ...params };
    setUrlParams(newParams);
    
    const searchParams = new URLSearchParams();
    searchParams.set('page', newParams.page);
    if (newParams.search) searchParams.set('search', newParams.search);
    if (newParams.filter && newParams.filter !== 'all') searchParams.set('filter', newParams.filter);
    if (newParams.sort && newParams.sort !== 'desc') searchParams.set('sort', newParams.sort);
    if (newParams.jobId) searchParams.set('jobId', newParams.jobId);
    
    window.history.pushState({}, '', `?${searchParams.toString()}`);
  };

  // Parse URL parameters on load
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const params: URLParams = {
      page: searchParams.get('page') || 'landing',
      search: searchParams.get('search') || '',
      filter: searchParams.get('filter') || 'all',
      sort: searchParams.get('sort') || 'desc',
      jobId: searchParams.get('jobId') || undefined
    };
    setUrlParams(params);
  }, []);

  // API functions
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API call failed:', error);
      alert('Server error. Please make sure JSON Server is running on port 3001');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Load user session and jobs
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      if (urlParams.page === 'landing' || urlParams.page === 'login') {
        updateURL({ page: 'home' });
      }
    }
  }, []);

  // Load jobs when user changes
  useEffect(() => {
    if (currentUser) {
      loadJobs();
    }
  }, [currentUser]);

  // Load specific job when jobId in URL
  useEffect(() => {
    if (urlParams.jobId && jobs.length > 0) {
      const job = jobs.find(j => j.id === parseInt(urlParams.jobId!));
      if (job) {
        setSelectedJob(job);
        updateURL({ page: 'job-detail' });
      }
    }
  }, [urlParams.jobId, jobs]);

  const loadJobs = async () => {
    if (!currentUser) return;
    const data = await apiCall(`/jobs?userId=${currentUser.id}`);
    if (data) {
      setJobs(data);
    }
  };

  // Authentication functions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const users = await apiCall(`/users?username=${loginForm.username}&password=${loginForm.password}`);
    
    if (users && users.length > 0) {
      const user = users[0];
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      updateURL({ page: 'home' });
      setLoginForm({ username: '', password: '' });
    } else {
      alert('Invalid credentials!');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if username exists
    const existingUsers = await apiCall(`/users?username=${registerForm.username}`);
    if (existingUsers && existingUsers.length > 0) {
      alert('Username already exists!');
      return;
    }

    const newUser = await apiCall('/users', {
      method: 'POST',
      body: JSON.stringify(registerForm)
    });

    if (newUser) {
      setRegisterForm({ username: '', password: '' });
      alert('Registration successful! Please login.');
      updateURL({ page: 'login' });
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    updateURL({ page: 'landing' });
  };

  // Job CRUD operations
  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const newJob = await apiCall('/jobs', {
      method: 'POST',
      body: JSON.stringify({ ...jobForm, userId: currentUser.id })
    });

    if (newJob) {
      loadJobs();
      resetJobForm();
    }
  };

  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    const updatedJob = await apiCall(`/jobs/${editingJob.id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...jobForm, userId: currentUser!.id, id: editingJob.id })
    });

    if (updatedJob) {
      loadJobs();
      resetJobForm();
      if (selectedJob && selectedJob.id === editingJob.id) {
        setSelectedJob(updatedJob);
      }
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (window.confirm('Are you sure you want to delete this job application?')) {
      const success = await apiCall(`/jobs/${jobId}`, { method: 'DELETE' });
      if (success !== null) {
        loadJobs();
        if (selectedJob && selectedJob.id === jobId) {
          updateURL({ page: 'home' });
          setSelectedJob(null);
        }
      }
    }
  };

  const resetJobForm = () => {
    setJobForm({
      companyName: '',
      role: '',
      status: 'Applied',
      dateApplied: '',
      jobDuties: '',
      requirements: '',
      companyAddress: '',
      contactDetails: ''
    });
    setShowJobForm(false);
    setEditingJob(null);
  };

  const startEditJob = (job: Job) => {
    setEditingJob(job);
    setJobForm({
      companyName: job.companyName,
      role: job.role,
      status: job.status,
      dateApplied: job.dateApplied,
      jobDuties: job.jobDuties,
      requirements: job.requirements,
      companyAddress: job.companyAddress,
      contactDetails: job.contactDetails
    });
    setShowJobForm(true);
  };

  // Filter and sort jobs based on URL parameters
  const getFilteredJobs = () => {
    let filteredJobs = [...jobs];

    // Apply search filter
    if (urlParams.search) {
      filteredJobs = filteredJobs.filter(job =>
        job.companyName.toLowerCase().includes(urlParams.search!.toLowerCase()) ||
        job.role.toLowerCase().includes(urlParams.search!.toLowerCase())
      );
    }

    // Apply status filter
    if (urlParams.filter && urlParams.filter !== 'all') {
      filteredJobs = filteredJobs.filter(job => job.status === urlParams.filter);
    }

    // Apply sorting
    filteredJobs.sort((a, b) => {
      const dateA = new Date(a.dateApplied).getTime();
      const dateB = new Date(b.dateApplied).getTime();
      return urlParams.sort === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return filteredJobs;
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'Applied': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Interviewed': return 'bg-green-100 text-green-800 border-green-200';
      case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Component render functions
  const renderLandingPage = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-indigo-600">JobTracker Pro</h1>
            <div className="space-x-4">
              <button 
                onClick={() => updateURL({ page: 'login' })}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                Login
              </button>
              <button 
                onClick={() => updateURL({ page: 'register' })}
                className="border border-indigo-600 text-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50 transition-colors"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-5xl font-bold text-gray-900 mb-6">
          Track Your Job Applications Like a Pro
        </h2>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Stay organized and increase your chances of landing your dream job. 
          Keep track of applications, interviews, and follow-ups all in one place.
        </p>
        
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="bg-blue-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Plus className="text-blue-600" size={24} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Easy Application Tracking</h3>
            <p className="text-gray-600">Add job applications with detailed company information and track their status.</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="bg-green-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Search className="text-green-600" size={24} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Search & Filter</h3>
            <p className="text-gray-600">Quickly find applications by company name, role, or status.</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="bg-purple-100 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <ArrowUpDown className="text-purple-600" size={24} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Organize & Sort</h3>
            <p className="text-gray-600">Sort applications by date and organize by status for better management.</p>
          </div>
        </div>

        <button 
          onClick={() => updateURL({ page: 'register' })}
          className="mt-12 bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Get Started - It's Free!
        </button>
      </div>
    </div>
  );

  const renderLoginPage = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Sign In</h2>
            <p className="text-gray-600 mt-2">Welcome back to JobTracker Pro</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={loading}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <button 
                onClick={() => updateURL({ page: 'register' })}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Sign up here
              </button>
            </p>
            <button 
              onClick={() => updateURL({ page: 'landing' })}
              className="text-gray-500 hover:text-gray-700 mt-2 text-sm"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRegisterPage = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
            <p className="text-gray-600 mt-2">Join JobTracker Pro today</p>
          </div>
          
          <form onSubmit={handleRegister} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={registerForm.username}
                onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={loading}
                minLength={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={loading}
                minLength={6}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <button 
                onClick={() => updateURL({ page: 'login' })}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Sign in here
              </button>
            </p>
            <button 
              onClick={() => updateURL({ page: 'landing' })}
              className="text-gray-500 hover:text-gray-700 mt-2 text-sm"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderHomePage = () => {
    const filteredJobs = getFilteredJobs();
    const statusCounts = {
      applied: jobs.filter(job => job.status === 'Applied').length,
      interviewed: jobs.filter(job => job.status === 'Interviewed').length,
      rejected: jobs.filter(job => job.status === 'Rejected').length
    };

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-indigo-600">JobTracker Pro</h1>
              <div className="flex items-center space-x-4">
                <span className="text-gray-600">Welcome, {currentUser?.username}!</span>
                <button 
                  onClick={handleLogout}
                  className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {loading && <div className="text-center py-4">Loading...</div>}
          
          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Applications</h3>
              <p className="text-3xl font-bold text-indigo-600">{jobs.length}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Applied</h3>
              <p className="text-3xl font-bold text-yellow-600">{statusCounts.applied}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Interviewed</h3>
              <p className="text-3xl font-bold text-green-600">{statusCounts.interviewed}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Rejected</h3>
              <p className="text-3xl font-bold text-red-600">{statusCounts.rejected}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search by company or role..."
                    value={urlParams.search || ''}
                    onChange={(e) => updateURL({ search: e.target.value })}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Filter size={20} className="text-gray-400" />
                  <select
                    value={urlParams.filter}
                    onChange={(e) => updateURL({ filter: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Status</option>
                    <option value="Applied">Applied</option>
                    <option value="Interviewed">Interviewed</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                
                <button
                  onClick={() => updateURL({ sort: urlParams.sort === 'desc' ? 'asc' : 'desc' })}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <ArrowUpDown size={16} />
                  Sort by Date ({urlParams.sort === 'desc' ? 'Newest' : 'Oldest'})
                </button>
              </div>
              
              <button
                onClick={() => {
                  setShowJobForm(true);
                  setEditingJob(null);
                  resetJobForm();
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                disabled={loading}
              >
                <Plus size={20} />
                Add New Application
              </button>
            </div>
          </div>

          {/* Jobs List */}
          <div className="space-y-4">
            {filteredJobs.length === 0 ? (
              <div className="bg-white p-12 rounded-lg shadow-md text-center">
                <p className="text-gray-500 text-lg">
                  {jobs.length === 0 
                    ? "No job applications found. Start by adding your first application!" 
                    : "No applications match your current filters."}
                </p>
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div key={job.id} className="bg-white p-6 rounded-lg shadow-md">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{job.role}</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-lg text-gray-700 mb-1">{job.companyName}</p>
                      <p className="text-sm text-gray-500">Applied on: {new Date(job.dateApplied).toLocaleDateString()}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedJob(job);
                          updateURL({ page: 'job-detail', jobId: job.id?.toString() });
                        }}
                        className="bg-blue-100 text-blue-700 p-2 rounded-md hover:bg-blue-200 transition-colors"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => startEditJob(job)}
                        className="bg-green-100 text-green-700 p-2 rounded-md hover:bg-green-200 transition-colors"
                        title="Edit"
                        disabled={loading}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id!)}
                        className="bg-red-100 text-red-700 p-2 rounded-md hover:bg-red-200 transition-colors"
                        title="Delete"
                        disabled={loading}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Job Form Modal */}
        {showJobForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {editingJob ? 'Edit Job Application' : 'Add New Job Application'}
                </h2>
                
                <form onSubmit={editingJob ? handleUpdateJob : handleAddJob} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                      <input
                        type="text"
                        value={jobForm.companyName}
                        onChange={(e) => setJobForm({...jobForm, companyName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                        disabled={loading}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                      <input
                        type="text"
                        value={jobForm.role}
                        onChange={(e) => setJobForm({...jobForm, role: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                      <select
                        value={jobForm.status}
                        onChange={(e) => setJobForm({...jobForm, status: e.target.value as Job['status']})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                        disabled={loading}
                      >
                        <option value="Applied">Applied</option>
                        <option value="Interviewed">Interviewed</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date Applied *</label>
                      <input
                        type="date"
                        value={jobForm.dateApplied}
                        onChange={(e) => setJobForm({...jobForm, dateApplied: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Address</label>
                    <input
                      type="text"
                      value={jobForm.companyAddress}
                      onChange={(e) => setJobForm({...jobForm, companyAddress: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={loading}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Details</label>
                    <input
                      type="text"
                      value={jobForm.contactDetails}
                      onChange={(e) => setJobForm({...jobForm, contactDetails: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Phone, Email, or Contact Person"
                      disabled={loading}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Duties</label>
                    <textarea
                      value={jobForm.jobDuties}
                      onChange={(e) => setJobForm({...jobForm, jobDuties: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                      placeholder="Describe the job responsibilities..."
                      disabled={loading}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Requirements</label>
                    <textarea
                      value={jobForm.requirements}
                      onChange={(e) => setJobForm({...jobForm, requirements: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                      placeholder="Skills, qualifications, experience required..."
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : editingJob ? 'Update Application' : 'Add Application'}
                    </button>
                    <button
                      type="button"
                      onClick={resetJobForm}
                      disabled={loading}
                      className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderJobDetailPage = () => {
    if (!selectedJob) {
      updateURL({ page: 'home' });
      return null;
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-indigo-600">JobTracker Pro</h1>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => updateURL({ page: 'home' })}
                  className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Back to Home
                </button>
                <span className="text-gray-600">Welcome, {currentUser?.username}!</span>
                <button 
                  onClick={handleLogout}
                  className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{selectedJob.role}</h1>
                  <h2 className="text-xl opacity-90">{selectedJob.companyName}</h2>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-medium border-2 border-white ${
                  selectedJob.status === 'Applied' ? 'bg-yellow-500' :
                  selectedJob.status === 'Interviewed' ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {selectedJob.status}
                </span>
              </div>
            </div>

            <div className="p-8">
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Application Details</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium text-gray-700">Date Applied:</span> {new Date(selectedJob.dateApplied).toLocaleDateString()}</p>
                    <p><span className="font-medium text-gray-700">Status:</span> {selectedJob.status}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Company Information</h3>
                  <div className="space-y-2">
                    {selectedJob.companyAddress && (
                      <p><span className="font-medium text-gray-700">Address:</span> {selectedJob.companyAddress}</p>
                    )}
                    {selectedJob.contactDetails && (
                      <p><span className="font-medium text-gray-700">Contact:</span> {selectedJob.contactDetails}</p>
                    )}
                  </div>
                </div>
              </div>

              {selectedJob.jobDuties && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Duties</h3>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.jobDuties}</p>
                  </div>
                </div>
              )}

              {selectedJob.requirements && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Requirements</h3>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.requirements}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-6 border-t">
                <button
                  onClick={() => startEditJob(selectedJob)}
                  disabled={loading}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Edit2 size={16} />
                  Edit Application
                </button>
                <button
                  onClick={() => handleDeleteJob(selectedJob.id!)}
                  disabled={loading}
                  className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Delete Application
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const render404Page = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-gray-300 mb-4">404</h1>
        <h2 className="text-3xl font-semibold text-gray-700 mb-4">Page Not Found</h2>
        <p className="text-gray-500 mb-8">The page you're looking for doesn't exist.</p>
        <button 
          onClick={() => updateURL({ page: currentUser ? 'home' : 'landing' })}
          className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  );

  // Route protection and rendering
  const renderPage = () => {
    // Protected routes
    if ((urlParams.page === 'home' || urlParams.page === 'job-detail') && !currentUser) {
      updateURL({ page: 'login' });
      return renderLoginPage();
    }

    // Handle invalid page routes
    const validPages = ['landing', 'login', 'register', 'home', 'job-detail', '404'];
    if (!validPages.includes(urlParams.page)) {
      updateURL({ page: '404' });
      return render404Page();
    }

    switch (urlParams.page) {
      case 'landing':
        return renderLandingPage();
      case 'login':
        return renderLoginPage();
      case 'register':
        return renderRegisterPage();
      case 'home':
        return renderHomePage();
      case 'job-detail':
        return renderJobDetailPage();
      case '404':
        return render404Page();
      default:
        return render404Page();
    }
  };

  return (
    <div className="font-sans">
      {renderPage()}
    </div>
  );
};

export default JobTracker;