
"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Home,
    User,
    Menu,
    X,
    ChevronDown,
    LogOut,
    Key, Files, LucideListTodo, Settings, Server, MessageSquare, Bell,
} from 'lucide-react';
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/context/LanguageContext";
import { checkIsAdmin, getUserPermissionsAction } from "@/app/actions/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isUserDropdownOpen, setUserDropdownOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const dropdownRef = useRef<HTMLDivElement>(null);


    const [permissions, setPermissions] = useState<any[]>([]);
    const { user } = useGlobal();
    const { language, setLanguage, t } = useLanguage();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setUserDropdownOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        async function checkPermissions() {
            try {
                const [adminResult, permsResult] = await Promise.all([
                    checkIsAdmin(),
                    getUserPermissionsAction()
                ]);
                setIsAdmin(adminResult);
                setPermissions(permsResult);
            } catch (error) {
                console.error('Error checking permissions:', error);
                setIsAdmin(false);
                setPermissions([]);
            }
        }
        if (user?.id && isMounted) {
            checkPermissions();
        }
    }, [user?.id, isMounted]);

    const handleLogout = async () => {
        try {
            const client = await createSPASassClient();
            await client.logout();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };
    const handleChangePassword = async () => {
        router.push('/app/user-settings')
    };

    const getInitials = (email: string) => {
        const parts = email.split('@')[0].split(/[._-]/);
        return parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : parts[0].slice(0, 2).toUpperCase();
    };

    const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

    const navigation = React.useMemo(() => {
        // Don't build navigation until mounted to avoid hydration mismatch
        if (!isMounted) return [];

        const baseNav = [
            { name: t('nav.home'), href: '/app', icon: Home },
        ];

        // Check permissions for modules
        const hasIpPermission = isAdmin || permissions.some(p => p.module === 'ip' && p.can_menu);
        const hasVpsPermission = isAdmin || permissions.some(p => p.module === 'vps' && p.can_menu);
        const hasNodesPermission = isAdmin || permissions.some(p => p.module === 'nodes' && p.can_menu);
        const hasMessagesPermission = isAdmin || permissions.some(p => p.module === 'messages' && p.can_menu);

        baseNav.push({ name: t('nav.storage'), href: '/app/storage', icon: Files });
        baseNav.push({ name: t('nav.table'), href: '/app/table', icon: LucideListTodo });

        if (hasIpPermission) {
            baseNav.push({ name: t('nav.ip'), href: '/app/ip', icon: Files });
        }

        baseNav.push({ name: t('nav.userSettings'), href: '/app/user-settings', icon: User });

        if (hasVpsPermission) {
            baseNav.push({ name: t('nav.vps'), href: '/app/admin/vps', icon: Server });
            // W5:告警中心此前只能靠直连 URL 进入,挂进导航(与 VPS 监控同权限)
            baseNav.push({ name: '告警中心', href: '/app/admin/alerts', icon: Bell });
        }

        if (hasNodesPermission) {
            baseNav.push({ name: '节点管理', href: '/app/admin/nodes', icon: Server });
        }

        if (hasMessagesPermission) {
            baseNav.push({ name: t('nav.messages'), href: '/app/admin/messages', icon: MessageSquare });
        }

        if (isAdmin) {
            baseNav.push({ name: t('nav.admin'), href: '/app/admin/users', icon: Key });
            baseNav.push({ name: t('nav.config'), href: '/app/admin/config', icon: Settings });
        }

        return baseNav;
    }, [isAdmin, permissions, isMounted, t]);

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    return (
        <div className="min-h-screen bg-background theme-jiedian-pro">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden animate-in fade-in duration-300"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 transform transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-50
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 group/sidebar`}>

                <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200">
                    <div className="flex flex-col">
                        <span className="text-xl font-black tracking-tighter text-slate-900">
                            {productName}
                        </span>
                        <span className="text-[9px] uppercase tracking-[0.3em] font-bold text-cyan-600 -mt-1">Operational Command</span>
                    </div>
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="mt-6 px-4 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)] scrollbar-hide">
                    <div className="px-2 mb-2 text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Core Modules</div>
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`group flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all duration-300 relative overflow-hidden ${isActive
                                    ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                                    } `}
                            >
                                {isActive && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-cyan-600 rounded-r-full" />
                                )}
                                <item.icon
                                    className={`mr-4 h-5 w-5 transition-all duration-300 ${isActive ? 'text-sky-700 scale-110' : 'text-slate-400 group-hover:text-slate-700 group-hover:scale-110'
                                        } `}
                                />
                                <span className="tracking-tight">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Sidebar Footer Info */}
                <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-slate-200 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Online</span>
                    </div>
                </div>
            </aside>

            <div className="lg:pl-64 min-h-screen relative flex flex-col">
                {/* Topbar */}
                <header className="sticky top-0 z-40 flex items-center justify-between h-20 bg-white/90 backdrop-blur border-b border-slate-200 px-8">
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground mr-4 hover:bg-slate-100 transition-colors"
                    >
                        <Menu className="h-6 w-6" />
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">V4.2.0-PRO</span>
                        </div>
                    </div>

                    <div className="relative ml-auto flex items-center gap-6" ref={dropdownRef}>
                        {/* Language Selector */}
                        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                            <button
                                onClick={() => setLanguage('en')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${language === 'en' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'} `}
                            >
                                {t('lang.en')}
                            </button>
                            <button
                                onClick={() => setLanguage('zh')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-300 ${language === 'zh' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'} `}
                            >
                                {t('lang.zh')}
                            </button>
                        </div>

                        <div className="h-8 w-[1px] bg-slate-200 mx-1" />

                        {/* User Profile */}
                        <button
                            onClick={() => setUserDropdownOpen(!isUserDropdownOpen)}
                            className="flex items-center space-x-4 group"
                        >
                            <div className="flex flex-col items-end text-right">
                                <span className="hidden md:block text-xs font-black text-slate-900 group-hover:text-cyan-700 transition-colors uppercase tracking-wider">{user?.email?.split('@')[0] || 'Unknown'}</span>
                                <span className="hidden md:block text-[9px] text-slate-500 uppercase tracking-widest leading-none">Command Tier</span>
                            </div>
                            <div className="relative">
                                <div className="w-11 h-11 rounded-xl bg-cyan-600 flex items-center justify-center overflow-hidden shadow-sm transition-all duration-500">
                                    <span className="text-white font-black text-sm">
                                        {user?.email ? getInitials(user.email) : '??'}
                                    </span>
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm" />
                            </div>
                            <ChevronDown className={`h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-all duration-300 ${isUserDropdownOpen ? 'rotate-180 text-cyan-600' : ''}`} />
                        </button>

                        {/* User Dropdown */}
                        {isUserDropdownOpen && (
                            <div className="absolute right-0 top-full mt-4 w-72 bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-300">
                                <div className="p-6 border-b border-slate-200 bg-slate-50 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5">
                                        <User className="h-20 w-20" />
                                    </div>
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-600 font-black mb-1.5">{t('nav.signedInAs')}</p>
                                    <p className="text-sm font-bold text-slate-900 truncate">
                                        {user?.email}
                                    </p>
                                </div>
                                <div className="p-2">
                                    <button
                                        onClick={() => {
                                            setUserDropdownOpen(false);
                                            handleChangePassword()
                                        }}
                                        className="w-full flex items-center px-4 py-3 text-sm text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-200 group/item"
                                    >
                                        <div className="p-2 rounded-lg bg-cyan-50 mr-4 group-hover/item:bg-cyan-100 transition-colors">
                                            <Key className="h-4 w-4 text-cyan-600" />
                                        </div>
                                        <span className="font-bold uppercase tracking-tight text-xs">{t('nav.changePassword')}</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            setUserDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 group/item"
                                    >
                                        <div className="p-2 rounded-lg bg-red-50 mr-4 group-hover/item:bg-red-100 transition-colors">
                                            <LogOut className="h-4 w-4 text-red-600" />
                                        </div>
                                        <span className="font-bold uppercase tracking-tight text-xs">{t('nav.signOut')}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 p-8 lg:p-12 max-w-[1600px] mx-auto w-full relative z-0">
                    {children}
                </main>
                
                {/* Global Footer / System Status */}
                <footer className="px-8 lg:px-12 py-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
                    <div className="flex items-center gap-6 text-[10px] uppercase tracking-widest font-bold">
                        <span className="flex items-center gap-2 hover:text-cyan-700 cursor-default transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Core Services: OK
                        </span>
                        <span className="flex items-center gap-2 hover:text-cyan-700 cursor-default transition-colors">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Network Latency: 42ms
                        </span>
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.2em] font-black">
                        © 2026 JIEDIAN PRO <span className="text-cyan-600">•</span> SECURE NODE NETWORK
                    </div>
                </footer>
            </div>
        </div>
    );
}