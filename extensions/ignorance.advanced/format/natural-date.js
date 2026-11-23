const DAY = 86_400_000;
const CHINESE_DAYS = "日一二三四五六";
const ENGLISH_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DIGITS = "零一二三四五六七八九";
const NUMBER = "([0-9]{1,3}|[一二三四五六七八九十两]{1,3})";
const RELATIVE_DAYS = new Map([
  ["今天", 0], ["明天", 1], ["后天", 2], ["大后天", 3], ["昨天", -1],
  ["today", 0], ["tomorrow", 1], ["yesterday", -1],
]);
const RELATIVE_OFFSET = new RegExp(`^${NUMBER} *(天|周|星期|个?月) *(后|前)$`);
const NEXT_MONTH = new RegExp(`^下个?月 *${NUMBER} *(?:日|号)$`);
const MONTH_DAY = new RegExp(`^${NUMBER} *月 *${NUMBER} *(?:日|号)$`);

function dayAt(year, month, day) {
  const result = new Date(0);
  result.setUTCFullYear(year, month, day);
  return result;
}

function baselineDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return dayAt(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = dayAt(year, month - 1, day);
    if (iso(date) === value) return date;
  }
  throw new Error("基准日期无效");
}

function iso(date) {
  const year = date.getUTCFullYear();
  if (year < 1 || year > 9999) throw new Error("第 1 字符：日期超出范围");
  return date.toISOString().slice(0, 10);
}

function shiftDays(date, count) {
  return new Date(date.getTime() + count * DAY);
}

function shiftMonths(date, count, day = date.getUTCDate()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + count;
  return dayAt(year, month, Math.min(day, dayAt(year, month + 1, 0).getUTCDate()));
}

function numberValue(value) {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "两") return 2;
  if (value.length === 1 && value !== "十") return DIGITS.indexOf(value);
  const match = /^([二三四五六七八九]?)十([一二三四五六七八九]?)$/.exec(value);
  if (!match) return -1;
  return (match[1] ? DIGITS.indexOf(match[1]) : 1) * 10 + (match[2] ? DIGITS.indexOf(match[2]) : 0);
}

function weekDate(base, weekday, weeks, weekStart) {
  const offset = (base.getUTCDay() - weekStart + 7) % 7;
  return shiftDays(base, weeks * 7 - offset + (weekday - weekStart + 7) % 7);
}

function dateRangeError(position) {
  throw new Error(`第 ${position} 字符：日期超出范围`);
}

export function parseNaturalDate(input, baseline = new Date(), { weekStart = 1 } = {}) {
  const base = baselineDate(baseline);
  const source = input.trim().toLowerCase().replace(/\s+/g, " ");
  const startDay = weekStart === 0 ? 0 : 1;
  if (RELATIVE_DAYS.has(source)) return iso(shiftDays(base, RELATIVE_DAYS.get(source)));

  const offset = RELATIVE_OFFSET.exec(source);
  if (offset) {
    const [, countText, unit, direction] = offset;
    const count = numberValue(countText);
    if (count < 0 || (!/^\d/.test(countText) && count > 31)) dateRangeError(1);
    const delta = direction === "后" ? count : -count;
    return iso(unit.endsWith("月") ? shiftMonths(base, delta) : shiftDays(base, delta * (unit === "天" ? 1 : 7)));
  }

  const week = /^(本周|这周|下周|下下周)([一二三四五六日天]|末)$/.exec(source);
  if (source === "周末" || week) {
    const prefix = week?.[1];
    const day = week?.[2] ?? "末";
    const weeks = prefix === "下下周" ? 2 : Number(prefix === "下周");
    const weekday = day === "末" ? 6 : day === "天" ? 0 : CHINESE_DAYS.indexOf(day);
    return iso(weekDate(base, weekday, weeks, startDay));
  }

  const englishWeek = /^next ([a-z]+)$/.exec(source);
  if (englishWeek && ENGLISH_DAYS.includes(englishWeek[1])) {
    return iso(weekDate(base, ENGLISH_DAYS.indexOf(englishWeek[1]), 1, startDay));
  }

  const next = NEXT_MONTH.exec(source);
  if (next) {
    const day = numberValue(next[1]);
    if (day < 1 || day > 31) dateRangeError(source.indexOf(next[1]) + 1);
    return iso(shiftMonths(base, 1, day));
  }

  const absolute = MONTH_DAY.exec(source);
  if (absolute) {
    const month = numberValue(absolute[1]);
    const day = numberValue(absolute[2]);
    if (month < 1 || month > 12) dateRangeError(1);
    const date = dayAt(base.getUTCFullYear(), month - 1, day);
    if (day < 1 || date.getUTCMonth() !== month - 1) dateRangeError(source.lastIndexOf(absolute[2]) + 1);
    return iso(date);
  }

  throw new Error("第 1 字符：无法识别日期");
}

export function formatNaturalDate(value, format = "iso") {
  if (format === "wiki") return `[[${value}]]`;
  if (format === "weekday") return `${value}（周${CHINESE_DAYS[baselineDate(value).getUTCDay()]}）`;
  return value;
}
