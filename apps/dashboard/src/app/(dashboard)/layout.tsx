"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  BarChart2, 
  Zap, 
  Link as LinkIcon, 
  Settings, 
  ShieldAlert,
  LogOut,
  User as UserIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const navItems = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "Track Record", href: "/track-record", icon: BarChart2 },
    { name: "Screener", href: "/screener", icon: BarChart2 },
    { name: "AI Signals", href: "/signals", icon: Zap },
    { name: "Integrations", href: "/integrations", icon: LinkIcon },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  // For prototype, we will consider shivam23singh24@gmail.com and shivam13singh07@gmail.com as admins
  const isAdmin = session?.user?.email === "shivam23singh24@gmail.com" || 
                  session?.user?.email === "shivam13singh07@gmail.com" || 
                  session?.user?.email === "abc@def.com";

  return (
    <div className="layout-wrapper">
      {/* Premium Glassmorphic Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          Growth<span>Engines</span>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`nav-item ${isActive ? "active" : ""}`}
              >
                <Icon size={16} />
                {item.name}
                {isActive && (
                  <motion.div 
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-white/5 rounded-md -z-10"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}

          {isAdmin && (
            <Link 
              href="/admin" 
              className={`nav-item admin ${pathname === "/admin" ? "active" : ""}`}
              style={{ marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}
            >
              <ShieldAlert size={16} />
              Admin Portal
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          {status === "loading" ? (
            <div className="skeleton" style={{ height: "20px", width: "100%" }}></div>
          ) : session ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--panel-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line)' }}>
                  <UserIcon size={14} color="var(--dim)" />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: 'var(--ink)', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {session.user?.name || "User"}
                  </div>
                  <div style={{ color: 'var(--dim)', fontSize: '10px', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {session.user?.email}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => signOut()} 
                style={{ background: 'transparent', border: '1px solid var(--line)', color: 'var(--dim)', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', transition: 'var(--transition-fast)' }}
                onMouseOver={(e) => { e.currentTarget.style.color = 'var(--ink)'; e.currentTarget.style.borderColor = 'var(--dim)'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = 'var(--dim)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
              >
                <LogOut size={12} /> Sign Out
              </button>
            </div>
          ) : (
            <Link href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sign In →</Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
