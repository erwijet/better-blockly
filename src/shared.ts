export type Join<A extends object, B extends object> = {
  [k in keyof A | keyof B]: k extends keyof A
    ? A[k]
    : k extends keyof B
      ? B[k]
      : never;
};

export type Content =
  | { type: "text"; value: string }
  | { type: "dropdown"; key: string; value: { [k in string]?: string } }
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

export type BuiltinType = "String" | "Boolean" | "Number";
export type WildcardType = "*";
export type NeverType = "none";
