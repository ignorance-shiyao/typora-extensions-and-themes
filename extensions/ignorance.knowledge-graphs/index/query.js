const collator = new Intl.Collator("zh-CN", { numeric: true });
const DAY = 86_400_000;
const TOKEN = /\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|!=|<=|>=|[()<>=+]|-\d+(?:\.\d+)?|-|[^\s()<>=!+"']+)/gy;

export function queryError(line, message, column = 1) {
  return new Error(`第 ${line} 行第 ${column} 列：${message}`);
}

export function readOptions(source, allowed) {
  const options = new Map();
  for (const [index, raw] of source.split(/\r\n|\n|\r/).entries()) {
    const line = index + 1;
    if (!raw.trim()) continue;
    const match = /^\s*([a-z]+)\s*:\s*(.*?)\s*$/i.exec(raw);
    if (!match) throw queryError(line, "需要「关键字: 值」");
    const key = match[1].toLowerCase();
    if (!allowed.includes(key)) throw queryError(line, `未知关键字 ${key}`);
    if (options.has(key)) throw queryError(line, `重复的关键字 ${key}`);
    if (!match[2]) throw queryError(line, `${key} 缺少值`);
    options.set(key, { value: match[2], line });
  }
  return options;
}

class Expression {
  constructor(source, line) {
    this.source = source;
    this.line = line;
    this.tokens = [];
    for (let offset = 0; offset < source.length;) {
      TOKEN.lastIndex = offset;
      const match = TOKEN.exec(source);
      if (!match) throw queryError(line, "无法识别字符", offset + 1);
      this.tokens.push({ text: match[1], offset: TOKEN.lastIndex - match[1].length });
      offset = TOKEN.lastIndex;
    }
    this.index = 0;
  }

  get token() { return this.tokens[this.index]?.text ?? ""; }

  error(message) {
    return queryError(this.line, message, (this.tokens[this.index]?.offset ?? this.source.length) + 1);
  }

  take(text) {
    if (this.token.toLowerCase() !== text) return false;
    this.index++;
    return true;
  }

  required(message) {
    const token = this.token;
    if (!token || token === ")" || /^(?:and|or)$/i.test(token)) throw this.error(message);
    this.index++;
    return token;
  }

  atom(predicate) {
    if (this.take("(")) {
      const value = this.or(predicate);
      if (!this.take(")")) throw this.error("需要右括号");
      return value;
    }
    return predicate(this);
  }

  and(predicate) {
    let left = this.atom(predicate);
    while (this.take("and")) left = { logic: "and", left, right: this.atom(predicate) };
    return left;
  }

  or(predicate) {
    let left = this.and(predicate);
    while (this.take("or")) left = { logic: "or", left, right: this.and(predicate) };
    return left;
  }

  parse(predicate) {
    const result = this.or(predicate);
    if (this.token) throw this.error("多余的表达式");
    return result;
  }
}

function unquote(value) {
  if (!/^["']/.test(value)) return value;
  return value.slice(1, -1).replace(/\\(["'\\])/g, "$1");
}

function sourcePredicate(parser) {
  const value = unquote(parser.required("需要目录或标签"));
  if (!value || /^[+<>=!\-]$/.test(value)) throw parser.error("需要有效的目录或标签");
  if (value.startsWith("#")) {
    if (value.length === 1) throw parser.error("标签不能为空");
    return { tag: value.slice(1) };
  }
  const folder = value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
  if (folder.split("/").includes("..") || folder.startsWith("/")) throw parser.error("需要工作区相对目录");
  return { folder };
}

function condition(parser) {
  const attr = unquote(parser.required("需要属性名"));
  const operator = parser.required("需要比较运算符").toLowerCase();
  if (!["=", "!=", "<", ">", "<=", ">=", "contains"].includes(operator)) throw parser.error("不支持的比较运算符");
  const token = parser.required("需要比较值");
  let expected = unquote(token);
  if (token.toLowerCase() === "today") {
    const negative = parser.take("-");
    const signedOffset = !negative && /^-\d+d$/i.test(parser.token);
    if (negative || parser.take("+") || signedOffset) {
      const offset = /^(?:-)?(\d+)d$/i.exec(parser.required("需要天数，例如 7d"));
      if (!offset) throw parser.error("偏移需要形如 7d 的天数");
      expected = { days: Number(offset[1]) * (negative || signedOffset ? -1 : 1) };
    } else expected = { days: 0 };
  } else if (!/^['"]/.test(token)) {
    if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(token)) expected = Number(token);
    else if (token === "true" || token === "false") expected = token === "true";
  }
  return { attr, operator, expected };
}

export function parseSource(option) {
  return option ? new Expression(option.value, option.line).parse(sourcePredicate) : null;
}

function expressionMatches(node, predicate) {
  if (!node) return true;
  if (node.logic === "and") return expressionMatches(node.left, predicate) && expressionMatches(node.right, predicate);
  if (node.logic === "or") return expressionMatches(node.left, predicate) || expressionMatches(node.right, predicate);
  return predicate(node);
}

export function sourceIncludes(source, record) {
  return expressionMatches(source, ({ tag, folder }) => tag === undefined
    ? !folder || record.path.startsWith(folder + "/")
    : (record.tags ?? []).includes(tag));
}

export function dayOffset(baseline, days) {
  const date = new Date(Date.parse(`${baseline}T00:00:00Z`) + days * DAY);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : undefined;
}

export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function calendarDate(text) {
  if (typeof text !== "string") return undefined;
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text.trim());
  if (!match) return undefined;
  const iso = [match[1], match[2].padStart(2, "0"), match[3].padStart(2, "0")].join("-");
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : undefined;
}

function propertyOf(record, name) {
  if (name === "文件") return record.name;
  if (name === "路径") return record.path;
  if (name === "tags") return record.tags;
  return Object.hasOwn(record.properties ?? {}, name) ? record.properties[name] : undefined;
}

export function compareValue(left, right) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  const leftDate = calendarDate(left);
  const rightDate = calendarDate(right);
  if (leftDate && rightDate) return collator.compare(leftDate, rightDate);
  return collator.compare(String(left), String(right));
}

function matchesCondition(record, node, today) {
  const { attr, operator, expected } = node;
  let left = propertyOf(record, attr);
  let right = expected;
  if (left == null) return false;
  if (typeof right === "object") {
    left = calendarDate(left);
    right = dayOffset(today, right.days);
    if (!left || !right) return false;
  }
  if (["<", ">", "<=", ">="].includes(operator) && calendarDate(right) && !calendarDate(left)) return false;
  if (operator === "contains") return Array.isArray(left) ? left.some((value) => String(value) === String(right)) : String(left).includes(String(right));
  if (Array.isArray(left) || typeof left === "object") return false;
  const order = compareValue(left, right);
  switch (operator) {
    case "=": return order === 0;
    case "!=": return order !== 0;
    case "<": return order < 0;
    case ">": return order > 0;
    case "<=": return order <= 0;
    case ">=": return order >= 0;
  }
}

export function parseQuery(source) {
  const options = readOptions(source, ["from", "where", "fields", "sort", "limit", "view", "group"]);
  const where = options.get("where");
  const fields = options.get("fields");
  const sort = options.get("sort");
  const limit = options.get("limit");
  const view = options.get("view");
  const group = options.get("group");
  const columns = fields?.value.split(",").map((field) => unquote(field.trim())) ?? ["文件"];
  if (columns.some((column) => !column)) throw queryError(fields.line, "字段名不能为空");
  const sorting = sort && /^(.+?)(?:\s+(asc|desc))?$/.exec(sort.value);
  if (sort && (!sorting || /\s/.test(unquote(sorting[1])) && !/^["']/.test(sorting[1]))) throw queryError(sort.line, "排序格式为「字段 asc|desc」");
  if (limit && !/^[1-9]\d{0,3}$/.test(limit.value)) throw queryError(limit.line, "limit 需要 1 至 9999 的整数");
  if (view && !["table", "list", "count"].includes(view.value)) throw queryError(view.line, "view 可用 table、list 或 count");
  return {
    source: parseSource(options.get("from")),
    filter: where ? new Expression(where.value, where.line).parse(condition) : null,
    columns, sort: sorting && [unquote(sorting[1]), sorting[2] === "desc" ? -1 : 1],
    limit: limit ? Number(limit.value) : Infinity,
    view: view?.value ?? "table", group: group && unquote(group.value),
  };
}

export function displayValue(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(displayValue).join("，");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function runQuery(query, records, today = localToday()) {
  const matched = records.filter((record) => sourceIncludes(query.source, record) &&
    expressionMatches(query.filter, (conditionNode) => matchesCondition(record, conditionNode, today)));
  if (query.sort) {
    const [key, direction] = query.sort;
    matched.sort((a, b) => {
      const left = propertyOf(a, key);
      const right = propertyOf(b, key);
      if (left == null || right == null) return Number(left == null) - Number(right == null);
      return direction * compareValue(left, right);
    });
  }
  const groups = new Map();
  const selected = matched.slice(0, query.limit);
  for (const record of selected) {
    const label = query.group ? displayValue(propertyOf(record, query.group)) || "未分组" : "";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push({ path: record.path, cells: query.columns.map((column) => displayValue(propertyOf(record, column))) });
  }
  return { view: query.view, columns: query.columns, count: selected.length, groups: Array.from(groups, ([label, rows]) => ({ label, rows })) };
}
