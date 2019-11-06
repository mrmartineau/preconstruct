import path from "path";
import { FatalError } from "../../errors";
import { Plugin, OutputChunk, OutputAsset } from "rollup";
import { Package } from "../../package";
import { createDeclarationCreator } from "./create-generator";
import { tsTemplate } from "../../utils";

let isTsPath = (source: string) => /\.tsx?/.test(source);

export default function typescriptDeclarations(pkg: Package): Plugin {
  if (!pkg.entrypoints.some(({ source }) => isTsPath(source))) {
    return { name: "typescript-declarations" };
  }
  return {
    name: "typescript-declarations",

    // eslint-disable-next-line no-unused-vars
    async generateBundle(opts, bundle, something) {
      let creator = await createDeclarationCreator(pkg.directory);

      let srcFilenameToDtsFilenameMap = new Map<string, string>();

      let deps = creator.getDeps(pkg.entrypoints.map(x => x.source));
      await Promise.all(
        [...deps].map(async dep => {
          let { name, content } = await creator.getDeclarationFile(dep);
          srcFilenameToDtsFilenameMap.set(dep, name);
          this.emitFile({
            type: "asset",
            fileName: path.relative(opts.dir!, name),
            source: content
          });
        })
      );

      for (const n in bundle) {
        const _file = bundle[n];
        const facadeModuleId = (_file as OutputChunk).facadeModuleId;
        if (
          (_file as OutputAsset).isAsset ||
          !(_file as OutputChunk).isEntry ||
          facadeModuleId == null
        ) {
          continue;
        }

        let file = _file as OutputChunk;

        let dtsFilename = srcFilenameToDtsFilenameMap.get(facadeModuleId);

        if (!dtsFilename) {
          throw new FatalError(
            `no .d.ts file was found for the entrypoint at ${facadeModuleId}`,
            pkg.name
          );
        }

        let mainFieldPath = file.fileName.replace(/\.prod\.js$/, "");
        let relativeToSource = path.relative(
          path.dirname(path.join(opts.dir!, file.fileName)),
          dtsFilename.replace(/\.d\.ts$/, "")
        );
        if (!relativeToSource.startsWith(".")) {
          relativeToSource = `./${relativeToSource}`;
        }
        let tsFileSource = tsTemplate(
          file.exports.includes("default"),
          relativeToSource
        );
        let tsFileName = mainFieldPath + ".d.ts";
        this.emitFile({
          type: "asset",
          fileName: tsFileName,
          source: tsFileSource
        });
      }
    }
  };
}