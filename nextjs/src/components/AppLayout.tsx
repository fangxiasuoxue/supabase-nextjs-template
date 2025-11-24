
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
    Key, Files, LucideListTodo, Settings, Server,
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
        // For now, we map paths/names to module names
        // 'ip' -> 'ip'

        // Storage and Table are not yet in module enum, so we show them by default or hide them?
        // Let's show them by default for now to avoid breaking things, or check if admin.
        // But for IP, we strictly check permission.

        const hasIpPermission = isAdmin || permissions.some(p => p.module === 'ip' && p.can_menu);
        const hasVpsPermission = isAdmin || permissions.some(p => p.module === 'vps' && p.can_menu);

        baseNav.push({ name: t('nav.storage'), href: '/app/storage', icon: Files });
        baseNav.push({ name: t('nav.table'), href: '/app/table', icon: LucideListTodo });

        if (hasIpPermission) {
            baseNav.push({ name: t('nav.ip'), href: '/app/ip', icon: Files });
        }

        baseNav.push({ name: t('nav.userSettings'), href: '/app/user-settings', icon: User });

        if (hasVpsPermission) {
            baseNav.push({ name: t('nav.vps'), href: '/app/admin/vps', icon: Server });
        }

        if (isAdmin) {
            baseNav.push({ name: t('nav.admin'), href: '/app/admin/users', icon: Key });
            baseNav.push({ name: t('nav.config'), href: '/app/admin/config', icon: Settings });
        }

        return baseNav;
    }, [isAdmin, permissions, isMounted, t]);

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    return (
        <div className="min-h-screen bg-gray-100">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out z-30 
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

                <div className="h-16 flex items-center justify-between px-4 border-b">
                    <span className="text-xl font-semibold text-primary-600">{productName}</span>
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden text-gray-500 hover:text-gray-700"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="mt-4 px-2 space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${isActive
                                    ? 'bg-primary-50 text-primary-600'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    } `}
                            >
                                <item.icon
                                    className={`mr-3 h-5 w-5 ${isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                                        } `}
                                />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

            </div>

            <div className="lg:pl-64">
                <div className="sticky top-0 z-10 flex items-center justify-between h-16 bg-white shadow-sm px-4">
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden text-gray-500 hover:text-gray-700"
                    >
                        <Menu className="h-6 w-6" />
                    </button>

                    <div className="relative ml-auto flex items-center gap-3" ref={dropdownRef}>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setLanguage('en')}
                                className={`px-2 py-1 text-sm rounded ${language === 'en' ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'} `}
                            >
                                {t('lang.en')}
                            </button>
                            <button
                                onClick={() => setLanguage('zh')}
                                className={`px-2 py-1 text-sm rounded ${language === 'zh' ? 'bg-primary-100 text-primary-700' : 'text-gray-700 hover:bg-gray-100'} `}
                            >
                                {t('lang.zh')}
                            </button>
                        </div>
                        <button
                            onClick={() => setUserDropdownOpen(!isUserDropdownOpen)}
                            className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900"
                        >
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-primary-700 font-medium">
                                    {user ? getInitials(user.email) : '??'}
                                </span>
                            </div>
                            <span>{user?.email || 'Loading...'}</span>
                            <ChevronDown className="h-4 w-4" />
                        </button>

                        {isUserDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border">
                                <div className="p-2 border-b border-gray-100">
                                    <p className="text-xs text-gray-500">{t('nav.signedInAs')}</p>
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {user?.email}
                                    </p>
                                </div>
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            setUserDropdownOpen(false);
                                            handleChangePassword()
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        <Key className="mr-3 h-4 w-4 text-gray-400" />
                                        {t('nav.changePassword')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            setUserDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    >
                                        <LogOut className="mr-3 h-4 w-4 text-red-400" />
                                        {t('nav.signOut')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <main className="p-4">
                    {children}
                </main>
            </div>
        </div>
    );
}