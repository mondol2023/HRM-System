// src/components/Layout.tsx
import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/employees", label: "Employees", icon: "👥", end: false },
  { to: "/ai-insights", label: "AI Insights", icon: "🤖", end: false },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>⚡ HRM AI</div>
        <nav style={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={styles.userSection}>
          <div style={styles.avatar}>{user?.name[0]?.toUpperCase()}</div>
          <div>
            <div style={styles.userName}>{user?.name}</div>
            <div style={styles.userRole}>{user?.role}</div>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn} title="Logout">
            ↪
          </button>
        </div>
      </aside>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: "flex", height: "100vh", fontFamily: "'Segoe UI', sans-serif" },
  sidebar: {
    width: 240,
    background: "#0f0c29",
    display: "flex",
    flexDirection: "column",
    padding: "24px 16px",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  brand: { color: "#fff", fontSize: 22, fontWeight: 800, marginBottom: 40, paddingLeft: 12 },
  nav: { display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 8,
    color: "rgba(255,255,255,0.55)",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
    transition: "all 0.2s",
  },
  navLinkActive: {
    background: "rgba(102,126,234,0.25)",
    color: "#a78bfa",
  },
  userSection: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    marginTop: 16,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  userName: { color: "#fff", fontSize: 13, fontWeight: 600 },
  userRole: { color: "rgba(255,255,255,0.4)", fontSize: 11, textTransform: "capitalize" },
  logoutBtn: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    cursor: "pointer",
    fontSize: 18,
    padding: 4,
  },
  main: {
    flex: 1,
    background: "#f8f9fe",
    overflowY: "auto",
    padding: 32,
  },
};