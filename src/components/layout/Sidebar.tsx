'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  Receipt,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  Layers
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { assetUrl } from '@/lib/assets';

const navigation = [
  {
    name: 'Dashboard',
    href: '/overview',
    icon: LayoutDashboard,
    description: 'Overview & Analytics'
  },
  {
    name: 'Sales Transactions',
    href: '/sales',
    icon: Receipt,
    description: 'View & Export Data'
  },
];

const platformMenu = [
  { name: 'Roastery', href: '#', icon: assetUrl('assets/roastery.png') },
  { name: 'Central Kitchen', href: '#', icon: assetUrl('assets/ck.png') },
  { name: 'Warehouse Management System', href: '#', icon: assetUrl('assets/warehouse.png') },
  { name: 'Operational', href: '#', icon: assetUrl('assets/operational.png') },
  { name: 'Finance', href: '#', icon: assetUrl('assets/finance.png') },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showPlatformMenu, setShowPlatformMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile/desktop
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSignOut = () => {
    router.push('/');
    setShowUserMenu(false);
  };

  const sidebarWidth = isCollapsed ? 'w-20' : 'w-72';

  return (
    <>
      {/* Mobile menu button - Always visible on mobile */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className={`fixed top-4 left-4 z-[70] p-2.5 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all duration-200 active:scale-95 ${
          isMobile ? '' : 'hidden'
        }`}
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] transition-opacity duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${sidebarWidth}
          flex-shrink-0
          bg-white border-r border-slate-200
          transition-all duration-300 ease-in-out
          flex flex-col h-screen
          ${isMobile
            ? `fixed inset-y-0 left-0 z-[65] ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'sticky top-0'
          }
        `}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo Section */}
          <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Logo Image */}
              <div className="w-10 h-10 relative rounded-xl overflow-hidden shadow-lg flex-shrink-0">
                <Image
                  src={assetUrl('assets/calf-logo.png')}
                  alt="Kopi Calf Logo"
                  fill
                  sizes="40px"
                  className="object-contain"
                />
              </div>
              {!isCollapsed && (
                <div>
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">Kopi Calf</h1>
                  <p className="text-xs text-slate-500">Integration Dashboard</p>
                </div>
              )}
            </div>

            {/* Collapse button - Desktop only */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Toggle sidebar"
            >
              <ChevronDown
                size={16}
                className={`transition-transform duration-300 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
              />
            </button>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
            {/* Section Label */}
            {!isCollapsed && (
              <p className="px-3 mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Main Menu
              </p>
            )}

            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 mb-1 ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className={`flex-shrink-0 transition-colors ${
                    isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`}>
                    <Icon size={20} />
                  </div>

                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="truncate">
                        {item.name}
                      </p>
                      <p className={`text-xs truncate ${isActive ? 'text-blue-400' : 'text-slate-400'}`}>
                        {item.description}
                      </p>
                    </div>
                  )}
                </Link>
              );
            })}

            {/* Platform Menu - Collapsible */}
            {!isCollapsed && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowPlatformMenu(!showPlatformMenu)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200 mb-1"
                >
                  <div className="flex-shrink-0 text-slate-400">
                    <Layers size={20} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-slate-700">Platform</p>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 ${showPlatformMenu ? 'rotate-90' : ''}`}
                  />
                </button>

                {/* Platform Submenu Popup */}
                {showPlatformMenu && (
                  <div className="ml-3 mt-1 space-y-0.5">
                    {platformMenu.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all duration-200"
                      >
                        <div className="w-5 h-5 relative">
                          <Image
                            src={item.icon}
                            alt={item.name}
                            fill
                            sizes="20px"
                            className="object-contain"
                          />
                        </div>
                        <span>{item.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Collapsed view - Platform icon only */}
            {isCollapsed && (
              <div className="relative mt-4 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowPlatformMenu(!showPlatformMenu)}
                  className="w-full flex items-center justify-center p-2.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all duration-200"
                >
                  <Layers size={20} />
                </button>

                {/* Tooltip for collapsed state */}
                {showPlatformMenu && (
                  <div className="absolute left-full top-0 ml-3 p-3 bg-white rounded-xl shadow-xl border border-slate-200 min-w-[200px] z-50 space-y-0.5">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2 px-2">Platform</p>
                    {platformMenu.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                      >
                        <div className="w-5 h-5 relative">
                          <Image
                            src={item.icon}
                            alt={item.name}
                            fill
                            sizes="20px"
                            className="object-contain"
                          />
                        </div>
                        <span>{item.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Footer */}
          <div className="border-t border-slate-100 p-3 flex-shrink-0">
            {/* User Profile with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors ${
                  isCollapsed ? 'justify-center' : ''
                }`}
              >
                <div className="w-9 h-9 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User size={18} className="text-slate-600" />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-slate-900 truncate">Admin User</p>
                  </div>
                )}
                {!isCollapsed && (
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                  />
                )}
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && !isCollapsed && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
                  <div className="p-3 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">Admin User</p>
                    <p className="text-xs text-slate-500">admin@esbportal.com</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Version */}
            {!isCollapsed && (
              <p className="text-center text-xs text-slate-400 mt-3">
                Kopi Calf Integrated v1.0.0
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
