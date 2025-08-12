import React, { useState, useEffect } from 'react';
import './App.css'; 

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
  id: number;
  username: string;
  password: string;
}

interface URLParams {
  page: string;
  search: string;
  filter: string;
  sort: string;
  jobId?: string;
}

const JobTracker: React.FC = () => {
  // JSON Server base URL - ensure json-server is running on port 3001
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
  const [jobForm, setJobForm] = useState<Omit<Job, 'id' | 'userId'>>({
    companyName: '',
    role: '',
    status: 'Applied',
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

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

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
      localStorage.setItem('currentUser', JSON.stringify(user)); // <-- Save to localStorage
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
    localStorage.removeItem('currentUser'); // <-- Remove from localStorage
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
  const getFilteredJobs = (): Job[] => {
    let filteredJobs = [...jobs];

    // Apply search filter
    if (urlParams.search) {
      filteredJobs = filteredJobs.filter(job =>
        job.companyName.toLowerCase().includes(urlParams.search.toLowerCase()) ||
        job.role.toLowerCase().includes(urlParams.search.toLowerCase())
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

  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'Applied': return 'status-applied';
      case 'Interviewed': return 'status-interviewed';
      case 'Rejected': return 'status-rejected';
      default: return 'status-applied';
    }
  };

  // Icons
  const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>
  );

  const PlusIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );

  const EditIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  );

  const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3,6 5,6 21,6"></polyline>
      <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
    </svg>
  );

  const EyeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );

  const FilterIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"></polygon>
    </svg>
  );

  const ArrowUpDownIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m21,16-4,4-4,-4"></path>
      <path d="m17,20V4"></path>
      <path d="m3,8 4,-4 4,4"></path>
      <path d="M7,4V20"></path>
    </svg>
  );

  // Component render functions
  const renderLandingPage = () => (
    <div className="min-h-screen bg-gray-50">
      <nav className="navbar">
        <div className="container">
          <div className="nav-content">
            <h1 className="text-white font-bold">JobTracker Pro</h1>
            <div className="flex gap-4">
              <button 
                onClick={() => updateURL({ page: 'login' })}
                className="btn btn-outline text-white border-white hover:bg-white hover:text-blue-600"
              >
                Login
              </button>
              <button 
                onClick={() => updateURL({ page: 'register' })}
                className="btn bg-white text-blue-600 hover:bg-gray-100"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container hero-section">
        <h2 className="hero-title">
          Track Your Job Applications Like a Pro
        </h2>
        <p className="hero-description">
          Stay organized and increase your chances of landing your dream job. 
          Keep track of applications, interviews, and follow-ups all in one place.
        </p>
        
        <div className="grid grid-auto-fit mt-6">
          <div className="feature-card card">
            <div className="feature-icon">
              <PlusIcon />
            </div>
            <h3 className="mb-2">Easy Application Tracking</h3>
            <p className="text-gray-600">Add job applications with detailed company information and track their status.</p>
          </div>
          
          <div className="feature-card card">
            <div className="feature-icon">
              <SearchIcon />
            </div>
            <h3 className="mb-2">Smart Search & Filter</h3>
            <p className="text-gray-600">Quickly find applications by company name, role, or status.</p>
          </div>
          
          <div className="feature-card card">
            <div className="feature-icon">
              <ArrowUpDownIcon />
            </div>
            <h3 className="mb-2">Organize & Sort</h3>
            <p className="text-gray-600">Sort applications by date and organize by status for better management.</p>
          </div>
        </div>

        <button 
          onClick={() => updateURL({ page: 'register' })}
          className="btn btn-primary text-lg mt-6"
        >
          Get Started - It's Free!
        </button>
      </div>
    </div>
  );

  const renderLoginPage = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="container">
        <div className="card shadow-lg" style={{maxWidth: '400px', margin: '0 auto'}}>
          <div className="card-body">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-900">Sign In</h2>
              <p className="text-gray-600 mt-2">Welcome back to JobTracker Pro</p>
            </div>
            
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className="form-input"
                  required
                  disabled={loading}
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Don't have an account?{' '}
                <button 
                  onClick={() => updateURL({ page: 'register' })}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                  style={{background: 'none', border: 'none', cursor: 'pointer'}}
                >
                  Sign up here
                </button>
              </p>
              <button 
                onClick={() => updateURL({ page: 'landing' })}
                className="text-gray-500 hover:text-gray-700 mt-2 text-sm"
                style={{background: 'none', border: 'none', cursor: 'pointer'}}
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRegisterPage = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
      <div className="container">
        <div className="card shadow-lg" style={{maxWidth: '400px', margin: '0 auto'}}>
          <div className="card-body">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
              <p className="text-gray-600 mt-2">Join JobTracker Pro today</p>
            </div>
            
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                  className="form-input"
                  required
                  disabled={loading}
                  minLength={3}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                  className="form-input"
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Already have an account?{' '}
                <button 
                  onClick={() => updateURL({ page: 'login' })}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                  style={{background: 'none', border: 'none', cursor: 'pointer'}}
                >
                  Sign in here
                </button>
              </p>
              <button 
                onClick={() => updateURL({ page: 'landing' })}
                className="text-gray-500 hover:text-gray-700 mt-2 text-sm"
                style={{background: 'none', border: 'none', cursor: 'pointer'}}
              >
                Back to Home
              </button>
            </div>
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
        <nav className="navbar">
          <div className="container">
            <div className="nav-content">
              <h1 className="text-white font-bold">JobTracker Pro</h1>
              <div className="flex items-center gap-4">
                <span className="text-white">Welcome, {currentUser?.username}!</span>
                <button 
                  onClick={handleLogout}
                  className="btn btn-danger btn-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="container py-8">
          {loading && <div className="loading">Loading...</div>}
          
          {/* Stats Cards */}
          <div className="grid grid-cols-4 mb-8">
            <div className="stat-card card">
              <div className="card-body">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Applications</h3>
                <span className="stat-number text-blue-600">{jobs.length}</span>
              </div>
            </div>
            <div className="stat-card card">
              <div className="card-body">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Applied</h3>
                <span className="stat-number text-yellow-600">{statusCounts.applied}</span>
              </div>
            </div>
            <div className="stat-card card">
              <div className="card-body">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Interviewed</h3>
                <span className="stat-number text-green-600">{statusCounts.interviewed}</span>
              </div>
            </div>
            <div className="stat-card card">
              <div className="card-body">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Rejected</h3>
                <span className="stat-number text-red-600">{statusCounts.rejected}</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="card mb-6">
            <div className="card-body">
              <div className="controls-section">
                <div className="controls-left">
                  <div className="search-container">
                    <div className="search-icon">
                      <SearchIcon />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by company or role..."
                      value={urlParams.search || ''}
                      onChange={(e) => updateURL({ search: e.target.value })}
                      className="form-input search-input"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <FilterIcon />
                    <select
                      value={urlParams.filter}
                      onChange={(e) => updateURL({ filter: e.target.value })}
                      className="form-select"
                    >
                      <option value="all">All Status</option>
                      <option value="Applied">Applied</option>
                      <option value="Interviewed">Interviewed</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={() => updateURL({ sort: urlParams.sort === 'desc' ? 'asc' : 'desc' })}
                    className="btn btn-outline flex items-center gap-2"
                  >
                    <ArrowUpDownIcon />
                    Sort by Date ({urlParams.sort === 'desc' ? 'Newest' : 'Oldest'})
                  </button>
                </div>
                
                <button
                  onClick={() => {
                    setShowJobForm(true);
                    setEditingJob(null);
                    resetJobForm();
                  }}
                  className="btn btn-primary flex items-center gap-2"
                  disabled={loading}
                >
                  <PlusIcon />
                  Add New Application
                </button>
              </div>
            </div>
          </div>

          {/* Jobs List */}
          <div className="grid gap-4">
            {filteredJobs.length === 0 ? (
              <div className="empty-state card">
                <div className="card-body">
                  <p className="text-lg">
                    {jobs.length === 0 
                      ? "No job applications found. Start by adding your first application!" 
                      : "No applications match your current filters."}
                  </p>
                </div>
              </div>
            ) : (
              filteredJobs.map((job) => (
                <div key={job.id} className="card">
                  <div className="card-body">
                    <div className="flex flex-col gap-4" style={{gap: '1rem'}}>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-xl font-semibold text-gray-900">{job.role}</h3>
                            <span className={`status-badge ${getStatusClass(job.status)}`}>
                              {job.status}
                            </span>
                          </div>
                          <p className="text-lg text-gray-700 mb-1">{job.companyName}</p>
                          <p className="text-sm text-gray-500">Applied on: {new Date(job.dateApplied).toLocaleDateString()}</p>
                        </div>
                        
                        <div className="job-actions">
                          <button
                            onClick={() => {
                              setSelectedJob(job);
                              updateURL({ page: 'job-detail', jobId: job.id?.toString() });
                            }}
                            className="btn btn-sm bg-blue-100 text-blue-700 hover:bg-blue-200"
                            title="View Details"
                          >
                            <EyeIcon />
                          </button>
                          <button
                            onClick={() => startEditJob(job)}
                            className="btn btn-sm bg-green-100 text-green-700 hover:bg-green-200"
                            title="Edit"
                            disabled={loading}
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => handleDeleteJob(job.id!)}
                            className="btn btn-sm bg-red-100 text-red-700 hover:bg-red-200"
                            title="Delete"
                            disabled={loading}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Job Form Modal */}
        {showJobForm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2 className="font-bold text-gray-900">
                  {editingJob ? 'Edit Job Application' : 'Add New Job Application'}
                </h2>
              </div>
              <div className="modal-body">
                <form onSubmit={editingJob ? handleUpdateJob : handleAddJob}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Company Name *</label>
                      <input
                        type="text"
                        value={jobForm.companyName}
                        onChange={(e) => setJobForm({...jobForm, companyName: e.target.value})}
                        className="form-input"
                        required
                        disabled={loading}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Role *</label>
                      <input
                        type="text"
                        value={jobForm.role}
                        onChange={(e) => setJobForm({...jobForm, role: e.target.value})}
                        className="form-input"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Status *</label>
                      <select
                        value={jobForm.status}
                        onChange={(e) => setJobForm({...jobForm, status: e.target.value as Job['status']})}
                        className="form-select"
                        required
                        disabled={loading}
                      >
                        <option value="Applied">Applied</option>
                        <option value="Interviewed">Interviewed</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Date Applied *</label>
                      <input
                        type="date"
                        value={jobForm.dateApplied}
                        onChange={(e) => setJobForm({...jobForm, dateApplied: e.target.value})}
                        className="form-input"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Company Address</label>
                    <input
                      type="text"
                      value={jobForm.companyAddress}
                      onChange={(e) => setJobForm({...jobForm, companyAddress: e.target.value})}
                      className="form-input"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Contact Details</label>
                    <input
                      type="text"
                      value={jobForm.contactDetails}
                      onChange={(e) => setJobForm({...jobForm, contactDetails: e.target.value})}
                      className="form-input"
                      placeholder="Phone, Email, or Contact Person"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Job Duties</label>
                    <textarea
                      value={jobForm.jobDuties}
                      onChange={(e) => setJobForm({...jobForm, jobDuties: e.target.value})}
                      className="form-textarea"
                      rows={3}
                      placeholder="Describe the job responsibilities..."
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Requirements</label>
                    <textarea
                      value={jobForm.requirements}
                      onChange={(e) => setJobForm({...jobForm, requirements: e.target.value})}
                      className="form-textarea"
                      rows={3}
                      placeholder="Skills, qualifications, experience required..."
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="modal-actions">
                    <button
                      type="button"
                      onClick={resetJobForm}
                      disabled={loading}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn btn-primary"
                    >
                      {loading ? 'Saving...' : editingJob ? 'Update Application' : 'Add Application'}
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
        <nav className="navbar">
          <div className="container">
            <div className="nav-content">
              <h1 className="text-white font-bold">JobTracker Pro</h1>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => updateURL({ page: 'home' })}
                  className="btn btn-secondary btn-sm"
                >
                  Back to Home
                </button>
                <span className="text-white">Welcome, {currentUser?.username}!</span>
                <button 
                  onClick={handleLogout}
                  className="btn btn-danger btn-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="container py-8">
          <div className="card shadow-lg">
            <div className="job-detail-header">
              <div>
                <h1 className="text-3xl font-bold mb-2">{selectedJob.role}</h1>
                <h2 className="text-xl">{selectedJob.companyName}</h2>
              </div>
              <span className={`status-badge ${getStatusClass(selectedJob.status)}`} style={{padding: '0.5rem 1rem', fontSize: '0.875rem'}}>
                {selectedJob.status}
              </span>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-6 mb-8">
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
                <div className="detail-section">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Duties</h3>
                  <div className="detail-content">
                    <p className="text-gray-700" style={{whiteSpace: 'pre-wrap'}}>{selectedJob.jobDuties}</p>
                  </div>
                </div>
              )}

              {selectedJob.requirements && (
                <div className="detail-section">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Requirements</h3>
                  <div className="detail-content">
                    <p className="text-gray-700" style={{whiteSpace: 'pre-wrap'}}>{selectedJob.requirements}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-4 mt-6 pt-6" style={{borderTop: '1px solid #e5e7eb'}}>
                <button
                  onClick={() => startEditJob(selectedJob)}
                  disabled={loading}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <EditIcon />
                  Edit Application
                </button>
                <button
                  onClick={() => handleDeleteJob(selectedJob.id!)}
                  disabled={loading}
                  className="btn btn-danger flex items-center gap-2"
                >
                  <TrashIcon />
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
          className="btn btn-primary"
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