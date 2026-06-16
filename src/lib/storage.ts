import type { AnalyzeResponse, FormInput } from "./schema.ts";

const KEY = "yc-grader-runs";

export interface Run {
  id: string;
  at: number; // epoch ms
  input: FormInput;
  result: AnalyzeResponse;
}

export function loadRuns(): Run[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Run[]) : [];
  } catch {
    return [];
  }
}

export function saveRun(input: FormInput, result: AnalyzeResponse): Run {
  const run: Run = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    input,
    result,
  };
  const runs = [run, ...loadRuns()].slice(0, 50);
  localStorage.setItem(KEY, JSON.stringify(runs));
  return run;
}

export function deleteRun(id: string): Run[] {
  const runs = loadRuns().filter((r) => r.id !== id);
  localStorage.setItem(KEY, JSON.stringify(runs));
  return runs;
}

export function exportRuns(): void {
  const blob = new Blob([JSON.stringify(loadRuns(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yc-grader-runs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importRuns(file: File): Promise<Run[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(String(reader.result)) as Run[];
        const merged = [...incoming, ...loadRuns()];
        // Dedupe by id, keep first (incoming wins).
        const seen = new Set<string>();
        const deduped = merged.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
        localStorage.setItem(KEY, JSON.stringify(deduped.slice(0, 50)));
        resolve(deduped);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
