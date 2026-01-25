import React, { useState } from 'react';
import axios from 'axios';
import { FaTimes, FaFileUpload, FaSpinner } from 'react-icons/fa';


interface Props {
    isOpen: boolean;
    onClose: () => void;
    onImportSuccess: () => void;
    token: string;
}

export const ImportModal: React.FC<Props> = ({ isOpen, onClose, onImportSuccess, token }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError('Please select a file.');
            return;
        }

        setIsLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            await axios.post(`/api/holdings/import`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            onImportSuccess();
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || 'Failed to import holdings.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Import Holdings</h3>
                    <button onClick={onClose} className="close-btn"><FaTimes /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    {/* Account selection removed */}

                    <div className="form-group">
                        <label>CSV File</label>
                        <div style={{ border: '2px dashed #334155', padding: '2rem', borderRadius: '0.5rem', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                            />
                            <FaFileUpload size={24} style={{ marginBottom: '0.5rem', color: '#94a3b8' }} />
                            <p style={{ color: '#94a3b8', margin: 0 }}>
                                {file ? file.name : 'Click or drag CSV file here'}
                            </p>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>
                            CSV should have columns: Symbol, Quantity, Avg Cost (optional)
                        </p>
                    </div>

                    {error && <div className="error-message" style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn-secondary" disabled={isLoading}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={isLoading}>
                            {isLoading ? <><FaSpinner className="spin" /> Importing...</> : 'Import'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
