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
  compose,
  BlocksRef,
} from "./shared";
import { ContentBuilder, ContentBuilderFn } from "./ContentBuilder";
import { arr } from "@tsly/arr";

export class BlockBuilder<
  BlockInputMap extends InputMap,
  SlotKey extends string,
  Type extends string,
  IsExpr extends boolean,
> {
  #prevType: Type | WildcardType | null;
  #nextType: Type | WildcardType | null;
  #outputType: Type | BuiltinType | null;
  #inline: boolean | null;

  #hue: number;
  #fields: Field[];

  constructor(
    private name: string,
    private generator: Blockly.Generator,
    private blocksRef: BlocksRef
  ) {
    this.#hue = 120;
    this.#nextType = "*";
    this.#prevType = "*";
    this.#outputType = null;
    this.#fields = [];
    this.#inline = null;
  }

  follows(type: Type | WildcardType | NeverType) {
    if (type == "none") this.#prevType = null;
    else this.#prevType = type;

    return this;
  }

  preceeds(type: Type | WildcardType | NeverType) {
    if (type == "none") this.#nextType = null;
    else this.#nextType = type;

    return this;
  }

  hue(hue: number) {
    this.#hue = hue;
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
  ): BlockBuilder<BlockInputMap, SlotKey, Type, true> {
    this.#outputType = type;
    this.#nextType = null;
    this.#prevType = null;
    return this as BlockBuilder<BlockInputMap, SlotKey, Type, true>;
  }

  content<NextInputMap extends InputMap>(
    builderFn: ContentBuilderFn<BlockInputMap, NextInputMap>
  ) {
    const field: Field = {
      type: "inputOnly",
      content: [],
    };

    builderFn(new ContentBuilder((content) => field.content.push(content)));

    this.#fields.push(field);

    return this as unknown as BlockBuilder<NextInputMap, SlotKey, Type, IsExpr>;
  }

  slot<K extends string, NextInputMap extends InputMap = BlockInputMap>(
    key: K,
    def: {
      allow: Type | BuiltinType | WildcardType;
      content: ContentBuilderFn<BlockInputMap, NextInputMap>;
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
      IsExpr
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

    return this as BlockBuilder<BlockInputMap, SlotKey | K, Type, IsExpr>;
  }

  impl(
    builder: (
      block: BlockImpl<BlockInputMap, SlotKey>
    ) => IsExpr extends true
      ? string | { value: string; order: number }
      : string
  ): void {
    const fields = this.#fields,
      hue = this.#hue,
      nextType = this.#nextType,
      prevType = this.#prevType,
      outputType = this.#outputType,
      inline = this.#inline,
      generator = this.generator;

    this.blocksRef.Blocks[this.name] = {
      init: function () {
        this.setColour(hue);
        this.setTooltip("");
        this.setHelpUrl("");

        maybe(nextType)?.take((it) => {
          this.setNextStatement(true, it == "*" ? null : it);
        });

        maybe(prevType)?.take((it) =>
          this.setPreviousStatement(true, it == "*" ? null : it)
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
  }
}

type CheckType<T extends string> = T extends BuiltinType ? true : false;
type TypeError<_ extends string> = { _err: never };

export function createBlockBuilder<Type extends string = never>(config: {
  Blockly: BlocksRef,
  generator: any;
  customTypes?: Type[];
}): CheckType<Type> extends false
  ? (blockName: string) => BlockBuilder<{}, "", Type, false>
  : TypeError<`'${Extract<
      Type,
      BuiltinType | WildcardType | NeverType
    >}' is a reserved type indicator and may not be used`> {
  return ((blockName: string) =>
    new BlockBuilder(blockName, config.generator, config.Blockly ?? Blockly)) as any;
}
