"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ShieldAlert, Users, Server, Activity } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = session?.user?.email === "shivam23singh24@gmail.com" || 
                  session?.user?.email === "shivam13singh07@gmail.com" || 
                  session?.user?.email === "abc@def.com";

  useEffect(() => {
    if (status === "loading") return;
    if (!isAdmin) {
      router.push("/");
      return;
    }

    // Fetch users from Go Gateway
    fetch("/go-api/admin/users", {
      headers: { "X-User-Email": session?.user?.email || "" }
    })
      .then(res => res.json())
      .then(data => {
        setUsers(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch users", err);
        setLoading(false);
      });
  }, [status, isAdmin, router, session]);

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await fetch(`/go-api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { "X-User-Email": session?.user?.email || "" }
      });
      setUsers(users.filter(u => u.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditRole = async (id: number, currentRole: string, name: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    if (!confirm(`Change role to ${newRole}?`)) return;
    try {
      await fetch(`/go-api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 
          "X-User-Email": session?.user?.email || "",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role: newRole, name })
      });
      setUsers(users.map(u => u.id === id ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error(err);
    }
  };

  if (status === "loading" || !isAdmin) {
    return <div style={{ padding: '48px', color: 'var(--dim)' }}>Verifying credentials...</div>;
  }

  return (
    <>
      <header style={{ borderBottomColor: 'rgba(255, 107, 107, 0.2)' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--danger)' }}><ShieldAlert size={32} /> Admin Portal</h1>
          <p>System overview and user management. Authorized access only.</p>
        </div>
      </header>
      
      <main className="page-main">
        {/* System Health Overview */}
        <div className="admin-stats-grid">
          <div className="card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(61, 220, 145, 0.1)', padding: '8px', borderRadius: '8px' }}><Server color="var(--accent)" size={20} /></div>
              <div style={{ color: 'var(--dim)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Go Gateway</div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--accent)' }}>Online</div>
            <div style={{ fontSize: '12px', color: 'var(--dim)', marginTop: '8px' }}>Latency: 12ms</div>
          </div>
          
          <div className="card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(90, 176, 255, 0.1)', padding: '8px', borderRadius: '8px' }}><Activity color="var(--established)" size={20} /></div>
              <div style={{ color: 'var(--dim)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Python Engine</div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--established)' }}>Processing</div>
            <div style={{ fontSize: '12px', color: 'var(--dim)', marginTop: '8px' }}>Last heartbeat: 2s ago</div>
          </div>

          <div className="card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(199, 125, 255, 0.1)', padding: '8px', borderRadius: '8px' }}><Users color="var(--aggressive)" size={20} /></div>
              <div style={{ color: 'var(--dim)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Users</div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: 'var(--ink)' }}>{users.length}</div>
            <div style={{ fontSize: '12px', color: 'var(--dim)', marginTop: '8px' }}>Registered accounts</div>
          </div>
        </div>

        {/* Users Table */}
        <h2 style={{ fontSize: '18px', color: 'var(--ink)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="var(--muted)" /> Registered Users
        </h2>
        <div className="screener-view" style={{ marginTop: 0 }}>
          <table className="screener-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>AngelOne Connected</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--dim)' }}>Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--dim)' }}>No users found or endpoint not implemented in Go Gateway yet.</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td data-label="ID" style={{ fontFamily: "'Spline Sans Mono', monospace", color: 'var(--dim)' }}>#{u.id}</td>
                    <td data-label="Name" style={{ color: 'var(--ink)' }}>{u.name}</td>
                    <td data-label="Email">{u.email}</td>
                    <td data-label="Role">
                      <span className={`badge`} style={{ background: u.role === 'admin' ? 'rgba(255, 107, 107, 0.1)' : 'var(--panel)', color: u.role === 'admin' ? 'var(--danger)' : 'var(--muted)', border: '1px solid var(--line)' }}>
                        {u.role || "user"}
                      </span>
                    </td>
                    <td data-label="AngelOne">
                      {u.angel_client ? (
                        <span style={{ color: 'var(--accent)', fontSize: '12px' }}>✓ {u.angel_client}</span>
                      ) : (
                        <span style={{ color: 'var(--dim)', fontSize: '12px' }}>Not connected</span>
                      )}
                    </td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEditRole(u.id, u.role, u.name)} style={{ padding: '4px 8px', fontSize: '10px', fontFamily: "'Spline Sans Mono', monospace", background: 'var(--panel-2)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: '4px', cursor: 'pointer' }}>
                          Toggle Role
                        </button>
                        <button onClick={() => handleDelete(u.id)} style={{ padding: '4px 8px', fontSize: '10px', fontFamily: "'Spline Sans Mono', monospace", background: 'rgba(255, 107, 107, 0.1)', color: 'var(--danger)', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: '4px', cursor: 'pointer' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
