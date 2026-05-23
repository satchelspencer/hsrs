# plugins

hsrs plugins allow custom ways of viewing/interacting with card content. officially supported plugins live in [packages/plugins/](../packages/plugins/):

- [tts](../packages/plugins/tts/) text-to-speech for listening cards
- [glyph](../packages/plugins/glyph/) practice for writing characters

this guide can help you write your own! plugins **could be used** for things like:

- typing responses with auto-grading
- multiple choice cards
- displaying media like images/video
- horrific gamification

### overview

plugins are simply web pages that get embedded inside the hsrs client and pass messages back and forth. you can use the framework agnostic package [hsrs-plugin](../packages/plugins/core/) to handle the finer details and get some nice typings (also available on npm as `hsrs-plugin`).

as of now, plugins are limited only to managing the display and interaction with a card, and don't support changing card scheduling, or user settings, or ui outside of learning. they also don't currently support overriding the grading/reveal ui but i'm open to this possibility.

### example

```typescript
import { hsrsPlugin, CardState } from 'hsrs-plugin'

const plugin = hsrsPlugin(
  { allowedOrigins: ['https://example.com'] }, //optional, if not-cross origin
  (state: CardState) => {
    console.log('Received state:', state)
    // update your UI...
  }
)

// mark an element as an active area to clip tap shortcuts
const cleanupArea = plugin.setActiveArea(someElement)
cleanupArea() // remove the active area watch

// later, if you need to clean up
plugin.destroy()
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

check [the types](../packages/plugins/core/src/types.ts) for more detail

### plugin matching

plugins are matched to cards by ancestor element name. plugin keys support wildcards i.e `*-glyphs`. exact matches take priority over wildcards, and close ancestors take priority over distant ones.
