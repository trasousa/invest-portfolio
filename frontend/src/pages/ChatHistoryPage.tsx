import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaRobot, FaUser, FaClock, FaHistory } from 'react-icons/fa';

interface ChatHistoryItem {
    id: string;
    message: string;
    response: string;
    provider: string;
    timestamp: string;
}

interface Props {
    token: string;
}

export const ChatHistoryPage: React.FC<Props> = ({ token }) => {
    const [history, setHistory] = useState<ChatHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await axios.get('/api/chat/history', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setHistory(res.data);
            } catch (error) {
                console.error('Error fetching chat history:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [token]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="p-6 max-w-4xl mx-auto h-full flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                    <FaRobot className="text-primary" />
                    FinnAI History
                </h1>
                <p className="text-text-secondary">Your conversation history with Finn</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                {loading ? (
                    <div className="text-center text-text-secondary py-10">Loading history...</div>
                ) : history.length === 0 ? (
                    <div className="text-center text-text-secondary py-10 flex flex-col items-center">
                        <FaHistory className="text-4xl mb-4 opacity-50" />
                        <p>No chat history found.</p>
                        <p className="text-sm mt-2">Start a conversation with Finn to see it here!</p>
                    </div>
                ) : (
                    history.map((item) => (
                        <div key={item.id} className="bg-surface/50 border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
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
    );
};
