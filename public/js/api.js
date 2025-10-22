// API base URL
const API_BASE_URL = 'http://localhost:3000/api';

// Auth helpers
function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function clearToken() {
    localStorage.removeItem('token');
}

function isAuthenticated() {
    return !!getToken();
}

// API request wrapper
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Auth API
const authAPI = {
    login: async (email, password) => {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        return response.data;
    },

    register: async (userData) => {
        const response = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
        return response.data;
    },

    getProfile: async () => {
        const response = await apiRequest('/auth/profile');
        return response.data;
    },

    logout: () => {
        clearToken();
        window.location.href = '/portal/index.html';
    },
};

// Affiliate API
const affiliateAPI = {
    getDashboard: async (days = 30) => {
        const response = await apiRequest(`/affiliate/dashboard?days=${days}`);
        return response.data;
    },

    getTrackingLinks: async () => {
        const response = await apiRequest('/affiliate/tracking-links');
        return response.data;
    },

    createTrackingLink: async (linkData) => {
        const response = await apiRequest('/affiliate/tracking-links', {
            method: 'POST',
            body: JSON.stringify(linkData),
        });
        return response.data;
    },

    getCommissions: async (page = 1, filters = {}) => {
        const params = new URLSearchParams({ page, ...filters });
        const response = await apiRequest(`/affiliate/commissions?${params}`);
        return response;
    },

    getPayouts: async (page = 1) => {
        const response = await apiRequest(`/affiliate/payouts?page=${page}`);
        return response;
    },

    updateProfile: async (profileData) => {
        const response = await apiRequest('/affiliate/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData),
        });
        return response.data;
    },
};

// Clicks API
const clicksAPI = {
    getMyClicks: async (page = 1, filters = {}) => {
        const params = new URLSearchParams({ page, ...filters });
        const response = await apiRequest(`/clicks/my/clicks?${params}`);
        return response;
    },

    getMyStats: async (days = 30) => {
        const response = await apiRequest(`/clicks/my/stats?days=${days}`);
        return response.data;
    },
};

// Format currency
function formatCurrency(cents, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(cents / 100);
}

// Format date
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

// Protect page (redirect if not authenticated)
function protectPage() {
    if (!isAuthenticated()) {
        window.location.href = '/portal/index.html';
    }
}
