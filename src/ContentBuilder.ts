import {
  Join,
  Content,
  InputMap,
  Manufacturable,
  DropdownOptionDef,
} from "./shared";

export type CustomView = (
  this: ContentBuilder<any, string>,
  key: string
) => ContentBuilder<any, string>;

export function createCustomContentView(
  view: (opts: { key: string; builder: ContentBuilder<any, string> }) => unknown
): CustomView {
  return function (this: ContentBuilder<any, string>, key: string) {
    view({ key, builder: this });
    return this;
  };
}

export class ContentBuilder<T extends InputMap, Type extends string> {
  constructor(private pushContent: (content: Content) => void) {}

  text(value: string) {
    this.pushContent({
      type: "text",
      value,
    });

    return this;
  }

  custom<K extends string, const V extends string>(
    key: K,
    func: (this: ContentBuilder<T, Type>, key: string) => unknown
  ): ContentBuilder<Join<T, { [_ in K]: V }>, Type> {
    func.bind(this)(key);
    return this;
  }

  dropdown<K extends string, const V extends string>(
    key: K,
    options: Manufacturable<DropdownOptionDef<V>>
  ) {
    this.pushContent({
      key,
      type: "dropdown",
      value: options,
    });

    return this as ContentBuilder<Join<T, { [_ in K]: V }>, Type>;
  }

  variable<K extends string>(key: K, opts: { types: Type[] }) {
    this.pushContent({
      key,
      type: 'variable',
      varTypes: opts.types
    });
    return this as ContentBuilder<Join<T, { [_ in K]: string }>, Type>
  }

  number<K extends string>(key: K, value: number) {
    this.pushContent({
      key,
      type: "number",
      value,
    });

    return this as ContentBuilder<Join<T, { [_ in K]: number }>, Type>;
  }

  textbox<K extends string>(key: K, value: string) {
    this.pushContent({
      key,
      type: "textbox",
      value,
    });

    return this as ContentBuilder<Join<T, { [_ in K]: string }>, Type>;
  }
}

export type ContentBuilderFn<
  PrevFieldMap extends InputMap,
  NextFieldMap extends InputMap,
  Type extends string
> = (view: ContentBuilder<PrevFieldMap, Type>) => ContentBuilder<NextFieldMap, Type>;
