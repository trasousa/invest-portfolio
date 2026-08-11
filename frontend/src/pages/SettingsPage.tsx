import React, { useState } from 'react';
import axios from 'axios';
import { FaUser, FaPalette, FaSignOutAlt, FaCheck, FaRobot, FaDollarSign, FaHistory, FaClock, FaSync, FaTimes } from 'react-icons/fa';

import type { UserProfile } from '../types';

interface Props {
    token: string;
    onLogout: () => void;
    onProfileUpdate: () => Promise<void>;
    userProfile: UserProfile | null;
}

interface ChatHistoryItem {
    id: string;
    message: string;
    response: string;
    provider: string;
    timestamp: string;
}

interface SyncJobStatus {
    status: 'idle' | 'running' | 'success' | 'error';
    message: string;
    result: { positions_updated: number; transactions_imported: number; dividends_updated: number } | null;
}

/**
 * Trading 212 builds the export asynchronously and rate limits status checks to
 * once a minute, so a sync can run for several minutes. The request only kicks
 * the job off; the outcome is polled from /sync/status.
 */
const SYNC_POLL_INTERVAL_MS = 3000;
const SYNC_TIMEOUT_MS = 12 * 60 * 1000;

async function pollSyncStatus(
    token: string,
    onProgress: (message: string) => void
): Promise<SyncJobStatus> {
    const deadline = Date.now() + SYNC_TIMEOUT_MS;

    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, SYNC_POLL_INTERVAL_MS));

        const { data } = await axios.get<SyncJobStatus>('/api/connectors/trading212/sync/status', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (data.status === 'success' || data.status === 'error') {
            return data;
        }
        if (data.message) {
            onProgress(data.message);
        }
    }

    throw new Error('Sync is taking longer than expected. Check back in a few minutes.');
}

export const SettingsPage: React.FC<Props> = ({ token, onLogout, onProfileUpdate, userProfile }) => {
    const [theme, setTheme] = useState('ocean-dark');
    const [profileData, setProfileData] = useState<Partial<UserProfile>>({
        trading212_api_key: ''
    });
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string>('');

    const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
    const [chatLoading, setChatLoading] = useState(false);

    // Load initial data
    React.useEffect(() => {
        if (userProfile) {
            setProfileData({
                display_name: userProfile.display_name || '',
                bio: userProfile.bio || '',
                profile_image_url: userProfile.profile_image_url || '',
                openai_api_key: userProfile.openai_api_key || '',
                gemini_api_key: userProfile.gemini_api_key || '',
                ollama_url: userProfile.ollama_url || '',
                // The profile endpoint returns bullet placeholders, never the real
                // credentials - keep the inputs empty so we can't post the mask back.
                trading212_api_key: '',
                trading212_api_secret: '',
                trading212_is_demo: userProfile.trading212_is_demo || false
            } as any);
            setTheme(userProfile.theme_preference || 'ocean-dark');
        } else {
            const loadData = async () => {
                try {
                    const res = await axios.get('/api/auth/profile', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setProfileData({
                        display_name: res.data.display_name || '',
                        bio: res.data.bio || '',
                        profile_image_url: res.data.profile_image_url || '',
                        openai_api_key: res.data.openai_api_key || '',
                        gemini_api_key: res.data.gemini_api_key || '',
                        ollama_url: res.data.ollama_url || '',
                        trading212_api_key: '',
                        trading212_api_secret: '',
                        trading212_is_demo: res.data.trading212_is_demo || false
                    } as any);
                    setTheme(res.data.theme_preference || 'ocean-dark');
                } catch (err) {
                    console.error(err);
                }
            };
            loadData();
        }
    }, [token, userProfile]);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.put('/api/auth/profile', profileData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await onProfileUpdate();
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile.');
        }
    };

    const handleThemeChange = async (newTheme: string) => {
        setTheme(newTheme);
        try {
            await axios.put('/api/auth/theme', { theme_preference: newTheme }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await onProfileUpdate();
        } catch (error) {
            console.error('Error saving theme:', error);
        }
    };

    const handleCurrencyChange = async (newCurrency: string) => {
        try {
            await axios.put('/api/auth/profile', { currency: newCurrency }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await onProfileUpdate();
        } catch (error) {
            console.error('Error saving currency:', error);
        }
    };

    const handleTestKey = async (provider: string, key: string) => {
        try {
            await axios.post('/api/auth/test-key', { provider, api_key: key }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`${provider} API Key is valid!`);
        } catch (error: any) {
            console.error('Error testing key:', error);
            alert(`Failed to validate key: ${error.response?.data?.detail || error.message} `);
        }
    };

    const fetchChatHistory = async () => {
        setChatLoading(true);
        try {
            const res = await axios.get('/api/chat/history', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChatHistory(res.data);
        } catch (error) {
            console.error('Error fetching chat history:', error);
        } finally {
            setChatLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    const [activeTab, setActiveTab] = useState('profile');

    React.useEffect(() => {
        if (activeTab === 'history') {
            fetchChatHistory();
        }
    }, [activeTab]);

    return (
        <div className="p-6 max-w-6xl mx-auto h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Settings</h1>
                    <p className="text-text-secondary">Customize your FinNexus experience</p>
                </div>
                <button
                    onClick={onLogout}
                    className="btn bg-danger/10 text-danger hover:bg-danger/20 flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                >
                    <FaSignOutAlt /> Sign Out
                </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto pb-1">
                {[
                    { id: 'profile', label: 'Profile', icon: FaUser },
                    { id: 'ai', label: 'AI Credentials', icon: FaRobot },
                    { id: 'history', label: 'Chat History', icon: FaHistory },
                    { id: 'appearance', label: 'Appearance', icon: FaPalette },
                    { id: 'preferences', label: 'Preferences', icon: FaDollarSign },
                    { id: 'brokerage', label: 'Brokerage', icon: FaDollarSign },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items - center gap - 2 px - 4 py - 3 rounded - t - lg transition - colors whitespace - nowrap ${activeTab === tab.id
                            ? 'bg-surface/50 text-primary border-b-2 border-primary font-medium'
                            : 'text-text-secondary hover:text-white hover:bg-white/5'
                            } `}
                    >
                        <tab.icon />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pr-2">
                {activeTab === 'profile' && (
                    <div className="bg-surface/50 backdrop-blur-md p-8 rounded-xl border border-border shadow-lg animate-fade-in">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-primary/20 rounded-full text-primary text-xl"><FaUser /></div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Personal Info</h2>
                                <p className="text-text-secondary text-sm">Update your profile details</p>
                            </div>
                        </div>
                        <form onSubmit={handleProfileUpdate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">Display Name</label>
                                    <input
                                        type="text"
                                        value={profileData.display_name}
                                        onChange={e => setProfileData({ ...profileData, display_name: e.target.value })}
                                        className="auth-input w-full"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Profile Image URL</label>
                                    <input
                                        type="text"
                                        value={profileData.profile_image_url}
                                        onChange={e => setProfileData({ ...profileData, profile_image_url: e.target.value })}
                                        className="auth-input w-full"
                                        placeholder="https://example.com/avatar.jpg"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Bio</label>
                                <textarea
                                    value={profileData.bio}
                                    onChange={e => setProfileData({ ...profileData, bio: e.target.value })}
                                    className="auth-input w-full min-h-[80px]"
                                    placeholder="Tell us about yourself..."
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-full md:w-auto">
                                Save Profile
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="bg-surface/50 backdrop-blur-md p-8 rounded-xl border border-border shadow-lg animate-fade-in">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-accent/20 rounded-full text-accent text-xl"><FaRobot /></div>
                            <div>
                                <h2 className="text-xl font-bold text-white">AI Credentials</h2>
                                <p className="text-text-secondary text-sm">Connect your AI models</p>
                            </div>
                        </div>
                        <form onSubmit={handleProfileUpdate} className="space-y-4">
                            <div className="form-group">
                                <label className="form-label">OpenAI API Key</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={profileData.openai_api_key}
                                        onChange={e => setProfileData({ ...profileData, openai_api_key: e.target.value })}
                                        className="auth-input w-full"
                                        placeholder={userProfile?.openai_api_key ? "•••••••• (Configured)" : "sk-..."}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleTestKey('openai', profileData.openai_api_key)}
                                        className="btn btn-secondary whitespace-nowrap"
                                        disabled={!profileData.openai_api_key}
                                    >
                                        Test
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Gemini API Key</label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={profileData.gemini_api_key}
                                        onChange={e => setProfileData({ ...profileData, gemini_api_key: e.target.value })}
                                        className="auth-input w-full"
                                        placeholder={userProfile?.gemini_api_key ? "•••••••• (Configured)" : "AIza..."}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleTestKey('gemini', profileData.gemini_api_key)}
                                        className="btn btn-secondary whitespace-nowrap"
                                        disabled={!profileData.gemini_api_key}
                                    >
                                        Test
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ollama URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={profileData.ollama_url}
                                        onChange={e => setProfileData({ ...profileData, ollama_url: e.target.value })}
                                        className="auth-input w-full"
                                        placeholder={userProfile?.ollama_url || "http://localhost:11434"}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleTestKey('ollama', profileData.ollama_url)}
                                        className="btn btn-secondary whitespace-nowrap"
                                        disabled={!profileData.ollama_url}
                                    >
                                        Test
                                    </button>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary w-full md:w-auto">
                                Save Keys
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="bg-surface/50 backdrop-blur-md p-8 rounded-xl border border-border shadow-lg animate-fade-in">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-primary/20 rounded-full text-primary text-xl"><FaHistory /></div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Chat History</h2>
                                <p className="text-text-secondary text-sm">Your previous conversations with Finn</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {chatLoading ? (
                                <div className="text-center text-text-secondary py-10">Loading history...</div>
                            ) : chatHistory.length === 0 ? (
                                <div className="text-center text-text-secondary py-10 flex flex-col items-center">
                                    <FaHistory className="text-4xl mb-4 opacity-50" />
                                    <p>No chat history found.</p>
                                </div>
                            ) : (
                                chatHistory.map((item) => (
                                    <div key={item.id} className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        <div className="bg-white/5 p-3 flex justify-between items-center text-xs text-text-secondary border-b border-white/5">
                                            <div className="flex items-center gap-2">
                                                <FaClock /> {formatDate(item.timestamp)}
                                            </div>
                                            <div className="uppercase tracking-wider font-semibold opacity-70">
                                                {item.provider}
                                            </div>
                                        </div>
                                        <div className="p-4 space-y-4">
                                            <div className="flex gap-3">
                                                <div className="mt-1 min-w-[24px]">
                                                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">
                                                        <FaUser />
                                                    </div>
                                                </div>
                                                <div className="text-white/90 leading-relaxed">
                                                    {item.message}
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="mt-1 min-w-[24px]">
                                                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs">
                                                        <FaRobot />
                                                    </div>
                                                </div>
                                                <div className="text-text-secondary leading-relaxed whitespace-pre-wrap">
                                                    {item.response}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'appearance' && (
                    <div className="bg-surface/50 backdrop-blur-md p-8 rounded-xl border border-border shadow-lg animate-fade-in">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-secondary/20 rounded-full text-secondary text-xl"><FaPalette /></div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Appearance</h2>
                                <p className="text-text-secondary text-sm">Choose your preferred theme</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <button
                                onClick={() => handleThemeChange('light')}
                                className={`p - 4 rounded - xl border - 2 transition - all text - left ${theme === 'light' ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:border-primary/50'} `}
                            >
                                <div className="w-full h-24 bg-[#f8fafc] rounded-lg mb-3 border border-slate-200 relative overflow-hidden shadow-inner">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-orange-500"></div>
                                    <div className="absolute top-4 left-4 w-16 h-2 bg-slate-200 rounded"></div>
                                    <div className="absolute top-8 left-4 w-10 h-2 bg-slate-200 rounded"></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-white">Light Mode</span>
                                    {theme === 'light' && <div className="text-primary"><FaCheck /></div>}
                                </div>
                            </button>
                            <button
                                onClick={() => handleThemeChange('ocean-dark')}
                                className={`p - 4 rounded - xl border - 2 transition - all text - left ${theme === 'ocean-dark' ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:border-primary/50'} `}
                            >
                                <div className="w-full h-24 bg-[#0f172a] rounded-lg mb-3 border border-white/10 relative overflow-hidden shadow-inner">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
                                    <div className="absolute top-4 left-4 w-16 h-2 bg-white/10 rounded"></div>
                                    <div className="absolute top-8 left-4 w-10 h-2 bg-white/10 rounded"></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-white">Ocean Dark</span>
                                    {theme === 'ocean-dark' && <div className="text-primary"><FaCheck /></div>}
                                </div>
                            </button>

                            <button
                                onClick={() => handleThemeChange('midnight-blue')}
                                className={`p - 4 rounded - xl border - 2 transition - all text - left ${theme === 'midnight-blue' ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:border-primary/50'} `}
                            >
                                <div className="w-full h-24 bg-[#1e1b4b] rounded-lg mb-3 border border-white/10 relative overflow-hidden shadow-inner">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                                    <div className="absolute top-4 left-4 w-16 h-2 bg-white/10 rounded"></div>
                                    <div className="absolute top-8 left-4 w-10 h-2 bg-white/10 rounded"></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-white">Midnight Blue</span>
                                    {theme === 'midnight-blue' && <div className="text-primary"><FaCheck /></div>}
                                </div>
                            </button>

                            <button
                                onClick={() => handleThemeChange('forest-green')}
                                className={`p - 4 rounded - xl border - 2 transition - all text - left ${theme === 'forest-green' ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:border-primary/50'} `}
                            >
                                <div className="w-full h-24 bg-[#064e3b] rounded-lg mb-3 border border-white/10 relative overflow-hidden shadow-inner">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>
                                    <div className="absolute top-4 left-4 w-16 h-2 bg-white/10 rounded"></div>
                                    <div className="absolute top-8 left-4 w-10 h-2 bg-white/10 rounded"></div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-white">Forest Green</span>
                                    {theme === 'forest-green' && <div className="text-primary"><FaCheck /></div>}
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'brokerage' && (
                    <div className="bg-surface/50 backdrop-blur-md p-8 rounded-xl border border-border shadow-lg animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-success/20 rounded-full text-success text-xl"><FaDollarSign /></div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Brokerage Connections</h2>
                                    <p className="text-text-secondary text-sm">Connect your investment accounts</p>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!userProfile?.trading212_api_key) {
                                        alert('No brokerages connected to sync');
                                        return;
                                    }
                                    setIsSyncing(true);
                                    setSyncStatus('Starting sync...');
                                    try {
                                        await axios.post('/api/connectors/trading212/sync', {}, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        const job = await pollSyncStatus(token, setSyncStatus);
                                        if (job.status === 'error') {
                                            throw new Error(job.message);
                                        }
                                        alert(`All brokerages synced! Updated ${job.result?.positions_updated ?? 0} positions.`);
                                        window.location.reload();
                                    } catch (error: any) {
                                        console.error('Sync failed:', error);
                                        setSyncStatus('');
                                        setIsSyncing(false);
                                        alert(`Sync failed: ${error.response?.data?.detail || error.message}`);
                                    }
                                }}
                                className="btn btn-sm btn-primary flex items-center gap-2"
                            >
                                <FaSync /> Sync All
                            </button>
                        </div>

                        {/* Trading 212 Card */}
                        <div
                            className="bg-surface border border-border rounded-xl p-6 cursor-pointer hover:border-primary transition-colors"
                            onClick={() => {
                                // Open modal logic
                                const modal = document.getElementById('t212-modal');
                                if (modal) modal.classList.remove('hidden');
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                                        T212
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">Trading 212</h3>
                                        <p className="text-xs text-text-secondary">Sync positions, cash & dividends</p>
                                    </div>
                                </div>
                                {userProfile?.trading212_api_key ? (
                                    <div className="flex items-center gap-2">
                                        <span className="px-3 py-1.5 bg-success/20 text-success text-sm rounded-full border border-success/20 flex items-center gap-2">
                                            <FaCheck className="text-xs" /> Connected
                                        </span>
                                    </div>
                                ) : (
                                    <span className="px-3 py-1.5 bg-text-muted/20 text-text-muted text-sm rounded-full">
                                        Not Connected
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'preferences' && (
                    <div className="bg-surface/50 backdrop-blur-md p-8 rounded-xl border border-border shadow-lg animate-fade-in">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-info/20 rounded-full text-info text-xl"><FaDollarSign /></div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Currency Preference</h2>
                                <p className="text-text-secondary text-sm">Select your preferred display currency</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            {['USD', 'EUR', 'GBP'].map((c) => (
                                <button
                                    key={c}
                                    onClick={() => handleCurrencyChange(c)}
                                    className={`p-4 rounded-xl border-2 transition-all ${userProfile?.currency === c ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:border-primary/50'}`}
                                >
                                    <div className="font-bold text-lg">{c}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* About Section */}
                <div className="mt-8 text-center">
                    <h3 className="text-lg font-bold text-white mb-2">FinNexus Pro v0.0.1</h3>
                    <p className="text-text-secondary text-sm flex items-center justify-center gap-1">
                        Made with <span className="text-danger">❤️</span> by <a href="https://github.com/trasousa" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">trasousa</a>
                    </p>
                </div>
            </div>

            {/* Trading 212 Modal - Fixed Overlay */}
            <div
                id="t212-modal"
                className="hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={() => {
                    const modal = document.getElementById('t212-modal');
                    if (modal) modal.classList.add('hidden');
                }}
            >
                <div
                    className="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Modal Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden bg-white">
                                <img src="/trading212-logo.png" alt="Trading 212" className="w-full h-full object-contain" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-lg">Trading 212</h3>
                                <p className="text-xs text-text-secondary">Configure connection</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                const modal = document.getElementById('t212-modal');
                                if (modal) modal.classList.add('hidden');
                            }}
                            className="text-text-muted hover:text-white"
                        >
                            <FaTimes />
                        </button>
                    </div>

                    {/* Form */}
                    <div className="space-y-4">
                        <div>
                            <label className="form-label">API Key</label>
                            <input
                                type="password"
                                value={profileData.trading212_api_key || ''}
                                onChange={(e) => setProfileData({ ...profileData, trading212_api_key: e.target.value })}
                                className="auth-input w-full"
                                placeholder={userProfile?.trading212_api_key ? "•••••••• (Configured)" : "Enter API Key"}
                            />
                        </div>
                        <div>
                            <label className="form-label">API Secret</label>
                            <input
                                type="password"
                                value={(profileData as any).trading212_api_secret || ''}
                                onChange={(e) => setProfileData({ ...profileData, trading212_api_secret: e.target.value } as any)}
                                className="auth-input w-full"
                                placeholder={userProfile?.trading212_api_secret ? "•••••••• (Configured)" : "Enter API Secret"}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="t212-demo-modal"
                                checked={(profileData as any).trading212_is_demo || false}
                                onChange={(e) => setProfileData({ ...profileData, trading212_is_demo: e.target.checked } as any)}
                                className="rounded border-gray-600 bg-surface text-primary focus:ring-primary"
                            />
                            <label htmlFor="t212-demo-modal" className="text-sm text-white">Use Demo/Practice Account</label>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-3 gap-2 pt-4">
                            <button
                                onClick={async () => {
                                    try {
                                        await axios.post('/api/connectors/trading212/validate', {
                                            api_key: profileData.trading212_api_key || '',
                                            api_secret: (profileData as any).trading212_api_secret || '',
                                            is_demo: !!(profileData as any).trading212_is_demo
                                        }, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        alert('✓ API Key is valid!');
                                    } catch (error: any) {
                                        console.error('Validation failed:', error);
                                        alert(`✗ Validation failed: ${error.response?.data?.detail || error.message}`);
                                    }
                                }}
                                className="btn btn-secondary text-sm"
                                disabled={!profileData.trading212_api_key}
                            >
                                Test
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await axios.post('/api/connectors/trading212/connect', {
                                            api_key: profileData.trading212_api_key || '',
                                            api_secret: (profileData as any).trading212_api_secret || '',
                                            is_demo: !!(profileData as any).trading212_is_demo
                                        }, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        await onProfileUpdate();
                                        alert('✓ Connected successfully!');
                                        const modal = document.getElementById('t212-modal');
                                        if (modal) modal.classList.add('hidden');
                                    } catch (error: any) {
                                        console.error('Connection failed:', error);
                                        alert(`✗ Connection failed: ${error.response?.data?.detail || error.message}`);
                                    }
                                }}
                                className="btn btn-primary text-sm"
                                disabled={!profileData.trading212_api_key}
                            >
                                Connect
                            </button>
                            <button
                                onClick={async () => {
                                    setIsSyncing(true);
                                    setSyncStatus('Starting sync...');
                                    try {
                                        await axios.post('/api/connectors/trading212/sync', {}, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        const job = await pollSyncStatus(token, setSyncStatus);
                                        if (job.status === 'error') {
                                            throw new Error(job.message);
                                        }
                                        setSyncStatus(`✓ ${job.message || 'Sync complete!'}`);
                                        setTimeout(() => {
                                            window.location.reload();
                                        }, 1500);
                                    } catch (error: any) {
                                        console.error('Sync failed:', error);
                                        setSyncStatus('');
                                        setIsSyncing(false);
                                        alert(`✗ Sync failed: ${error.response?.data?.detail || error.message}`);
                                    }
                                }}
                                className="btn btn-success text-sm flex items-center gap-2"
                                disabled={(!profileData.trading212_api_key && !userProfile?.trading212_api_key) || isSyncing}
                            >
                                {isSyncing ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Syncing...</span>
                                    </>
                                ) : (
                                    'Sync'
                                )}
                            </button>
                        </div>

                        {/* Sync Status */}
                        {syncStatus && (
                            <div className="text-center text-sm text-green-400 mt-2">
                                {syncStatus}
                            </div>
                        )}
                    </div>

                    {/* Help Text */}
                    <p className="text-xs text-text-muted mt-4">
                        Generate an API key in <span className="text-accent">Trading 212 Settings → API</span>. Required: Account Data, History.
                    </p>
                </div>
            </div>
        </div>
    );
};
