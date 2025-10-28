# @hsrs/cli

_cli with various tools for working with hsrs decks and revlogs._

## installation

`npm i -g @hsrs/cli`

## commands

- `import <destDir> <srcDeck>` Import a deck from <srcDeck> (deck JSON) into directory structure at <destDir>
- `export <srcDir> <destDeck>` Export a deck from directory structure at <srcDir> to <destDeck> (deck JSON)
- `bench <historyPath> <deckPath> <outputPath>` Run hsrs benchmark on <historyPath> using <deckPath> saved to <outputPath.png>. `--shallow` to Only consider shallow elements.

## development

run `yarn dev <import|export|...>` to do a build then run
