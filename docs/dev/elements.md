# elements

hsrs needs on a robust way of defining the structure of your content so that meaningful and valid card instances can be created for each review. this requires:

- _flexible categorization_
- _fields for data_
- _parameterization_

this is done with a directed acyclic graph of _elements_, named (poorly) to differentiate from the cards users interact with directly.

## categorization

each element has a list of `parents` referred to as `types` in the editor. they are other elements that this element "belongs to". `cat` might belong to `nouns, living things`

## data

each element has a set of _props_ where data intrinsic to the element is defined. props are typically the information to be learned by the user.

elements also have _params_ which are references to other elements used in creating the final value for the props. for a simple grammar element representing `[noun] is [adjective].` you'd have two params. parameters can represent categories of elements: `adjective`, or even other parameterized elements like `[adverb] [adjective]`.

given a set of parameters, elements need a way to build their final property values based of their parameters. for basic computation hsrs uses [jexl](https://github.com/TomFrost/Jexl), which handles basic string manipulation and parameter value accessing: `noun.en+' is '+adjective.en` 

# sampling

when learning, we need to create specific instances of elements through sampling.
