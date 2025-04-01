import * as Blockly from "blockly/core";
import { maybe } from "@tsly/maybe";
import {
  InputMap,
  WildcardType,
  BuiltinType,
  NeverType,
  Field,
  BlockImpl,
  Content,
  coerceToEntries,
  BlocksRef,
} from "./shared";
import { ContentBuilder, ContentBuilderFn } from "./ContentBuilder";

export type BlockBuilderPlugin<Meta extends object> = {
  name: string,
  blockWillRegister?: (builder: BlockBuilder<{}, any, any, boolean, Meta>) => unknown;
  blockDidRegister?: (builder: BlockBuilder<{}, any, any, boolean, Meta>) => unknown;
}

export class BlockBuilder<
  BlockInputMap extends InputMap,
  SlotKey extends string,
  Type extends string,
  IsExpr extends boolean,
  Meta extends object
> {
  #prevType: Type | WildcardType | null;
  #nextType: Type | WildcardType | null;
  #outputType: Type | BuiltinType | null;
  #inline: boolean | null;

  #color: string | number;
  #fields: Field[];
  #meta: object;

  constructor(
    private name: string,
    private generator: Blockly.Generator,
    private blocksRef: BlocksRef,
    private plugins: BlockBuilderPlugin<Meta>[]
  ) {
    this.#color = 120;
    this.#nextType = "*";
    this.#prevType = "*";
    this.#outputType = null;
    this.#fields = [];
    this.#inline = null;
    this.#meta = {}
  }

  follows(type: Type | WildcardType | NeverType) {
    if (type == "none") this.#prevType = null;
    else this.#prevType = type;

    return this;
  }

  meta<K extends keyof Meta>(key: K, value: Meta[K]) {
    this.#meta = { ...this.#meta, [key]: value }
    return this
  }

  getMeta(): Partial<Meta> {
    return this.#meta;
  }

  preceeds(type: Type | WildcardType | NeverType) {
    if (type == "none") this.#nextType = null;
    else this.#nextType = type;

    return this;
  }

  hue(hue: number) {
    this.#color = hue;
    return this;
  }

  color(hueOrHex: number | string) {
    this.#color = hueOrHex;
    return this;
  }

  inline() {
    this.#inline = true;
    return this;
  }

  extern() {
    this.#inline = false;
    return this;
  }

  outputs(
    type: Type | BuiltinType
  ): BlockBuilder<BlockInputMap, SlotKey, Type, true, Meta> {
    this.#outputType = type;
    this.#nextType = null;
    this.#prevType = null;
    return this as BlockBuilder<BlockInputMap, SlotKey, Type, true, Meta>;
  }

  content<NextInputMap extends InputMap>(
    builderFn: ContentBuilderFn<BlockInputMap, NextInputMap, Type>
  ) {
    const field: Field = {
      type: "inputOnly",
      content: [],
    };

    builderFn(new ContentBuilder((content) => field.content.push(content)));

    this.#fields.push(field);

    return this as unknown as BlockBuilder<NextInputMap, SlotKey, Type, IsExpr, Meta>;
  }

  slot<K extends string, NextInputMap extends InputMap = BlockInputMap>(
    key: K,
    def: {
      allow: Type | BuiltinType | WildcardType;
      content: ContentBuilderFn<BlockInputMap, NextInputMap, Type>;
    }
  ) {
    const field: Field = {
      key,
      type: "slot",
      check: def.allow,
      content: [],
    };

    def.content?.(new ContentBuilder((content) => field.content.push(content)));

    this.#fields.push(field);

    return this as unknown as BlockBuilder<
      NextInputMap,
      SlotKey | K,
      Type,
      IsExpr,
      Meta
    >;
  }

  stmt<const K extends string>(
    key: K,
    opts: { allow: Type | BuiltinType | WildcardType }
  ) {
    this.#fields.push({
      key,
      type: "stmt",
      check: opts.allow,
    });

    return this as BlockBuilder<BlockInputMap, SlotKey | K, Type, IsExpr, Meta>;
  }

  impl(
    builder: (
      block: BlockImpl<BlockInputMap, SlotKey>
    ) => IsExpr extends true
      ? string | { value: string; order: number }
      : string
  ): void {
    for (const plugin of this.plugins) {
      plugin.blockWillRegister?.(this);
    }

    const fields = this.#fields,
      color = this.#color,
      nextType = this.#nextType,
      prevType = this.#prevType,
      outputType = this.#outputType,
      inline = this.#inline,
      generator = this.generator;

    this.blocksRef.Blocks[this.name] = {
      init: function () {
        this.setColour(color);
        this.setTooltip("");
        this.setHelpUrl("");

        maybe(nextType)?.take((it) => {
          this.setNextStatement(true, it);
        });

        maybe(prevType)?.take((it) =>
          this.setPreviousStatement(true, it)
        );

        maybe(outputType)?.take((it) => {
          this.setOutput(true, it);
        });

        maybe(inline)?.take((it) => {
          this.setInputsInline(it);
        });

        // note: Blockly doesn't have a real type for a block's `this` context, so we use `any` here
        const registerContent = (handle: any, content: Content[]): void => {
          for (const input of content) {
            if (input.type == "text") handle = handle.appendField(input.value);

            if (input.type == "dropdown")
              handle = handle.appendField(
                new Blockly.FieldDropdown(
                  maybe(input.value).take((value) =>
                    typeof value == "function"
                      ? () => coerceToEntries(value())
                      : coerceToEntries(value)
                  )
                ),
                input.key
              );

            if (input.type == "number")
              handle = handle.appendField(
                new Blockly.FieldNumber(input.value),
                input.key
              );

            if (input.type == "textbox")
              handle = handle.appendField(
                new Blockly.FieldTextInput(input.value),
                input.key
              );

            if (input.type == "variable")
              handle = handle.appendField(new Blockly.FieldVariable(null, undefined, input.varTypes, input.varTypes.at(0)), input.key)
          }
        };

        const registerField = (field: Field) => {
          if (field.type == "inputOnly") {
            const handle = this.appendDummyInput();
            registerContent(handle, field.content);
          }

          if (field.type == "slot") {
            const handle = this.appendValueInput(field.key).setCheck(
              maybe(field.check).takeUnless(it => it == "*") ?? null
            );
            registerContent(handle, field.content);
          }

          if (field.type == "stmt") {
            this.appendStatementInput(field.key).setCheck(
              maybe(field.check).takeUnless((it) => it == "*") ?? null
            );
          }
        };

        fields.forEach(registerField);
      },
    };

    // note: blockly block definitions don't play well with typescript for generic blockly generators,
    // so we have to manually cast to any here :((
    (generator as any).forBlock[this.name] = function (block: Blockly.Block) {
      const proxy = new Proxy(block, {
        get(target, p, _receiver) {
          for (const field of fields) {
            if (field.type != "stmt") {
              for (const input of field.content) {
                if (input.type != "text") {
                  if (input.key == p.toString())
                    return target.getFieldValue(p.toString());
                }
              }
            }
          }

          throw new Error("Failed to find input by key: " + p.toString());
        },
      }) as unknown as BlockInputMap;

      const result = builder({
        fields: proxy,
        resolve(key, order?: number) {
          if (fields.some((it) => it.type == "stmt" && it.key == key))
            return generator.statementToCode(block, key);

          if (fields.some((it) => it.type == "slot" && it.key == key))
            return generator.valueToCode(block, key, order ?? 99);

          throw new Error("failed to resolve: " + key);
        },
      });

      if (typeof result == "object") return [result.value, result.order];
      if (outputType != null) return [result, 99];

      const nextBlock = maybe(block.nextConnection)
        ?.let((it) => it.targetBlock())
        ?.let((it) => generator.blockToCode(it))
        .take();

      if (nextBlock) return [result, nextBlock].join("\n");
      return result;
    };

    for (const plugin of this.plugins) {
      plugin.blockDidRegister?.(this);
    }
  }
}

type CheckType<T extends string> = T extends BuiltinType ? true : false;
type TypeError<_ extends string> = { _err: never };

type Fn<P> = (p: P) => unknown;
export type IntersectUnion<Union> = (Union extends Union ? Fn<Union> : never) extends Fn<
  infer Intersection
>
  ? Intersection
  : never;

type InferMeta<Plugin extends BlockBuilderPlugin<object>> =
  IntersectUnion<Plugin extends BlockBuilderPlugin<infer Meta> ? Meta : never>;

export function createBlockBuilder<Type extends string = never, Plugin extends BlockBuilderPlugin<object> = BlockBuilderPlugin<object>>(config: {
  Blockly: BlocksRef,
  generator: any;
  customTypes?: Type[];
  plugins?: Plugin[],
}): CheckType<Type> extends false
  ? (blockName: string) => BlockBuilder<{}, "", Type, false, InferMeta<Plugin> & object>
  : TypeError<`'${Extract<
      Type,
      BuiltinType | WildcardType | NeverType
    >}' is a reserved type indicator and may not be used`> {
  return ((blockName: string) =>
    new BlockBuilder(blockName, config.generator, config.Blockly ?? Blockly, config.plugins ?? [])) as any;
}
