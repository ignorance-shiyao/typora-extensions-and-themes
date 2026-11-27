import { numericCell } from "./table-tools.js";

const TOKEN = /\s*(@(?:>|-?\d+)|\$\d+|(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?|[A-Za-z]+|\.\.|[=+*/(),-])/iy;
const PRECEDENCE = { "+": 1, "-": 1, "*": 2, "/": 2 };
const AGGREGATES = new Set(["sum", "avg", "min", "max", "count"]);

class FormulaParser {
  constructor(source) {
    this.source = source.trim();
    this.offset = 0;
    this.advance();
  }

  advance() {
    TOKEN.lastIndex = this.offset;
    const match = TOKEN.exec(this.source);
    this.position = this.offset + (match ? match[0].length - match[1].length : 0);
    if (!match && this.offset < this.source.length) this.fail("无法识别此字符");
    this.token = match?.[1] ?? "";
    this.offset = TOKEN.lastIndex;
  }

  fail(message) {
    throw new Error(`第 ${this.position + 1} 字符：${message}`);
  }

  take(expected) {
    if (this.token !== expected) return false;
    this.advance();
    return true;
  }

  expect(expected) {
    if (!this.take(expected)) this.fail(`需要 ${expected}`);
  }

  reference() {
    const row = this.token.startsWith("@") ? this.token.slice(1) : null;
    if (row !== null) this.advance();
    const column = this.token.startsWith("$") ? Number(this.token.slice(1)) : null;
    if (column !== null) this.advance();
    if (row === null && column === null) this.fail("需要单元格引用");
    return { row, column };
  }

  atom() {
    if (this.take("-")) return { kind: "negate", value: this.atom() };
    if (this.take("+")) return this.atom();
    if (this.take("(")) {
      const value = this.expression();
      this.expect(")");
      return value;
    }
    const token = this.token;
    if (token.startsWith("@") || token.startsWith("$")) {
      const start = this.reference();
      return this.take("..") ? { kind: "range", start, end: this.reference() } : { kind: "cell", ...start };
    }
    if (/^[.\d]/.test(token) && token !== "..") {
      this.advance();
      return { kind: "number", value: Number(token) };
    }
    const name = token.toLowerCase();
    if (!AGGREGATES.has(name)) this.fail("需要数值、引用或聚合函数");
    this.advance();
    this.expect("(");
    const values = [this.expression()];
    while (this.take(",")) values.push(this.expression());
    this.expect(")");
    return { kind: "aggregate", name, values };
  }

  expression(minPrecedence = 1) {
    let left = this.atom();
    while ((PRECEDENCE[this.token] ?? 0) >= minPrecedence) {
      const operator = this.token;
      this.advance();
      left = { kind: "binary", operator, left, right: this.expression(PRECEDENCE[operator] + 1) };
    }
    return left;
  }
}

function resolveRow(row, current, length) {
  if (row === null) return current;
  if (row === ">") return length - 1;
  const number = Number(row);
  // Row 1 is the header; @-1 is the row immediately before the last row.
  return number < 0 ? length - 1 + number : number - 2;
}

function aggregate(name, values) {
  const sum = () => values.reduce((total, value) => total + value, 0);
  switch (name) {
    case "sum": return sum();
    case "avg": return sum() / values.length;
    case "min": return values.reduce((result, value) => Math.min(result, value), Infinity);
    case "max": return values.reduce((result, value) => Math.max(result, value), -Infinity);
    case "count": return values.length;
  }
}

function evaluate(node, context) {
  const { row, column, read, rowCount } = context;
  const readReference = (reference) => read(resolveRow(reference.row, row, rowCount), reference.column === null ? column : reference.column - 1);
  switch (node.kind) {
    case "number": return node.value;
    case "negate": return -evaluate(node.value, context);
    case "cell": return readReference(node);
    case "range": {
      const start = resolveRow(node.start.row, row, rowCount);
      const end = resolveRow(node.end.row, row, rowCount);
      const firstColumn = node.start.column === null ? column : node.start.column - 1;
      const lastColumn = node.end.column === null ? firstColumn : node.end.column - 1;
      if (start < 0 || end >= rowCount || start > end || firstColumn > lastColumn) throw new Error("范围无效");
      const values = [];
      for (let r = start; r <= end; r++) {
        for (let c = firstColumn; c <= lastColumn; c++) values.push(read(r, c));
      }
      return values;
    }
    case "binary": {
      const left = evaluate(node.left, context);
      const right = evaluate(node.right, context);
      if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error("运算需要数值");
      switch (node.operator) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": return left / right;
      }
      break;
    }
    case "aggregate": return aggregate(node.name, node.values.flatMap((value) => evaluate(value, context)));
  }
}

export function calculateTable(rows, expression) {
  const planned = new Map();
  const errors = new Set();
  const columnCount = rows[0]?.length ?? 0;

  function report(formula, error) {
    errors.add(`${formula}：${error.message}`);
  }

  for (const raw of expression.split(";")) {
    const formula = raw.trim();
    if (!formula) continue;
    let targets = [];
    try {
      const parser = new FormulaParser(formula);
      const target = parser.reference();
      const column = (target.column ?? 0) - 1;
      if (column < 0 || column >= columnCount) parser.fail("目标列不存在");
      targets = target.row === null
        ? rows.map((_, row) => ({ row, column }))
        : [{ row: resolveRow(target.row, 0, rows.length), column }];
      if (targets.some(({ row }) => row < 0 || row >= rows.length)) parser.fail("目标行不存在");
      parser.expect("=");
      const node = parser.expression();
      if (parser.token) parser.fail("公式有多余内容");
      for (const { row } of targets) planned.set(row * columnCount + column, { formula, node });
    } catch (error) {
      report(formula, error);
      for (const { row, column } of targets) {
        if (row >= 0 && row < rows.length) planned.set(row * columnCount + column, { formula, node: null });
      }
    }
  }

  const results = new Map();
  const inProgress = new Set();

  function read(row, column) {
    if (row < 0 || row >= rows.length) throw new Error("引用的行不存在");
    if (column < 0 || column >= columnCount) throw new Error("引用的列不存在");
    const key = row * columnCount + column;
    const plan = planned.get(key);
    if (!plan) {
      const value = numericCell(rows[row][column]);
      if (!Number.isFinite(value)) throw new Error("引用的单元格非数字");
      return value;
    }
    if (inProgress.has(key)) throw new Error("循环引用");
    if (results.has(key)) {
      const result = results.get(key);
      if (result instanceof Error) throw result;
      return result;
    }
    inProgress.add(key);
    try {
      if (!plan.node) throw new Error("公式语法错误");
      const value = evaluate(plan.node, { row, column, rowCount: rows.length, read });
      if (!Number.isFinite(value)) throw new Error("计算结果无效");
      results.set(key, value);
      return value;
    } catch (error) {
      results.set(key, error);
      report(plan.formula, error);
      throw error;
    } finally {
      inProgress.delete(key);
    }
  }

  const output = rows.map((cells, row) => cells.map((cell, column) => {
    if (!planned.has(row * columnCount + column)) return cell;
    try {
      return String(read(row, column));
    } catch {
      return "#ERR";
    }
  }));
  return { rows: output, errors: [...errors] };
}
