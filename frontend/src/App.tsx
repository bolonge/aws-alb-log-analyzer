import { Route, Routes, Link } from "react-router-dom";
import AnalysisList from "./components/AnalysisList";
import AnalysisDetailPage from "./components/AnalysisDetail";

export default function App() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px" }}>
      <header style={{ marginBottom: 24, borderBottom: "2px solid #333", paddingBottom: 12 }}>
        <Link to="/" style={{ textDecoration: "none", color: "#333" }}>
          <h1 style={{ margin: 0 }}>ALB Log Analyzer</h1>
        </Link>
        <p style={{ margin: "4px 0 0", color: "#666", fontSize: 14 }}>
          4xx Error Analysis Dashboard
        </p>
      </header>
      <Routes>
        <Route path="/" element={<AnalysisList />} />
        <Route path="/analyses/:id" element={<AnalysisDetailPage />} />
      </Routes>
    </div>
  );
}
