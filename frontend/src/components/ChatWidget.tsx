import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { FaPaperPlane, FaTimes, FaRobot, FaPlus } from 'react-icons/fa';
import type { UserProfile } from '../types';

interface Props {
    token: string;
    userProfile: UserProfile | null;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export const ChatWidget: React.FC<Props> = ({ token, userProfile }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [provider, setProvider] = useState('openai');

    // Determine available providers
    const availableProviders = [
        { id: 'openai', name: 'OpenAI', available: !!userProfile?.openai_api_key },
        { id: 'gemini', name: 'Gemini', available: !!userProfile?.gemini_api_key },
        { id: 'ollama', name: 'Ollama', available: !!userProfile?.ollama_url },
    ].filter(p => p.available);

    // Set default provider if current one is not available
    useEffect(() => {
        if (availableProviders.length > 0) {
            const currentAvailable = availableProviders.find(p => p.id === provider);
            if (!currentAvailable) {
                setProvider(availableProviders[0].id);
            }
        }
    }, [userProfile, provider]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const res = await axios.post('/api/chat/', { message: input, provider }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const assistantMsg: Message = { role: 'assistant', content: res.data.response };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error: any) {
            console.error('Chat error:', error);
            const errorMsg = error.response?.data?.detail || 'Sorry, I encountered an error. Please check your API keys.';
            setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end">
            {isOpen && (
                <div className="bg-black/40 border border-white/10 rounded-2xl shadow-2xl w-96 h-[500px] mb-4 flex flex-col overflow-hidden fade-in backdrop-blur-md">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                                <FaRobot className="text-white" /> Finn AI
                            </h3>
                            {availableProviders.length > 0 ? (
                                <select
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value)}
                                    className="bg-black/20 border border-white/10 rounded text-xs text-white/80 p-1 focus:outline-none hover:bg-black/40 transition-colors"
                                >
                                    {availableProviders.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <span className="text-xs text-danger">No Keys Configured</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setMessages([])}
                                className="text-white/50 hover:text-white transition-colors text-xs flex items-center gap-1"
                                title="Start New Chat"
                            >
                                <FaPlus /> New
                            </button>
                            <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white transition-colors">
                                <FaTimes />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {messages.length === 0 && (
                            <div className="text-center text-white/30 text-sm mt-8">
                                {availableProviders.length > 0
                                    ? "Ask me anything about your portfolio!"
                                    : "Please configure API keys in Settings to start chatting."}
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm backdrop-blur-sm ${msg.role === 'user'
                                    ? 'bg-primary/80 text-white rounded-br-none shadow-lg'
                                    : 'bg-white/10 text-gray-100 rounded-bl-none border border-white/5'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white/10 p-3 rounded-2xl rounded-bl-none border border-white/5">
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" />
                                        <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce delay-75" />
                                        <div className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce delay-150" />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-3 border-t border-white/5 bg-white/5 backdrop-blur-sm">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type a message..."
                                disabled={availableProviders.length === 0}
                                className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-black/30 transition-all disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim() || availableProviders.length === 0}
                                className="bg-primary/80 text-white p-2.5 rounded-xl hover:bg-primary disabled:opacity-50 disabled:hover:bg-primary/80 transition-all shadow-lg hover:shadow-primary/20"
                            >
                                <FaPaperPlane size={14} />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 bg-primary/90 hover:bg-primary rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/20 hover:scale-105 transition-all backdrop-blur-sm border border-white/10"
            >
                {isOpen ? <FaTimes size={24} /> : <FaRobot size={32} />}
            </button>
        </div>
    );
};
