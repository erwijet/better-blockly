import { maybe } from "@tsly/maybe";
import { BlockBuilderPlugin } from "lib";
import { ToolboxDefinition, ToolboxItemInfo } from "blockly/core/utils/toolbox";

type ToolboxPluginConfig<Category extends string> = {
    categories: Record<Category, { color: number | string }>,
    contents?: ToolboxItemInfo[]
}

type ShadowConfig = Record<string, { blockType: string, fields: Record<string, any>, inputs?: ShadowConfig }>

export function createToolboxPlugin<Category extends string>(config: ToolboxPluginConfig<Category>) {
    let store: Record<string, { category?: Category, shadow?: ShadowConfig  }>= {}

    function toShadowToolboxConfig(conf: ShadowConfig): any {
        return Object.fromEntries(Object.entries(conf).map(([target, { blockType, fields, inputs }]) => [target, { shadow: { type: blockType, fields, inputs: toShadowToolboxConfig(inputs ?? {}) } }]))
    }

    return {
        buildToolbox(): ToolboxDefinition {
            return {
                contents: (Object.keys(config.categories).map((category) => ({
                    kind: "category",
                    name: category,
                    colour: config.categories[category as Category].color,
                    contents: Object.keys(store)
                        .filter((key) => store[key]['category'] == category)
                        .map((key) => ({
                            kind: "block",
                            type: key,
                            inputs: toShadowToolboxConfig(store[key].shadow ?? {})
                        }))
                })) as ToolboxItemInfo[]).concat(config.contents ?? [])
            };
        },

        register(): BlockBuilderPlugin<{ category: Category, shadow: ShadowConfig }> {
            return {
                name: "better-blockly/plugin-toolbox",
                blockWillRegister(block) {
                    maybe(block.getMeta().category)
                    ?.let(it => config.categories[it]?.color)
                    .take(it => block.color(it))
                },
                blockDidRegister: (block) => {
                    store = { ...store, [block['name']]: block.getMeta() } 
                }
            }
        }
    }
}
