export type LeaderInput = {
  name: string;
  email: string;
  cell_name: string;
  location: string | null;
  weekday: number | null;
  meeting_time: string | null;
};

export function parseLeader(data: FormData): LeaderInput | null {
  const value = (key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";
  const name = value("name"), email = value("email").toLowerCase(), cell_name = value("cell_name");
  const location = value("location"), weekday = value("weekday"), meeting_time = value("meeting_time");
  if (!name || name.length > 120 || !cell_name || cell_name.length > 120 || location.length > 240) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (weekday && !/^[0-6]$/.test(weekday)) return null;
  if (meeting_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(meeting_time)) return null;
  return { name, email, cell_name, location: location || null, weekday: weekday ? Number(weekday) : null, meeting_time: meeting_time || null };
}

export function siteUrl(configured: string | undefined, development: boolean): string {
  const url = new URL(configured || (development ? "http://localhost:3000" : ""));
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(development && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new Error("Configure NEXT_PUBLIC_SITE_URL com a origem da aplicação.");
  }
  return url.origin;
}

export function validPassword(password: string, confirmation: string) {
  return password.length >= 8 && password.length <= 128 && password === confirmation;
}
