import { useRef, useState } from "react";
import { Form } from "./components/Form.tsx";
import { Report } from "./components/Report.tsx";
import type { AnalyzeResponse, FormInput } from "./lib/schema.ts";
import { exportRuns, importRuns, loadRuns, saveRun, type Run } from "./lib/storage.ts";

export function App() {
  const [runs, setRuns] = useState<Run[]>(() => loadRuns());
  const [active, setActive] = useState<Run | null>(() => loadRuns()[0] ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(input: FormInput) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      // Read the raw text first so an empty/non-JSON body (e.g. a proxy timeout)
      // surfaces a clear error instead of "Unexpected end of JSON input".
      const text = await res.text();
      if (!text) {
        throw new Error(
          res.ok
            ? "Empty response from server (the analysis may have timed out — check the API server logs)."
            : `Server returned ${res.status} ${res.statusText} with no body.`,
        );
      }
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Unexpected non-JSON response (${res.status}): ${text.slice(0, 200)}`);
      }
      const body = json as { detail?: string; error?: string };
      if (!res.ok) throw new Error(body.detail || body.error || "Request failed");
      const result = json as AnalyzeResponse;
      const run = saveRun(input, result);
      setRuns(loadRuns());
      setActive(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>YC Idea Grader</h1>
        <p className="tagline">Four honest inputs. One sourced verdict. Run the experiment.</p>
      </header>

      <div className="layout">
        <main className="main">
          <Form onSubmit={handleSubmit} loading={loading} />
          {error && <div className="error">⚠ {error}</div>}
          {active && <Report data={active.result} />}
        </main>

        <aside className="sidebar">
          <div className="sidebar-actions">
            <button onClick={exportRuns} className="ghost">Export</button>
            <button onClick={() => fileRef.current?.click()} className="ghost">Import</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  await importRuns(f);
                  setRuns(loadRuns());
                }
              }}
            />
          </div>
          <h3>History</h3>
          <ul className="history">
            {runs.map((r) => (
              <li
                key={r.id}
                className={active?.id === r.id ? "active" : ""}
                onClick={() => setActive(r)}
              >
                <span className={`dot dot-${r.result.output.verdict}`} />
                <span className="hist-title">{r.input.idea ?? r.input.problem.slice(0, 40)}</span>
              </li>
            ))}
            {runs.length === 0 && <li className="empty">No runs yet.</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
}
