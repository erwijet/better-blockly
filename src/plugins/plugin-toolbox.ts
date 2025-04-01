import { maybe } from "@tsly/maybe";
import { BlockBuilderPlugin } from "lib";
import { ToolboxDefinition } from "blockly/core/utils/toolbox";

type ToolboxPluginConfig<Category extends string> = {
    categories: Record<Category, { color: number | string }>
}

type ShadowConfig = Record<string, { blockType: string, fields: Record<string, any> }>

export function createToolboxPlugin<Category extends string>(config: ToolboxPluginConfig<Category>) {
    let store: Record<string, { category?: Category, shadow?: ShadowConfig  }>= {}

    return {
        buildToolbox(): ToolboxDefinition {
            return {
                contents: Object.keys(config.categories).map((category) => ({
                    kind: "category",
                    name: category,
                    colour: config.categories[category as Category].color,
                    contents: Object.keys(store)
                        .filter((key) => store[key]['category'] == category)
                        .map((key) => ({
                            kind: "block",
                            type: key,
                            inputs: Object.fromEntries(Object.entries(store[key].shadow ?? {}).map(([target, { blockType, fields }]) => [target, { shadow: { type: blockType, fields } }]))
                        }))
                }))
            }
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
