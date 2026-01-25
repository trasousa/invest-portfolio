import React, { useState } from 'react';
import axios from 'axios';

interface Props {
    onSignupSuccess: () => void;
    onSwitchToLogin: () => void;
}

export const Signup: React.FC<Props> = ({ onSignupSuccess, onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/api/auth/signup', {
                email,
                password,
                display_name: displayName
            });
            alert('Account created! Please log in.');
            onSignupSuccess();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Signup failed');
        }
    };

    return (
        <div className="w-full flex items-center justify-center min-h-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1e1b4b] to-bg-primary">
            <div className="w-full max-w-md p-8 rounded-2xl bg-surface border border-border shadow-2xl backdrop-blur-xl animate-fade-in">
                <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Create Account</h2>
                <p className="text-center text-text-secondary mb-8 text-sm">Join FinNexus Pro today</p>

                {error && <div className="text-red-500 text-sm text-center mb-4 bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</div>}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-secondary">Display Name</label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 rounded-lg bg-black/20 border border-border text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-secondary">Email Address</label>
                        <input
                            type="email"
                            className="w-full px-4 py-3 rounded-lg bg-black/20 border border-border text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-text-secondary">Password</label>
                        <input
                            type="password"
                            className="w-full px-4 py-3 rounded-lg bg-black/20 border border-border text-white placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="mt-4 w-full py-3.5 rounded-lg bg-gradient-to-r from-primary to-accent text-white font-semibold hover:opacity-90 hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/25">
                        Create Account
                    </button>
                </form>

                <div className="text-center mt-6 text-sm text-text-secondary">
                    Already have an account? <span onClick={onSwitchToLogin} className="text-primary hover:text-primary-hover font-medium cursor-pointer hover:underline transition-colors">Sign in</span>
                </div>
            </div>
        </div>
    );
};
