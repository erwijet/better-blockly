import { BlockBuilder } from "./BlockBuilder";

export type Join<A extends object, B extends object> = {
  [k in keyof A | keyof B]: k extends keyof A
    ? A[k]
    : k extends keyof B
      ? B[k]
      : never;
};

/**
 * A type that can be either a value or a factory function that returns a value
 */
export type Manufacturable<NonFunc> = NonFunc extends Function
  ? never
  : NonFunc | (() => NonFunc);

/**
 * A function that composes two functions with specific types.
 */
export function compose<T, U, V>(
  f: (arg: U) => V,
  g: (...args: T[]) => U
): (...args: T[]) => V {
  return (...args: T[]) => f(g(...args));
}

export function coerceToEntries<T extends string>(
  val: T[] | { [_ in string]?: T }
): [string, T][] {
  if (Array.isArray(val)) return val.map((v) => [v, v] as [string, T]);
  return Object.entries(val) as [string, T][];
}

export type DropdownOptionDef<V extends string> = V[] | { [_ in string]?: V };

export type Content =
  | { type: "text"; value: string }
  | { type: "variable", key: string, varTypes: string[] }
  | {
      type: "dropdown";
      key: string;
      value: Manufacturable<DropdownOptionDef<string>>;
    }
  | { type: "number"; key: string; value: number }
  | { type: "textbox"; key: string; value: string };

export type Field =
  | { type: "inputOnly"; content: Content[] }
  | { type: "slot"; key: string; check: string; content: Content[] }
  | { type: "stmt"; key: string; check: string };

export type InputMap = { [_ in string]?: string | number };

export type BlockImpl<T extends InputMap, SlotKey extends string> = {
  fields: T;
  resolve: (key: SlotKey, order?: number) => string;
};

export type BlocksRef = { Blocks: { [key: string]: any } }

export type BuiltinType = "String" | "Boolean" | "Number";
export type WildcardType = "*";
export type NeverType = "none";