# technical overview

- [scheduling](#scheduling)
  - [memory updates](#memory-updates)
  - [optimization](#optimization)
- [learning](#learning)
  - [sessions](#sessions)
  - [daily goals](#daily-goals)
- [elements](#elements)
  - [categorization](#categorization)
  - [data](#data)
  - [constraints](#constraints)
  - [modes](#modes)
  - [ordering](#ordering)
  - [inheritance](#inheritance)
- [card creation](#card-creation)
  - [sampling](#sampling)
  - [aliasing](#aliasing)

## scheduling

_this assumes you're already somewhat familiar with [fsrs](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm), as for now it's used as a primitive in the scheduling process._

### memory updates

unlike typical spaced-repetition systems, an individual review contains a deep tree of elements and their parameter values that need to be scheduled individually. during learning one _could_ ask the user for a grade on each element in the tree, but this would be slow to use, and difficult to decide. to get around this, _hsrs uses one grade for the whole tree_. if the grade is passing, then we can safely assume that all the elements were known and schedule them (mostly) normally with fsrs. however, in the case of failure, we can't make the same assumption since the lapse _may_ have been caused by a single element.

thankfully fsrs already gives us a probability of recall at any given time for each card, so we compute the likelihood that each element was the cause the failure given its current memory state with [bayes theorem](https://en.wikipedia.org/wiki/Bayes%27_theorem). given this probability, we can then reschedule the element with a _probabilistic_ version of fsrs that takes in both a grade and a likelihood when estimating a new memory state.

to arrive at a probabilistic memory state, we first compute the new memory state with fsrs as normal. then, we non-linearly interpolate the new stability in _retrievability space_ to arrive at a final memory state.

without individual grades these partial probabilities are always an estimation, so as a ground truth we need to ensure that leaf elements are also reviewed individually. this means we need to bias the scheduler's _dates_ to avoid incorrect failure estimations never being updated by an individual review.

to this end, hsrs maintains two dates for each element, a _last seen_ and a _base date_ used for computing due dates. instead of being set to the current time each review, the base date is interpolated between itself and the current time linearly according to the probability.

**so we have a tradeoff**: the convenience of only having one grade for complex cards means accepting extra reviews of individual elements

### optimization

fsrs optimization _does work_ with hsrs so long as you only include leaf reviews. however, it fails to converge well when including concurrent reviews, as it wasn't designed with this in mind. given this, and the fact that hsrs includes many optimizable parameters itself, an hsrs-specific optimizer would provide even more benefit.

# learning

### sessions

hsrs breaks down daily reviews into fixed size sessions. this has a number of benefits:

- complex cards can be reviewed multiple times in the same day (with different parameters)
- since cards are deeply nested, grades from one session can have meaningful influence the scheduling of other cards due on the same day
- arguably better user experience, if duo does one thing well it may be this :|

when creating a session, we simply draw from the elements in order of due date and attempt to [sample](#sampling) and add them to the _session stack_ until the session meets the desired size. when we exhaust elements currently due, we select cards as follows:

1.  if learning is enabled, we add new cards according to their [order](#ordering). (new cards contribute more to the session size than reviews)
2.  draw from recent lapses in reverse order. this has little effect on scheduling but works well to space out new cards.
3.  draw from cards due in the future. to reduce scheduling impact these are handled [probabilistically](#scheduling) like child cards.

finally, we shuffle the review cards, and distribute any new cards from the top down with fibonacci spacing. this evens out the proportion of new/review cards as the new cards are reviewed multiple times while learning them.

during a learning session, each card has its own session-specific learning state. when the stability of a card reaches 1, the card is considered graduated from the session. the session finishes when all cards are graduated. the learning loop is:

- show the learner the card at the top of the stack
- based on the grade, determine the cards new stability
  - if graduated, push the card to a random location near the bottom of the stack
  - otherwise re-insert near the top of the stack proportionately to its stability
- re-estimate the total length of the session. if it exceeds the target, remove unseen new cards to reduce workload. conversely, if the length of the session is below expectation more new cards can be added. _this allows the number of new cards to adjust based on how difficult they are for the learner_

after a lapse, or when learning, the spacing between repeated reviews will increase after each success, and decrease after each failure. then, because graduation can only occur after a certain review spacing, we avoid the problem of a few stragglers being repeated in quick succession at the end of a session, negating learning.

_this does mean re-reviewing cards from earlier if a lapse occurs at the end of a session, but proper new card distribution helps avoid this too much_

### daily goals

since sessions are of a relatively small fixed size, they won't usually bring a user up to date with their reviews in one shot. hsrs computes a separate daily goal with a few purposes:

- rather than in fixed quantities, new cards are only added once the daily goal is met. this, and dynamically changing the number of new cards mid-session, naturally regulates the 'learning rate'
- if a user has a backlog, rather than making them all due up to a fixed limit, hsrs uses the backlog size and future review counts to estimate a daily goal that will work through the backlog in roughly the same number of days that were skipped.

## elements

hsrs needs a robust way of defining the structure of your content so that meaningful and valid card instances can be created for each review. this requires:

- flexible categorization
- fields for data
- parameterization

this is done with a directed acyclic graph of _elements_, named (poorly) to differentiate from the cards users interact with directly.

### categorization

each element has a list of `parents` referred to as `types` in the editor. they are other elements that this element "belongs to". `cat` might belong to `nouns, living things`

### data

each element has a set of _props_ where data intrinsic to the element is defined. props are typically the information to be learned by the user. each prop is scheduled separately and acts its own sibling card.

elements also have _params_ which are references to other elements used in creating the final value for the props. for a simple grammar element representing `[noun] is [adjective].` you'd have two params. parameters can represent categories of elements: `adjective`, or even other other parameterized elements like `[adverb] [adjective]`.

given a set of parameters, elements need a way to build their final property values based on their parameters. for basic computation hsrs uses [jexl](https://github.com/TomFrost/Jexl), which handles string manipulation and parameter value accessing: `noun.en+' is '+adjective.en`

### constraints

in the context of language learning, we often need ways during [sampling](#sampling) to restrict parameters across multiple sibling elements for the final output to still make sense.

a common example is preserving a specific parameter by name across multiple elements. let's say we have the following elements:

- _noun-adjective-statement_ `'the '+noun+' is '+adjective`
- _noun-and-adjective_ `statementA+' and '+statementB.adjective`

without constraints, if we choose parameters at random when sampling _noun-and-adjective_ we could end up with two sentences with incompatible nouns. for example, `the cat is hungry` and `the weather is windy` would become `the cat is hungry and windy`

however, if we specify `noun` as a constraint on _noun-and-adjective_, when sampling it will always arrive at two instances of _noun-adjective-statement_ with the same _noun_ parameter, guaranteeing a valid result.

to allow more complex constructions, _constraints are shallow_. they are only enforced one level deep in the parameter tree, but you can pass them down explicitly at each level if needed. global constraints are often better handled by [modes](#modes)

constraints are especially useful when using the [relationship elements](./deck-creation.md#relationship-pattern) pattern.

### modes

modes are a secondary method for enforcing consistency when sampling deep element parameter trees. in language learning they are essential for enforcing statement-wide context like politeness, gender, spoken/written forms etc.

modes are defined somewhat like unix permissions where the user can define an arbitrary set of modes and their possible values. for example you could use the pattern `gender=m,f|politeness=p,i` like `mp`, `fp`, `mi`...etc. when a card is sampled, it will never contain any elements with conflicting modes.

usually cards don't explicitly have all modes. you can use the `-` char as a placeholder: `-i` would be gender neutral but impolite, the gender may be 'decided' by another element in the tree. if you want to explicitly 'unset' a mode you can override a parameters mode using a `*`.

### ordering

hsrs uses lexical ordering categories like `1.1` or `3.1.2` for deciding when new cards are introduced to a learner. new cards with the same order value will be introduced in a random order.

### inheritance

elements inherit data from their parents that will be used as the default if they're not defined on the element itself. this applies to properties, parameters, modes, constraints, and order. since elements may have multiple parents, they are merged in the order that the parents are listed on the element.

## card creation

### sampling

when learning, we need to create specific instances of elements as cards to test a user's knowledge through a process called sampling. at it's simplest, sampling is starting at a root element, then searching deeply through possible values of its parameters and repeating the sampling process for each of them.

when sampling, [constraints](#constraints) are built and enforced to maintain consistency within a particular card. this means many possible parameters for any given element are often discarded.

the _search order_ largely determines what parameters will be sampled at any given moment. it is determined by:

- **retrievability diff**: each element has its own 'desired retention' target for its parameters. more deeply complex elements will prefer easier parameters. see [scheduling](#scheduling)
- **parameter-space size**: prefer elements that have many possible parameter values, so widely-applicable patterns are studied more often than obscure ones.
- **recency**: avoid elements seen too recently if possible.

### aliasing

a key issue in spaced-repetition for language learning is words with multiple meanings, sounds with multiple words, etc. displaying these helps with ambiguity for the learner. in a flat list of words, finding aliases is trivial, just search for matching properties. however, this is extremely challenging in the context of grammar.

take this oddly-specific japanese example to illustrate the difficulty, where the parameters of two aliases may not share many commonalities yet their combination is identical. say you hear "うちにいった". it could be:

- うち(me, often female)・に(to)・言った(いった from 言う) = "said to me"
- 家(うち home)・に(to)・行った(いった from 行く) = "went home"

exhaustive searches in the parameter space are totally infeasible for all but the smallest decks. hsrs has an imperfect but generally effective approach:

- create a list of matching elements (initially empty)
- search through all elements that share some substring with the target:
  - if below some lcs threshold discard it
  - attempt sample it a limited number of times (drawing only from the matching elements list)
  - if it fails to be sampled with matching elements discard it
  - if it matches exactly add it to the results
  - if it is a close match add its sampled instance to a list of possible children
- repeat the search up to some maximum depth

this doesn't catch 100% of aliases, but is comparatively quick with careful caching and can scale based on available resources as a best-effort approach.
