import fs from 'fs'
import Purgecss from 'purgecss'
import { ConcatSource } from 'webpack-sources'
import * as parse from './parse'
import * as search from './search'

export default class PurgecssPlugin {
  constructor(options) {
    this.options = options
  }

  apply(compiler) {
    compiler.plugin('this-compilation', compilation => {
      const entryPaths = parse.entryPaths(this.options.paths)

      parse.flatten(entryPaths).forEach(p => {
        if (!fs.existsSync(p)) throw new Error(`Path ${p} does not exist.`)
      })

      compilation.plugin('additional-assets', cb => {
        const assetsFromCompilation = search.assets(compilation.assets, [
          '.css'
        ])
        // Go through chunks and purge as configured
        compilation.chunks.forEach(chunk => {
          const { name: chunkName, files } = chunk
          const assetsToPurge = assetsFromCompilation.filter(asset => {
            if (this.options.only) {
              return []
                .concat(this.options.only)
                .some(only => asset.name.indexOf(only) >= 0)
            } else {
              return files.indexOf(asset.name) >= 0
            }
          })

          assetsToPurge.forEach(({ name, asset }) => {
            const filesToSearch = parse
              .entries(entryPaths, chunkName)
              .concat(
                search.files(
                  chunk,
                  this.options.moduleExtensions || [],
                  file => file.resource
                )
              )
              .filter(v => !v.endsWith('.css'))

            // Compile through Purgecss and attach to output.
            // This loses sourcemaps should there be any!
            const purgecss = new Purgecss({
              ...this.options,
              content: filesToSearch,
              css: [asset.source()],
              stdin: true
            })
            compilation.assets[name] = new ConcatSource(purgecss.purge()[0].css)
          })
        })

        cb()
      })
    })
  }
}
