# plugins

hsrs plugins allow custom ways of viewing/interacting with card content. currently only [text to speech](../packages/tts/) is actively maintained, but this guide can help you write your own! plugins **could be used** for things like:

- typing responses with auto-grading
- multiple choice cards
- learning kanji by practicing drawing them
- displaying media like images/video
- horrific gamification

### overview

plugins are simply web pages that get embedded inside the hsrs client and pass messages back and forth. you can use the framework agnostic package [hsrs-plugin](#https://github.com/satchelspencer/hsrs-plugin) to handle the finer details and get some nice typings.

as of now they are limited only to managing the display and interaction with a card, and don't support changing card scheduling, or user settings, or ui outside of learning. they also don't currently support overriding the grading/reveal ui but i'm open to this possibility.

### example

```typescript
import { hsrsPlugin, CardState } from 'hsrs-plugin'

const destroy = hsrsPlugin(
  { allowedOrigins: ['https://example.com'] }, //optional, if not-cross origin
  (state: CardState) => {
    console.log('Received state:', state)
    // update your UI...
  }
)

// later, if you need to clean up
destroy()
```

the state callback receives a `CardState` with the following props:

- `id` the card id, so you can know when a new card is shown
- `revealed` whether or not the current card has been revealed by the user
- `property` the name of the property being shown on the 'front side'
- `value` the computed [properties](./overview.md#data) of the card i.e `{en: 'cat', jp: '猫'}`
- `next?` optionally the properties of the next card to be shown (useful for preloading)
- `aliases` a list of matching card [aliases](./overview.md#aliasing)
- `vars` variables set by the user in their settings, useful for plugin config options
- `mode` the computed [mode](./overview.md#modes) of the card

check [the types](https://github.com/satchelspencer/hsrs-plugin/blob/main/src/types.ts) for more detail
