import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { FaPaperPlane, FaRobot, FaUser } from 'react-icons/fa';
import type { ChatMessage } from '../types';

interface Props {
    token: string;
}

export const ChatPage: React.FC<Props> = ({ token }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: 'Hello! I am Finn, your financial assistant. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Convert messages to history format expected by backend
            const history = messages.map(m => ({
                role: m.role,
                content: m.content
            }));

            const res = await axios.post('http://localhost:8002/api/chat/', {
                message: userMessage.content,
                history: history
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const assistantMessage: ChatMessage = { role: 'assistant', content: res.data.response };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (error: any) {
            console.error('Chat error:', error);
            let errorMessage = 'Sorry, I encountered an error. Please try again.';
            if (error.response?.data?.detail) {
                errorMessage = `Error: ${error.response.data.detail}`;
            }
            setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chat-page" style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            <div className="chat-header" style={{ marginBottom: '1rem' }}>
                <h2>Finn Assistant</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Ask about your portfolio, stocks, or financial advice.</p>
            </div>

            <div className="chat-messages" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem',
                background: '#1e293b',
                borderRadius: '1rem',
                border: '1px solid #334155',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
            }}>
                {messages.map((msg, idx) => (
                    <div key={idx} style={{
                        display: 'flex',
                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        gap: '0.5rem'
                    }}>
                        {msg.role === 'assistant' && (
                            <div style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                background: '#38bdf8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                flexShrink: 0
                            }}>
                                <FaRobot size={16} />
                            </div>
                        )}
                        <div style={{
                            maxWidth: '70%',
                            padding: '0.75rem 1rem',
                            borderRadius: '1rem',
                            background: msg.role === 'user' ? '#3b82f6' : '#334155',
                            color: 'white',
                            borderTopLeftRadius: msg.role === 'assistant' ? '0' : '1rem',
                            borderTopRightRadius: msg.role === 'user' ? '0' : '1rem',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {msg.content}
                        </div>
                        {msg.role === 'user' && (
                            <div style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                background: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                flexShrink: 0
                            }}>
                                <FaUser size={14} />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            background: '#38bdf8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <FaRobot size={16} />
                        </div>
                        <div style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '1rem',
                            background: '#334155',
                            color: '#94a3b8',
                            borderTopLeftRadius: '0'
                        }}>
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    style={{
                        flex: 1,
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #334155',
                        background: '#0f172a',
                        color: 'white'
                    }}
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="btn-primary"
                    style={{ padding: '0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    disabled={isLoading}
                >
                    <FaPaperPlane /> Send
                </button>
            </form>
        </div>
    );
};
