// src/pages/Dashboard.tsx
import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

interface Stats {
  total: number;
  byDepartment: { _id: string; count: number }[];
  byStatus: { _id: string; count: number }[];
  highAttritionRisk: number;
}

const COLORS = ["#667eea", "#764ba2", "#f093fb", "#4facfe", "#43e97b", "#fa709a", "#fee140"];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: Stats }>("/employees/stats")
      .then((res) => setStats(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.center}>Loading dashboard...</div>;

  const statusData = stats?.byStatus.map((s) => ({ name: s._id, value: s.count })) || [];
  const deptData = stats?.byDepartment.map((d) => ({ name: d._id, count: d.count })) || [];

  return (
    <div>
      <h1 style={styles.heading}>Welcome back, {user?.name} 👋</h1>
      <p style={styles.sub}>Here's your workforce overview</p>

      {/* KPI Cards */}
      <div style={styles.cards}>
        {[
          { label: "Total Employees", value: stats?.total ?? 0, icon: "👥", color: "#667eea" },
          { label: "Active", value: stats?.byStatus.find((s) => s._id === "active")?.count ?? 0, icon: "✅", color: "#43e97b" },
          { label: "High Attrition Risk", value: stats?.highAttritionRisk ?? 0, icon: "⚠️", color: "#fa709a" },
          { label: "Departments", value: stats?.byDepartment.length ?? 0, icon: "🏢", color: "#4facfe" },
        ].map((card) => (
          <div key={card.label} style={{ ...styles.card, borderTop: `4px solid ${card.color}` }}>
            <div style={styles.cardIcon}>{card.icon}</div>
            <div style={styles.cardValue}>{card.value}</div>
            <div style={styles.cardLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={styles.charts}>
        <div style={styles.chartBox}>
          <h3 style={styles.chartTitle}>Employees by Status</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {statusData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={styles.chartBox}>
          <h3 style={styles.chartTitle}>Headcount by Department</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={deptData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#667eea" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  center: { display: "flex", justifyContent: "center", padding: 60, color: "#888" },
  heading: { fontSize: 26, fontWeight: 700, color: "#1a1a2e", margin: 0 },
  sub: { color: "#888", marginTop: 6, marginBottom: 32 },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 32 },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "24px 20px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  },
  cardIcon: { fontSize: 28, marginBottom: 12 },
  cardValue: { fontSize: 32, fontWeight: 800, color: "#1a1a2e" },
  cardLabel: { fontSize: 13, color: "#888", marginTop: 4 },
  charts: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  chartBox: {
    background: "#fff",
    borderRadius: 12,
    padding: 24,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  },
  chartTitle: { margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "#333" },
};