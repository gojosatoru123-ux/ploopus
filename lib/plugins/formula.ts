/**
 * Safe formula / expression evaluator — no `eval`, no `new Function`.
 *
 * Supports:
 *  - Numbers, quoted strings ("..." or '...'), {{field}} references
 *  - Arithmetic: + - * / % and unary -
 *  - Comparisons: == != > >= < <=
 *  - Logic: && || ! and parentheses
 *  - Functions: ROUND(x, digits?), ABS(x), MIN(...), MAX(...), SUM(...),
 *               AVG(...), IF(cond, a, b), AND(...), OR(...), NOT(x), LEN(x)
 *
 * {{field}} resolves to the field's raw value. Numeric coercion happens
 * lazily — a field used in arithmetic becomes a number (0 if not numeric),
 * a field used in a string context stays a string.
 */

import type { FilterOp } from "./types";

/* ---------------------------- Tokenizer ---------------------------- */

type Token =
    | { type: "num"; value: number }
    | { type: "str"; value: string }
    | { type: "field"; value: string }
    | { type: "ident"; value: string }
    | { type: "op"; value: string }
    | { type: "lparen" }
    | { type: "rparen" }
    | { type: "comma" };

function tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const n = expr.length;
    while (i < n) {
        const c = expr[i];
        if (/\s/.test(c)) { i++; continue; }
        // {{field}}
        if (c === "{" && expr[i + 1] === "{") {
            const end = expr.indexOf("}}", i + 2);
            if (end === -1) throw new Error("Unterminated {{field}}");
            tokens.push({ type: "field", value: expr.slice(i + 2, end).trim() });
            i = end + 2;
            continue;
        }
        // strings
        if (c === '"' || c === "'") {
            const quote = c;
            let j = i + 1;
            let s = "";
            while (j < n && expr[j] !== quote) {
                if (expr[j] === "\\" && j + 1 < n) { s += expr[j + 1]; j += 2; continue; }
                s += expr[j]; j++;
            }
            if (expr[j] !== quote) throw new Error("Unterminated string");
            tokens.push({ type: "str", value: s });
            i = j + 1;
            continue;
        }
        // numbers
        if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(expr[i + 1] ?? ""))) {
            let j = i;
            while (j < n && /[0-9.]/.test(expr[j])) j++;
            tokens.push({ type: "num", value: Number(expr.slice(i, j)) });
            i = j;
            continue;
        }
        // identifiers (function names / true / false)
        if (/[A-Za-z_]/.test(c)) {
            let j = i;
            while (j < n && /[A-Za-z0-9_]/.test(expr[j])) j++;
            tokens.push({ type: "ident", value: expr.slice(i, j) });
            i = j;
            continue;
        }
        // two-char operators
        const two = expr.slice(i, i + 2);
        if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
            tokens.push({ type: "op", value: two });
            i += 2;
            continue;
        }
        if (c === "(") { tokens.push({ type: "lparen" }); i++; continue; }
        if (c === ")") { tokens.push({ type: "rparen" }); i++; continue; }
        if (c === ",") { tokens.push({ type: "comma" }); i++; continue; }
        if ("+-*/%<>!".includes(c)) { tokens.push({ type: "op", value: c }); i++; continue; }
        throw new Error(`Unexpected character '${c}'`);
    }
    return tokens;
}

/* ----------------------------- Parser ------------------------------- */
/* Grammar (lowest to highest precedence):
 *   expr   := or
 *   or     := and ("||" and)*
 *   and    := cmp ("&&" cmp)*
 *   cmp    := add (("==" | "!=" | ">" | ">=" | "<" | "<=") add)*
 *   add    := mul (("+" | "-") mul)*
 *   mul    := unary (("*" | "/" | "%") unary)*
 *   unary  := ("-" | "!")? primary
 *   primary:= num | str | field | ident "(" args ")" | "(" expr ")" | ident
 */

type Value = number | string | boolean;

class Parser {
    private pos = 0;
    constructor(private tokens: Token[], private data: Record<string, unknown>) { }

    parse(): Value {
        const v = this.or();
        if (this.pos < this.tokens.length) throw new Error("Unexpected trailing tokens");
        return v;
    }

    private peek(): Token | undefined { return this.tokens[this.pos]; }
    private next(): Token | undefined { return this.tokens[this.pos++]; }

    private or(): Value {
        let left = this.and();
        while (this.peek()?.type === "op" && (this.peek() as { value: string }).value === "||") {
            this.next();
            const right = this.and();
            left = toBool(left) || toBool(right);
        }
        return left;
    }

    private and(): Value {
        let left = this.cmp();
        while (this.peek()?.type === "op" && (this.peek() as { value: string }).value === "&&") {
            this.next();
            const right = this.cmp();
            left = toBool(left) && toBool(right);
        }
        return left;
    }

    private cmp(): Value {
        let left = this.add();
        while (this.peek()?.type === "op" && ["==", "!=", ">", ">=", "<", "<="].includes((this.peek() as { value: string }).value)) {
            const opTok = this.next() as { type: "op"; value: string };
            const right = this.add();
            left = compare(left, opTok.value, right);
        }
        return left;
    }

    private add(): Value {
        let left = this.mul();
        while (this.peek()?.type === "op" && ["+", "-"].includes((this.peek() as { value: string }).value)) {
            const opTok = this.next() as { type: "op"; value: string };
            const right = this.mul();
            if (opTok.value === "+") {
                // string concatenation if either side is a non-numeric string
                if (typeof left === "string" || typeof right === "string") {
                    left = `${toDisplay(left)}${toDisplay(right)}`;
                } else {
                    left = toNum(left) + toNum(right);
                }
            } else {
                left = toNum(left) - toNum(right);
            }
        }
        return left;
    }

    private mul(): Value {
        let left = this.unary();
        while (this.peek()?.type === "op" && ["*", "/", "%"].includes((this.peek() as { value: string }).value)) {
            const opTok = this.next() as { type: "op"; value: string };
            const right = this.unary();
            const l = toNum(left), r = toNum(right);
            if (opTok.value === "*") left = l * r;
            else if (opTok.value === "/") left = r === 0 ? 0 : l / r;
            else left = r === 0 ? 0 : l % r;
        }
        return left;
    }

    private unary(): Value {
        const tok = this.peek();
        if (tok?.type === "op" && tok.value === "-") { this.next(); return -toNum(this.unary()); }
        if (tok?.type === "op" && tok.value === "!") { this.next(); return !toBool(this.unary()); }
        return this.primary();
    }

    private primary(): Value {
        const tok = this.next();
        if (!tok) throw new Error("Unexpected end of expression");
        switch (tok.type) {
            case "num": return tok.value;
            case "str": return tok.value;
            case "field": {
                const v = this.data[tok.value];
                if (v === undefined || v === null) return "";
                if (typeof v === "boolean" || typeof v === "number" || typeof v === "string") return v;
                if (Array.isArray(v)) return v.join(", ");
                return String(v);
            }
            case "lparen": {
                const v = this.or();
                this.expect("rparen");
                return v;
            }
            case "ident": {
                const name = tok.value.toUpperCase();
                if (name === "TRUE") return true;
                if (name === "FALSE") return false;
                if (this.peek()?.type === "lparen") {
                    this.next();
                    const args: Value[] = [];
                    if (this.peek()?.type !== "rparen") {
                        args.push(this.or());
                        while (this.peek()?.type === "comma") { this.next(); args.push(this.or()); }
                    }
                    this.expect("rparen");
                    return callFn(name, args);
                }
                throw new Error(`Unknown identifier '${tok.value}'`);
            }
            default:
                throw new Error("Unexpected token");
        }
    }

    private expect(type: Token["type"]) {
        const tok = this.next();
        if (!tok || tok.type !== type) throw new Error(`Expected ${type}`);
    }
}

function toNum(v: Value): number {
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function toBool(v: Value): boolean {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    return v !== "" && v.toLowerCase() !== "false" && v !== "0";
}

function toDisplay(v: Value): string {
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    return v;
}

function compare(a: Value, op: string, b: Value): boolean {
    // Numeric compare if both sides look numeric, otherwise string compare.
    const bothNumeric =
        (typeof a === "number" || (typeof a === "string" && a !== "" && Number.isFinite(Number(a)))) &&
        (typeof b === "number" || (typeof b === "string" && b !== "" && Number.isFinite(Number(b))));
    if (bothNumeric) {
        const x = toNum(a), y = toNum(b);
        switch (op) {
            case "==": return x === y;
            case "!=": return x !== y;
            case ">": return x > y;
            case ">=": return x >= y;
            case "<": return x < y;
            case "<=": return x <= y;
            default: return false;
        }
    }
    const x = toDisplay(a), y = toDisplay(b);
    switch (op) {
        case "==": return x === y;
        case "!=": return x !== y;
        case ">": return x > y;
        case ">=": return x >= y;
        case "<": return x < y;
        case "<=": return x <= y;
        default: return false;
    }
}

function callFn(name: string, args: Value[]): Value {
    const nums = () => args.map(toNum);
    switch (name) {
        case "ROUND": {
            const digits = args[1] !== undefined ? toNum(args[1]) : 0;
            const d = Math.pow(10, digits);
            return Math.round(toNum(args[0]) * d) / d;
        }
        case "ABS": return Math.abs(toNum(args[0]));
        case "MIN": return Math.min(...nums());
        case "MAX": return Math.max(...nums());
        case "SUM": return nums().reduce((s, n) => s + n, 0);
        case "AVG": {
            const ns = nums();
            return ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : 0;
        }
        case "IF": return toBool(args[0]) ? args[1] : args[2];
        case "AND": return args.every(toBool);
        case "OR": return args.some(toBool);
        case "NOT": return !toBool(args[0]);
        case "LEN": return toDisplay(args[0]).length;
        default: throw new Error(`Unknown function ${name}`);
    }
}

/* ---------------------------- Public API ----------------------------- */

/**
 * Evaluate a formula expression against a record's data, returning a number.
 * Booleans coerce to 1/0. Returns NaN on parse error or non-numeric result
 * that can't be coerced.
 */
export function evalFormula(expression: string, data: Record<string, unknown>): number {
    if (!expression || !expression.trim()) return NaN;
    try {
        const tokens = tokenize(expression);
        const result = new Parser(tokens, data).parse();
        return toNum(result);
    } catch {
        return NaN;
    }
}

/**
 * Evaluate a formula expression and return its raw value (number, string, or
 * boolean) without numeric coercion. Returns undefined on parse error.
 */
export function evalExpression(expression: string, data: Record<string, unknown>): Value | undefined {
    if (!expression || !expression.trim()) return undefined;
    try {
        const tokens = tokenize(expression);
        return new Parser(tokens, data).parse();
    } catch {
        return undefined;
    }
}

export function applyTemplate(
    template: string,
    data: Record<string, unknown>,
): string {
    return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key) => {
        const v = data[key];
        if (v === undefined || v === null) return "";
        if (Array.isArray(v)) return v.join(", ");
        return String(v);
    });
}

/* ------------------------ Filter / condition matching ------------------------ */

/**
 * Shared matcher used by view filters and workflow conditions.
 * `fieldValue` is the raw stored value, `target` is the comparison value
 * (always a string as entered in the UI).
 */
export function matchOperator(fieldValue: unknown, op: FilterOp, target?: string): boolean {
    const isEmptyVal =
        fieldValue === undefined ||
        fieldValue === null ||
        fieldValue === "" ||
        (Array.isArray(fieldValue) && fieldValue.length === 0);

    switch (op) {
        case "isEmpty": return isEmptyVal;
        case "isNotEmpty": return !isEmptyVal;
        case "contains":
        case "notContains": {
            const needle = (target ?? "").toLowerCase();
            const found = Array.isArray(fieldValue)
                ? fieldValue.map((x) => String(x).toLowerCase()).some((h) => h.includes(needle))
                : String(fieldValue ?? "").toLowerCase().includes(needle);
            return op === "contains" ? found : !found;
        }
        default: break;
    }

    if (target === undefined) return true;

    const numField = Number(fieldValue);
    const numTarget = Number(target);
    const bothNumeric =
        Number.isFinite(numField) && Number.isFinite(numTarget) &&
        fieldValue !== "" && fieldValue !== null && fieldValue !== undefined;

    if (bothNumeric) {
        switch (op) {
            case "eq": return numField === numTarget;
            case "neq": return numField !== numTarget;
            case "gt": return numField > numTarget;
            case "gte": return numField >= numTarget;
            case "lt": return numField < numTarget;
            case "lte": return numField <= numTarget;
            default: return false;
        }
    }

    const sField = String(fieldValue ?? "").toLowerCase();
    const sTarget = target.toLowerCase();
    switch (op) {
        case "eq": return sField === sTarget;
        case "neq": return sField !== sTarget;
        case "gt": return sField > sTarget;
        case "gte": return sField >= sTarget;
        case "lt": return sField < sTarget;
        case "lte": return sField <= sTarget;
        default: return false;
    }
}