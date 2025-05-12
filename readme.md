[start here](./docs/en-jp-quickstart.md) if you just want to use the Japanese deck

# HSRS

_a hierarchical spaced-repetition system for learning structurally related materials._

## hosted builds

- [hsrs web app](https://elldev.com/hsrs/): core ui for learning and deck browse / edit
- [tts plugin](https://elldev.com/hsrs-tts/): text-to-speech plugin for listening cards
- [grsly](https://grsly.com/): consumer implementation for en-jp

## motivation

japanese grammar, i know... though the concept generalizes well beyond japanese and grammar.

existing spaced-repetition tools work incredibly well for learning _atomic_ pieces of information. however, learning grammar _atomically_ either means memorizing descriptions of the grammar, or individual instances of its use.

hsrs is _non-atomic_, in that a single review may include many (deeply) nested concepts. applied to grammar, the result is you get a fresh example for every review, with its component parts tailored to your current knowledge.

read more about [how it works](./docs/overview.md)

## table of contents

- for learners
  - [en-jp quickstart](./docs/en-jp-quickstart.md)
  - [learning guide](./docs/learning.md)
- deck building
  - [editor](./docs/editor.md)
  - [deck creation](./docs/deck-creation.md)
- technical docs
  - [overview](./docs/overview.md)
  - [plugins](./docs/plugins.md)

## run locally

- requires node v18+, yarn 3.8.5+
- `yarn run dev`
- http://localhost:8177/: the main client
- http://localhost:8178/: the tts plugin
