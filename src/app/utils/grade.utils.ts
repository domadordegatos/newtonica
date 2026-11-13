const GRADE_MAP: Record<string, string> = {
  'undecimo': '11°',
  'decimo': '10°',
  'noveno': '9°',
  'octavo': '8°',
  'septimo': '7°',
  'sexto': '6°',
  'quinto': '5°',
  'cuarto': '4°',
  'tercero': '3°',
  'segundo': '2°',
  'primero': '1°',
};

const ACCENTS_RE = /[̀-ͯ]/g;

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(ACCENTS_RE, '');
}

export function cleanGrade(raw: string): string {
  const parts = raw.trim().split(/\s+/);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of parts) {
    const key = stripAccents(p.toLowerCase());
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }
  return unique.join(' ');
}

export function abbreviateGrade(grade: string): string {
  const cleaned = cleanGrade(grade);
  const parts = cleaned.split(/\s+/);
  if (parts.length === 0) return cleaned;

  const first = stripAccents(parts[0].toLowerCase());
  const prefix = GRADE_MAP[first];
  if (!prefix) return cleaned;

  const suffix = parts.slice(1).join(' ');
  return suffix ? `${prefix}${suffix}` : prefix;
}
