[start here](./docs/user/en-jp-quickstart.md) if you just want to use the Japanese deck

# HSRS

a hierarchical spaced-repetition system for learning structurally related materials.

## run locally

- requires node v18+, yarn 3.8.5+
- `yarn run dev`
- http://localhost:8177/: the main client
- http://localhost:8178/: the tts plugin

## hosted builds

- [hsrs client](https://elldev.com/hsrs/): core ui for learning and deck browse / edit
- [tts plugin](https://elldev.com/hsrs-tts/): text-to-speech plugin for listening cards
- [grsly](https://grsly.com/): consumer implementation for en-jp

## usage

- [getting started](./docs/user/getting-started.md)
- [making cards](./docs/user/making-cards.md)
- [expressions](./docs/user/expressions.md)
- [plugins](./docs/user/plugins.md)

## documentation

- [introduction](./docs/dev/introduction.md)
- [the card graph](./docs/dev/card-graph.md)
- [card sampling](./docs/dev/sampling.md)
- [scheduling](./docs/dev/scheduling.md)
- [alias detection](./docs/dev/aliasing.md)
- [learning sessions](./docs/dev/sessions.md)
