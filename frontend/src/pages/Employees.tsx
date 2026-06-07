// src/pages/Employees.tsx
import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useEmployees } from "../hooks/useEmployees";
import { useAuth } from "../context/AuthContext";
import EmployeeFormModal from "../components/EmployeeFormModal";
import { Button } from "../components/FormField";

const RISK_COLOR = (risk?: number) => {
  if (!risk) return "#9ca3af";
  if (risk >= 0.7) return "#ef4444";
  if (risk >= 0.4) return "#f59e0b";
  return "#22c55e";
};

export default function Employees() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user?.role === "admin" || user?.role === "hr";

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: employees, meta, loading, refetch } = useEmployees({
    page, search, department,
  });

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleDeptChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setDepartment(e.target.value);
    setPage(1);
  }, []);

  const departments = ["engineering", "hr", "finance", "marketing", "operations", "sales", "legal"];

  return (
    <div>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.heading}>Employees</h1>
          <p style={styles.sub}>{meta.total} total employees</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>+ Add Employee</Button>
        )}
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Search by ID or designation..."
          value={search}
          onChange={handleSearchChange}
          style={styles.searchInput}
        />
        <select value={department} onChange={handleDeptChange} style={styles.select}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.loadingRow}>Loading...</div>
        ) : employees.length === 0 ? (
          <div style={styles.loadingRow}>No employees found.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                {["Employee ID", "Name", "Department", "Designation", "Status", "Salary", "Risk"].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const userId = emp.userId as { name: string; email: string };
                return (
                  <tr
                    key={emp._id}
                    style={styles.tr}
                    onClick={() => navigate(`/employees/${emp._id}`)}
                  >
                    <td style={styles.td}><code style={styles.code}>{emp.employeeId}</code></td>
                    <td style={styles.td}>
                      <div style={styles.nameCell}>{userId?.name ?? "—"}</div>
                      <div style={styles.emailCell}>{userId?.email ?? ""}</div>
                    </td>
                    <td style={styles.td}><span style={styles.badge}>{emp.department}</span></td>
                    <td style={styles.td}>{emp.designation}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusBadge,
                        background: emp.status === "active" ? "#dcfce7" : "#fff3e0",
                        color: emp.status === "active" ? "#16a34a" : "#ca8a04",
                      }}>
                        {emp.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={styles.td}>${emp.salary.toLocaleString()}</td>
                    <td style={styles.td}>
                      {emp.attritionRisk !== undefined ? (
                        <span style={{
                          padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                          background: RISK_COLOR(emp.attritionRisk) + "18",
                          color: RISK_COLOR(emp.attritionRisk),
                        }}>
                          {(emp.attritionRisk * 100).toFixed(0)}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div style={styles.pagination}>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={styles.pageBtn}>← Prev</button>
        <span style={styles.pageInfo}>Page {meta.page} of {meta.totalPages}</span>
        <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages} style={styles.pageBtn}>Next →</button>
      </div>

      <EmployeeFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 },
  heading: { fontSize: 26, fontWeight: 700, color: "#1a1a2e", margin: 0 },
  sub: { color: "#888", marginTop: 4, marginBottom: 20 },
  filters: { display: "flex", gap: 12, marginBottom: 20 },
  searchInput: { flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 14, outline: "none" },
  select: { padding: "10px 14px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 14, background: "#fff", outline: "none", cursor: "pointer" },
  tableWrap: { background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { background: "#f5f6fa" },
  th: { padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" },
  tr: { borderBottom: "1px solid #f0f0f0", cursor: "pointer", transition: "background 0.15s" },
  td: { padding: "14px 16px", fontSize: 13, color: "#333" },
  code: { fontFamily: "monospace", background: "#f3f4f6", padding: "2px 6px", borderRadius: 4, fontSize: 12 },
  nameCell: { fontWeight: 500 },
  emailCell: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  badge: { background: "#ede9fe", color: "#7c3aed", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: "capitalize" },
  statusBadge: { padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: "capitalize" },
  loadingRow: { padding: 40, textAlign: "center", color: "#888" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 24 },
  pageBtn: { padding: "8px 16px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500 },
  pageInfo: { fontSize: 13, color: "#666" },
};