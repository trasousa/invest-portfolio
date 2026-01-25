import React from 'react';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<Props> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'warning'
}) => {
    if (!isOpen) return null;

    const getVariantColor = () => {
        switch (variant) {
            case 'danger':
                return 'var(--danger)';
            case 'warning':
                return '#f59e0b';
            case 'info':
                return 'var(--primary)';
            default:
                return 'var(--primary)';
        }
    };

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: '450px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '1rem',
                    padding: 0
                }}
            >
                <div
                    className="modal-header"
                    style={{
                        padding: '1.5rem',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <FaExclamationTriangle
                            size={20}
                            style={{ color: getVariantColor() }}
                        />
                        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="modal-close"
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '0.375rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--background-secondary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <FaTimes size={18} />
                    </button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                    <p style={{
                        margin: 0,
                        color: 'var(--text)',
                        lineHeight: '1.6',
                        fontSize: '0.9375rem'
                    }}>
                        {message}
                    </p>
                </div>

                <div
                    style={{
                        padding: '1rem 1.5rem',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        gap: '0.75rem',
                        justifyContent: 'flex-end'
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.625rem 1.25rem',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            color: 'var(--text)',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--background-secondary)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{
                            padding: '0.625rem 1.25rem',
                            background: getVariantColor(),
                            border: 'none',
                            color: 'white',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.875rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.9';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
