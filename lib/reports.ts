export function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function periodBounds(period: "semana" | "mes", today = todayInSaoPaulo()) {
  const start = new Date(`${today}T12:00:00Z`);
  if (period === "mes") start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const end = new Date(start);
  if (period === "mes") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + 7);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export function formatDate(date: string) { return date.slice(0, 10).split("-").reverse().join("/"); }
export function parseReport(data: FormData) {
  const meeting_date = String(data.get("meeting_date") ?? "");
  const date = new Date(`${meeting_date}T12:00:00Z`);
  const count = (key: string) => {
    const raw = String(data.get(key) ?? "").trim();
    return /^\d+$/.test(raw) && Number(raw) <= 2147483647 ? Number(raw) : null;
  };
  const participants = count("participants"), visitors = count("visitors");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meeting_date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== meeting_date || participants === null || visitors === null) return null;
  return { meeting_date, participants, visitors };
}
