# deck creation

_this guide walks you through some of the basics of creating a deck for hsrs with the deck editor. if you haven't already, read about [elements](./overview.md#elements) first_

## the editor

though not strictly required, the editor is a graphical way of browsing and editing the elements in a deck. access it from the hsrs client by clicking the deck icon.

the editor interface is split into a series of columns, each representing an element, or list of elements.

### element lists

at the top of each list you have buttons for:

- `+` for adding a new element to the list.
- if you have an element(s) selected you'll also see
  - `trash` double click to delete the selected element(s)
  - `move` select another element to move your selection to
  - `duplicate` make a copy of the selected element(s)

### element editor

elements have the following parts:

- `name` the unique name of the element, for organization and referencing it elsewhere
- `O` the [order](./overview.md/#ordering) of the element
- `folder` if checked, the element won't be learnable as a card, rather it functions purely to organize other elements.
- `types` names of elements that this element belongs to. _there can be many more than one parent_
- `properties` the actual content of the element see [properties](./overview.md#data)
- `params` what other elements are used to construct the properties for this element
- `mode` the element's [mode string](./overview.md#modes)
- `example` this will generate a random [instance](./overview.md#sampling) of the element and display its computed properties. _elements without params only have one instance_
- if the element is a _folder_ you'll see an [element list](#element-lists) with all its children

at the very top you also have:

- `back arrow` closes the element and returns you to the left
- `stats` opens the stats browser for that element to show you learning info
- `search` search for an element by name and open it separately to the right

## example

as a change of pace we'll be setting up a toy example of some basic french vocab and grammar. the concepts covered here equally apply to other languages, and to things other than grammar and vocab.

### vocab setup

first make a new element with the `+` at the top of the root element list. let's name it `french`. hit enter to make the new element

you'll now get a fresh column opening to the right with our new `french` element. click the `folder` checkbox, since this will simply be an organizational container for our other elements.

now let's add some properties to the french element, to define the structure of what we'll be learning. under `properties` click the `+` then enter the name of the property you want to create and hit enter. let's make two properties:

- `fr`: the french content to be learned
- `en`: the english translation

leave them blank since we'll define exactly what those are for individual elements going forward. _adding these simply acts as a reminder when creating new elements under `french` what properties are required_

_now let's add some vocab!_

since we marked `french` as a folder it has its own [element list](#element-lists) labeled `children`. as before, to add a new element click the plus and enter a unique name. let's add an element called: `book`, and enter in its properties:

- `fr`: livre
- `en`: book

then, add a couple more elements under french in the same manner for `house - maison`, `bread - pain`, and `apple - pomme`. (the french among you may see where this is going.)

at this point, you can visit the learning page and you'll see that you have 8 new cards available to learn. (4 words \* 2 properties). (if you have other decks in there other than french, make sure to filter by `french`).

_for extra credit, do a session and learn them... 🇫🇷_

### trivial grammar: definite articles

as some background, all nouns in french are _gendered_ either masculine or feminine. this shows up in definite articles (the english equivalent being `the`), where a different article is used depending on the gender. _let's model this!_

first let's group our newly added vocab words by gender. to do this, make two folder elements under `french` called `masculine` and `feminine`. (don't forget to mark them as folders!). then go to french and select the masculine nouns (`book` and `bread`) with command-click, and press the `move-folder` icon at the top of the element list and type `masculine` and hit enter. _you may have to hit enter twice if it gives you an autocomplete_

another way to do this is by editing the `type` of each element individually

repeat the same process, moving the remaining verbs to `feminine`. with our nouns now categorized by gender, let's make our definite article elements!

now make a new element called `le-noun` (the masculine article). unlike our other elements, this will have have [parameters](./overview.md#data). create a parameter called `noun` and set its value to `masculine` (the folder we just created). now, whenever an instance of `le-noun` is created it will select a masculine noun at random that we can use in creating the properties for `le-noun`.

since we have properties defined we can use [jexl expressions](https://github.com/TomFrost/Jexl) to create new values from our parameters. in this case we simply want add 'le' to the noun. enter the properties as follows

- fr: `'le '+noun.fr`
- en: `'the '+noun.en`

now under example you can click the refresh button a few times and see it randomly switch between `le pain` and `le livre`.

at this point we can simply duplicate the process for the `la-noun`, changing le to la and the noun param from masculine to feminine.

### learning grammar cards

again if you like, you can go to the learn page and see what its like to learn them. if you haven't already learned the nouns from the previous section you won't get the article cards until you've learned nouns. the nouns also have to have a certain stability in order to be learned in grammar cards, _otherwise the grammar cards get much too difficult._ if you really want to see how they look being learned make sure to mark all the vocab words as good or easy, otherwise it may take a day or two for them to be sampled. _this is why the 'example' feature in the editor exists_

cards with parameters behave differently in that they have different parameters sampled each time you review them, and you review them much more frequently than an individual vocab card.
