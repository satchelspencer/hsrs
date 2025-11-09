# elements

the basic structure of elements is defined in the [overview](./overview.md#elements)

## advanced

### special props

sometimes you need to store information on a card that you don't want to be learned directly by a user. properties prefixed with `_` won't be scheduled or displayed to the learner, but can still be accessed inside of expressions. for example, this can be useful for storing multiple forms of a word in a single element like `en=I` and `_objectForm=me` then using the correct prop depending on the context.

other times you might want to exclude a prop from learning for certain cards, but have it otherwise appear as normal. you can do this by including the prop name in the `nolearn` setting.

### parameter mapping

in complex cases, you can explicitly evade constraints by renaming parameters for a subtree of an element. you can do this with the `map` setting using the syntax `paramName.subparamName=newSubparamName`.

### non-learnable elements

you can make an entire element non-learnable by prefixing its id with `$`. these elements can still be used by other elements as normal but none of their params will get exposed as cards directly. this is useful for shared constructs that multiple cards depend on but don't make sense to be learned by themselves.

### special params

parameters normally increase the depth heuristic for a given element, but you can exclude params from counting in the element depth by prefixing them with an `_`. this lets you add special params for constraint purposes without artificially increasing the depth and impacting scheduling.
