import { arr } from "@tsly/arr";
import { Join, Content, InputMap } from "./shared";

export class ContentBuilder<T extends InputMap> {
  constructor(private pushContent: (content: Content) => void) {}

  text(value: string) {
    this.pushContent({
      type: "text",
      value,
    });

    return this;
  }

  dropdown<K extends string, const V extends string>(
    key: K,
    options: { [_ in string]?: V } | V[]
  ) {
    this.pushContent({
      key,
      type: "dropdown",
      value: Array.isArray(options)
        ? arr(options)
            .toObj((k) => k)
            .take()
        : options,
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
