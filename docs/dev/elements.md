## elements

hsrs needs on a robust way of defining the structure of your content so that meaningful and valid card instances can be created for each review. this requires:

- flexible categorization
- fields for data
- parameterization

this is done with a directed acyclic graph of _elements_, named (poorly) to differentiate from the cards users interact with directly.

### categorization

each element has a list of `parents` referred to as `types` in the editor. they are other elements that this element "belongs to". `cat` might belong to `nouns, living things`

### data

each element has a set of _props_ where data intrinsic to the element is defined. props are typically the information to be learned by the user.

elements also have _params_ which are references to other elements used in creating the final value for the props. for a simple grammar element representing `[noun] is [adjective].` you'd have two params. parameters can represent categories of elements: `adjective`, or even other other parameterized elements like `[adverb] [adjective]`.

given a set of parameters, elements need a way to build their final property values based of their parameters. for basic computation hsrs uses [jexl](https://github.com/TomFrost/Jexl), which handles basic string manipulation and parameter value accessing: `noun.en+' is '+adjective.en`

### constraints

in the context of language learning, we often need ways during [sampling](#sampling) to restrict parameters across multiple sibling elements for the final output to still make sense.

a common example is preserving a specific parameter by name across multiple elements. lets say we have the following elements:

- _noun-adjective-statement_ `'the '+noun+' is '+adjective`
- _noun-and-adjective_ `statementA+' and '+statementB.adjective`

without constraints, if we choose parameters at random when sampling _noun-and-adjective_ we could end up with two sentences with incompatible nouns. for example, `the cat is hungry` and `the weather is windy` would become `the cat is hungry and windy`

however, if we specify `noun` as a constraint on _noun-and-adjective_, when sampling it will always arrive at two instances of _noun-adjective-statement_ with the same _noun_ parameter, guaranteeing a valid result.

to allow more complex constructions, _constraints are shallow_. they are only enforced one level deep in the parameter tree, but you can pass them down explicitly at each level if needed. global constraints are often better handled by [modes](#modes)

constraints are especially useful when using the [relationship elements]() pattern.

### modes

modes are a secondary method for enforcing consistency when sampling deep element parameter trees. in language learning they are essential for enforcing statement-wide context like politeness, gender, spoken/written forms etc.

modes are defined somewhat like unix permissions where the user can define an arbitrary set of modes and their possible values. for example you could use the pattern `gender=m,f|politeness=p,i` like `mp`, `fp`, `mi`...etc. when a card is sampled, it will never contain any elements with conflicting modes.

usually cards don't explicitly have all modes. you can use the `-` char as a placeholder: `-i` would be gender neutral but impolite, the gender may be 'decided' by another element in the tree. if you want to explicitly 'unset' a mode you can override a parameters mode using a `*`.

### ordering

hsrs uses lexical ordering categories like `1.1` or `3.1.2` for deciding when new cards are introduced to a learner. new cards with the same order value will be introduced in a random order.

### inheritance

elements inherit data from their parents that will be used as the default if they're not defined on the element itself. this applies to properties, parameters, modes, constraints, and order. since elements may have multiple parents, they are merged in the order that the parents are listed on the element.

## sampling

when learning, we need to create specific instances of elements as cards to test a users knowledge through a process called sampling. at its simplest, sampling is starting at a root element, then searching deeply through possible values of its parameters and repeating the sampling process for each of them.

when sampling, [constraints](#constraints) are built and enforced to maintain consistency within a particular card. this means many possible parameters for any given element are often discarded.

the _search order_ largely determines what parameters will be sampled at any given moment. it is determined by:

- **retrievability diff**: each element has its own 'desired retention' target for its parameters. more deeply complex elements will prefer easier parameters. see [scheduling](#scheduling)
- **parameter-space size**: prefer elements that have many possible parameter values, so widely-applicable patterns are studied more often than obscure ones.
- **recency**: avoid elements seen too recently if possible.

## scheduling

*this assumes you're already somewhat familiar with [fsrs](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm), as it's used as a primitive in the scheduling process.*

unlike typical spaced-repetition systems, an individual review contains a deep tree of elements and their parameter values that need to be scheduled individually. during learning one *could* ask the user for a grade on each element in the tree, but this would be slow to use, and difficult to decide. to get around this, *hsrs uses one grade for the whole tree*. if the grade is passing, then we can safely assume that all the elements were known and schedule them normally with fsrs. however in the case of failure, we can't make the same assumption since the lapse *may* have been caused by a single element.

to handle this, we compute the likelihood that each each element was the cause the failure given its current memory state with [bayes theorem](https://en.wikipedia.org/wiki/Bayes%27_theorem). given this probability, we can then reschedule the element with a *probabilistic* version of fsrs that takes in both a grade and a likelihood when estimating a new memory state.

to arrive at a probabilistic memory state, we first compute the a memory state given the grade with fsrs as normal. then, we non-linearly interpolate the new stability in *retrievability space* to arrive at a final memory state. 

without individual grades these partial probabilities are always an estimation, so as a ground truth we need to ensure that leaf elements are also reviewed individually. this means we need to bias the scheduler's *dates* to avoid incorrect failure estimations never being corrected by an individual review. 

to this end, hsrs maintains two dates for each element, a *last seen* and a *base date* used for computing due dates. instead of being set to the current time each review, the base date is interpolated between itself and the current time linearly according to the probability.

so we have a tradeoff: *the convenience of only having one grade for complex cards means accepting extra reviews of individual elements*

## learning
 