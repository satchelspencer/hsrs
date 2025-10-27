import { Command } from 'commander'

import { importDir } from './deck/import'
import { exportFromDir } from './deck/export'

const program = new Command()
program.name('hsrs').description('HSRS cli')

program
  .command('import <destDir> <srcDeck>')
  .description(
    'Import a deck from <srcDeck> (deck JSON) into directory structure at <destDir>'
  )
  .action((destPath, srcPath) => importDir(destPath, srcPath))

program
  .command('export <srcDir> <destDeck>')
  .description(
    'Export a deck from directory structure at <srcDir> to <destDeck> (deck JSON) '
  )
  .action((srcDir, destDeck) => exportFromDir(srcDir, destDeck))

program.parseAsync(process.argv).catch((e) => {
  console.error(e?.stack || e)
  process.exit(1)
})
