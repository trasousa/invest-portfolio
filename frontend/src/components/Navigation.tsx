import React, { useState, useEffect } from 'react';
import {
    FaChartPie, FaCog, FaBuilding, FaCoins, FaMoneyBillWave,
    FaAngleDown, FaList, FaHandHoldingUsd, FaChartLine, FaWallet, FaChartArea,
    FaSignOutAlt, FaBars, FaTimes
} from 'react-icons/fa';
import type { UserProfile } from '../types';

interface Props {
    currentView: string;
    onViewChange: (view: string) => void;
    userProfile: UserProfile | null;
    onLogout?: () => void;
}

export const Navigation: React.FC<Props> = ({ currentView, onViewChange, userProfile, onLogout }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const toggleDropdown = (section: string) => {
        if (openDropdown === section) {
            setOpenDropdown(null);
        } else {
            setOpenDropdown(section);
        }
    };

    // Close dropdowns when clicking outside (simple implementation)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.nav-item-dropdown')) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const NavItem = ({ view, label, icon, onClick }: { view?: string, label: string, icon: React.ReactNode, onClick?: () => void }) => (
        <a
            href="#"
            className={`nav-item flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${currentView === view ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
            onClick={(e) => {
                e.preventDefault();
                if (onClick) onClick();
                else if (view) onViewChange(view);
                setIsMobileMenuOpen(false);
            }}
        >
            <span className="text-lg">{icon}</span>
            <span className="font-medium">{label}</span>
        </a>
    );

    const DropdownItem = ({ view, label, icon }: { view: string, label: string, icon: React.ReactNode }) => (
        <a
            href="#"
            className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${currentView === view ? 'text-primary bg-primary/10' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
            onClick={(e) => {
                e.preventDefault();
                onViewChange(view);
                setOpenDropdown(null);
                setIsMobileMenuOpen(false);
            }}
        >
            <span className="text-base">{icon}</span>
            {label}
        </a>
    );

    const NavDropdown = ({ section, label, icon, children }: { section: string, label: string, icon: React.ReactNode, children: React.ReactNode }) => (
        <div className="nav-item-dropdown relative group">
            <button
                className={`nav-item flex items-center gap-2 px-4 py-2 rounded-lg transition-colors w-full ${currentView.startsWith(section) || openDropdown === section ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:text-white hover:bg-white/5'}`}
                onClick={() => toggleDropdown(section)}
            >
                <span className="text-lg">{icon}</span>
                <span className="font-medium">{label}</span>
                <FaAngleDown className={`ml-1 text-xs transition-transform ${openDropdown === section ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Desktop Dropdown */}
            {openDropdown === section && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-xl backdrop-blur-xl z-50 overflow-hidden hidden md:block animate-fade-in">
                    {children}
                </div>
            )}

            {/* Mobile Dropdown (Inline) */}
            {openDropdown === section && (
                <div className="md:hidden flex flex-col pl-4 mt-2 space-y-1 border-l-2 border-border ml-4">
                    {children}
                </div>
            )}
        </div>
    );

    return (
        <>
            {/* Top Navigation Bar (Desktop) */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-surface/80 backdrop-blur-md border-b border-border z-40 px-6 flex items-center justify-between hidden md:flex">
                {/* Logo */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary text-xl">
                        <FaChartPie />
                    </div>
                    <div>
                        <div className="font-bold text-lg leading-tight">FinNexus</div>
                        <div className="text-xs text-text-secondary">Track & Grow</div>
                    </div>
                </div>

                {/* Desktop Menu */}
                <nav className="flex items-center gap-3">
                    <NavItem view="dashboard" label="Dashboard" icon={<FaChartPie />} />
                    <NavItem view="wealth" label="Wealth" icon={<FaChartArea />} />

                    <NavDropdown section="stocks" label="Stocks" icon={<FaChartLine />}>
                        <DropdownItem view="stocks-holdings" label="Holdings" icon={<FaList />} />
                        <DropdownItem view="stocks-dividends" label="Dividends" icon={<FaHandHoldingUsd />} />
                        <DropdownItem view="stocks-diversification" label="Diversification" icon={<FaChartPie />} />
                    </NavDropdown>

                    <NavDropdown section="crypto" label="Crypto" icon={<FaCoins />}>
                        <DropdownItem view="crypto-holdings" label="Holdings" icon={<FaList />} />
                        <DropdownItem view="crypto-diversification" label="Diversification" icon={<FaChartPie />} />
                    </NavDropdown>

                    <NavDropdown section="bonds" label="Bonds" icon={<FaHandHoldingUsd />}>
                         <DropdownItem view="bonds-holdings" label="Holdings" icon={<FaList />} />
                         <DropdownItem view="bonds-diversification" label="Diversification" icon={<FaChartPie />} />
                    </NavDropdown>

                    <NavDropdown section="properties" label="Properties" icon={<FaBuilding />}>
                        <DropdownItem view="properties-holdings" label="Holdings" icon={<FaList />} />
                    </NavDropdown>

                    <NavItem view="pensions" label="Pensions" icon={<FaWallet />} />
                    <NavItem view="debts" label="Debts" icon={<FaMoneyBillWave />} />
                    <NavItem view="cash" label="Cash" icon={<FaHandHoldingUsd />} />
                </nav>

                <div className="flex items-center gap-4">
                    <div className="relative group nav-item-dropdown">
                        <button 
                            className="flex items-center gap-3 hover:bg-white/5 px-2 py-1 rounded-lg transition-colors"
                            onClick={() => toggleDropdown('profile')}
                        >
                             {userProfile?.profile_image_url ? (
                                <img src={userProfile.profile_image_url} alt="Profile" className="w-9 h-9 rounded-full object-cover border border-border" />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shadow-lg">
                                    {(userProfile?.display_name || userProfile?.email || 'U').charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="text-left hidden lg:block">
                                <div className="text-sm font-medium">{userProfile?.display_name || 'User'}</div>
                                <div className="text-xs text-text-secondary truncate w-24">{userProfile?.email}</div>
                            </div>
                            <FaAngleDown />
                        </button>
                        
                        {openDropdown === 'profile' && (
                             <div className="absolute top-full right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-xl backdrop-blur-xl z-50 overflow-hidden animate-fade-in">
                                <DropdownItem view="settings" label="Settings" icon={<FaCog />} />
                                <div className="border-t border-border my-1"></div>
                                <a
                                    href="#"
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                                    onClick={(e) => { e.preventDefault(); if (onLogout) onLogout(); }}
                                >
                                    <FaSignOutAlt /> Logout
                                </a>
                            </div>
                        )}
                     </div>
                </div>
            </header>


            {/* Mobile Header */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-surface/90 backdrop-blur-md border-b border-border z-40 px-4 flex items-center justify-between md:hidden">
                 <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary/20 rounded-lg flex items-center justify-center text-primary text-lg">
                        <FaChartPie />
                    </div>
                    <div className="font-bold text-lg">FinNexus</div>
                </div>
                <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-text-secondary hover:text-white transition-colors"
                >
                    {isMobileMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
                </button>
            </header>


            {/* Mobile Navigation Menu (Overlay) */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 top-16 bg-bg-primary/95 backdrop-blur-xl z-50 overflow-y-auto md:hidden animate-fade-in p-4 pb-24">
                     <nav className="flex flex-col gap-2">
                        <NavItem view="dashboard" label="Dashboard" icon={<FaChartPie />} />
                        <NavItem view="wealth" label="Wealth" icon={<FaChartArea />} />

                        <NavDropdown section="stocks" label="Stocks" icon={<FaChartLine />}>
                            <DropdownItem view="stocks-holdings" label="Holdings" icon={<FaList />} />
                            <DropdownItem view="stocks-dividends" label="Dividends" icon={<FaHandHoldingUsd />} />
                            <DropdownItem view="stocks-diversification" label="Diversification" icon={<FaChartPie />} />
                        </NavDropdown>

                        <NavDropdown section="crypto" label="Crypto" icon={<FaCoins />}>
                            <DropdownItem view="crypto-holdings" label="Holdings" icon={<FaList />} />
                            <DropdownItem view="crypto-diversification" label="Diversification" icon={<FaChartPie />} />
                        </NavDropdown>

                        <NavDropdown section="bonds" label="Bonds" icon={<FaHandHoldingUsd />}>
                            <DropdownItem view="bonds-holdings" label="Holdings" icon={<FaList />} />
                            <DropdownItem view="bonds-diversification" label="Diversification" icon={<FaChartPie />} />
                        </NavDropdown>

                        <NavDropdown section="properties" label="Properties" icon={<FaBuilding />}>
                            <DropdownItem view="properties-holdings" label="Holdings" icon={<FaList />} />
                        </NavDropdown>

                        <NavItem view="pensions" label="Pensions" icon={<FaWallet />} />
                        <NavItem view="debts" label="Debts" icon={<FaMoneyBillWave />} />
                        <NavItem view="cash" label="Cash" icon={<FaHandHoldingUsd />} />
                        
                        <div className="border-t border-border my-2"></div>
                        <NavItem view="settings" label="Settings" icon={<FaCog />} />
                        <NavItem label="Logout" icon={<FaSignOutAlt />} onClick={onLogout} />
                    </nav>
                </div>
            )}

            {/* Mobile Bottom Bar (Sticky) */}
            <div className="fixed bottom-0 left-0 right-0 h-16 bg-surface/90 backdrop-blur-lg border-t border-border z-40 flex items-center justify-around px-2 md:hidden">
                <a href="#" onClick={(e) => { e.preventDefault(); onViewChange('dashboard'); }} className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'dashboard' ? 'text-primary' : 'text-text-secondary'}`}>
                    <FaChartPie size={20} />
                    <span className="text-[10px] mt-1">Dash</span>
                </a>
                <a href="#" onClick={(e) => { e.preventDefault(); onViewChange('wealth'); }} className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'wealth' ? 'text-primary' : 'text-text-secondary'}`}>
                    <FaChartArea size={20} />
                    <span className="text-[10px] mt-1">Wealth</span>
                </a>
                <a href="#" onClick={(e) => { e.preventDefault(); onViewChange('stocks-holdings'); }} className={`flex flex-col items-center justify-center w-full h-full ${currentView.startsWith('stocks') ? 'text-primary' : 'text-text-secondary'}`}>
                    <FaChartLine size={20} />
                    <span className="text-[10px] mt-1">Stocks</span>
                </a>
                <a href="#" onClick={(e) => { e.preventDefault(); onViewChange('settings'); }} className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'settings' ? 'text-primary' : 'text-text-secondary'}`}>
                    <FaCog size={20} />
                    <span className="text-[10px] mt-1">Settings</span>
                </a>
            </div>
        </>
    );
};
