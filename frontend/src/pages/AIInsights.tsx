// src/pages/AIInsights.tsx
import React, { useState, useRef } from "react";
import api from "../api/axios";

interface ResumeResult {
  name: string;
  email: string;
  phone?: string;
  skills: string[];
  experience: string;
  education: string;
  summary: string;
  suggestedDesignation?: string;
  suggestedDepartment?: string;
}

interface SentimentResult {
  sentiment: "positive" | "neutral" | "negative";
  score: number;
  reasoning: string;
}

const SENTIMENT_COLORS = { positive: "#43e97b", neutral: "#fee140", negative: "#fa709a" };

export default function AIInsights() {
  const [resumeResult, setResumeResult] = useState<ResumeResult | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [noteText, setNoteText] = useState("");
  const [sentimentResult, setSentimentResult] = useState<SentimentResult | null>(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);

  const handleResumeUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setResumeLoading(true);
    setResumeError("");
    setResumeResult(null);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const res = await api.post<{ data: ResumeResult }>("/ai/parse-resume", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResumeResult(res.data.data);
    } catch (err: unknown) {
      setResumeError(err instanceof Error ? err.message : "Parsing failed");
    } finally {
      setResumeLoading(false);
    }
  };

  const handleSentiment = async () => {
    if (!noteText.trim()) return;
    setSentimentLoading(true);
    setSentimentResult(null);
    try {
      const res = await api.post<{ data: SentimentResult }>("/ai/sentiment", { note: noteText });
      setSentimentResult(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSentimentLoading(false);
    }
  };

  return (
    <div>
      <h1 style={styles.heading}>AI Insights</h1>
      <p style={styles.sub}>Powered by OpenAI GPT-4o-mini</p>

      <div style={styles.grid}>
        {/* Resume Parser */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>📄 Resume Parser</h2>
          <p style={styles.cardDesc}>Upload a PDF or TXT resume for AI extraction</p>
          <input type="file" ref={fileRef} accept=".pdf,.txt" style={styles.fileInput} />
          <button onClick={handleResumeUpload} disabled={resumeLoading} style={styles.btn}>
            {resumeLoading ? "Parsing..." : "Parse Resume"}
          </button>
          {resumeError && <div style={styles.error}>{resumeError}</div>}
          {resumeResult && (
            <div style={styles.result}>
              <div style={styles.resultRow}><strong>Name:</strong> {resumeResult.name}</div>
              <div style={styles.resultRow}><strong>Email:</strong> {resumeResult.email}</div>
              {resumeResult.phone && <div style={styles.resultRow}><strong>Phone:</strong> {resumeResult.phone}</div>}
              <div style={styles.resultRow}><strong>Summary:</strong> {resumeResult.summary}</div>
              <div style={styles.resultRow}><strong>Experience:</strong> {resumeResult.experience}</div>
              <div style={styles.resultRow}><strong>Education:</strong> {resumeResult.education}</div>
              <div style={styles.resultRow}>
                <strong>Skills:</strong>{" "}
                {resumeResult.skills.map((s) => (
                  <span key={s} style={styles.skillTag}>{s}</span>
                ))}
              </div>
              {resumeResult.suggestedDesignation && (
                <div style={styles.suggestion}>
                  🎯 Suggested: <strong>{resumeResult.suggestedDesignation}</strong> in <strong>{resumeResult.suggestedDepartment}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sentiment Analyzer */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>💬 Sentiment Analyzer</h2>
          <p style={styles.cardDesc}>Analyze sentiment from a performance note</p>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter a performance note here..."
            style={styles.textarea}
          />
          <button onClick={handleSentiment} disabled={sentimentLoading || noteText.trim().length < 10} style={styles.btn}>
            {sentimentLoading ? "Analyzing..." : "Analyze Sentiment"}
          </button>
          {sentimentResult && (
            <div style={{ ...styles.sentimentBox, borderColor: SENTIMENT_COLORS[sentimentResult.sentiment] }}>
              <div style={{ ...styles.sentimentLabel, color: SENTIMENT_COLORS[sentimentResult.sentiment] }}>
                {sentimentResult.sentiment.toUpperCase()}
              </div>
              <div style={styles.sentimentScore}>
                Score: <strong>{sentimentResult.score.toFixed(2)}</strong>
              </div>
              <div style={styles.reasoning}>{sentimentResult.reasoning}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 26, fontWeight: 700, color: "#1a1a2e", margin: 0 },
  sub: { color: "#888", marginTop: 4, marginBottom: 28 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 28,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cardTitle: { margin: 0, fontSize: 17, fontWeight: 700, color: "#1a1a2e" },
  cardDesc: { margin: 0, fontSize: 13, color: "#888" },
  fileInput: { fontSize: 13 },
  btn: {
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  error: { background: "#fff5f5", color: "#e53e3e", padding: "10px 14px", borderRadius: 8, fontSize: 13 },
  result: {
    background: "#f8f9fe",
    borderRadius: 10,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontSize: 13,
    color: "#333",
    marginTop: 8,
  },
  resultRow: { lineHeight: 1.6 },
  skillTag: {
    display: "inline-block",
    background: "#ede9fe",
    color: "#7c3aed",
    borderRadius: 12,
    padding: "2px 8px",
    marginRight: 4,
    marginTop: 2,
    fontSize: 11,
    fontWeight: 600,
  },
  suggestion: {
    background: "#e8faf0",
    color: "#2ecc71",
    padding: "8px 12px",
    borderRadius: 8,
    marginTop: 4,
    fontSize: 13,
  },
  textarea: {
    width: "100%",
    height: 120,
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #e0e0e0",
    fontSize: 13,
    resize: "vertical",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  sentimentBox: {
    border: "2px solid",
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  sentimentLabel: { fontWeight: 800, fontSize: 20, letterSpacing: 2 },
  sentimentScore: { fontSize: 13, color: "#555" },
  reasoning: { fontSize: 13, color: "#444", lineHeight: 1.6 },
};