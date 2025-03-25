import {
  Join,
  Content,
  InputMap,
  Manufacturable,
  DropdownOptionDef,
} from "./shared";

export type CustomView = (
  this: ContentBuilder<any>,
  key: string
) => ContentBuilder<any>;

export function createCustomContentView(
  view: (opts: { key: string; builder: ContentBuilder<any> }) => unknown
): CustomView {
  return function (this: ContentBuilder<any>, key: string) {
    view({ key, builder: this });
    return this;
  };
}

export class ContentBuilder<T extends InputMap> {
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
    func: (this: ContentBuilder<T>, key: string) => unknown
  ): ContentBuilder<Join<T, { [_ in K]: V }>> {
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

    return this as ContentBuilder<Join<T, { [_ in K]: V }>>;
  }

  number<K extends string>(key: K, value: number) {
    this.pushContent({
      key,
      type: "number",
      value,
    });

    return this as ContentBuilder<Join<T, { [_ in K]: number }>>;
  }

  textbox<K extends string>(key: K, value: string) {
    this.pushContent({
      key,
      type: "textbox",
      value,
    });

    return this as ContentBuilder<Join<T, { [_ in K]: string }>>;
  }
}

export type ContentBuilderFn<
  PrevFieldMap extends InputMap,
  NextFieldMap extends InputMap,
> = (view: ContentBuilder<PrevFieldMap>) => ContentBuilder<NextFieldMap>;
