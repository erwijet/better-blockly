import { BlockBuilderPlugin } from "lib";
import { BlockSvg } from "blockly/core";

type ValidationPluginMeta = {
    "validate": ValidationFn
}
type ValidationFn = (opts: { warn: WarnFn, self: BlockSvg }) => void;
type WarnFn = (warning: string) => void;

export function createValidationPlugin() {
    return {
        register(): BlockBuilderPlugin<ValidationPluginMeta> {
            return {
                name: "better-blockly/plugin-validation",
                blockWillRegister(block, { _setBlocklyDefinitionProperty, _getBlocklyDefinitionProperty }) {
                    const validator = block.getMeta()['validate'];
                    if (!validator) return;

                    const _super = _getBlocklyDefinitionProperty('onchange');

                    _setBlocklyDefinitionProperty('onchange', function(this: BlockSvg, e: any) {
                        if (typeof _super == "function") _super.call(this, e);
                        if (!this.workspace || this.workspace.isDragging()) return;

                        // i know it's weird, but trust me calling `this.setWarningText` inside the `warn` method breaks it
                        let warningText = null;
                        validator({ self: this, warn: (msg) => {
                            warningText = msg;
                        }})

                        this.setWarningText(warningText);
                    })
                }
            }
        }
    }
}
