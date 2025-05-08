# deck creation

_this guide walks you through some of the basics of creating a deck for hsrs with the deck editor. if you haven't already, read about [elements](./overview.md#elements), and [the editor](./editor.md) first._

as a change of pace we'll be setting up a toy example of some basic french vocab and grammar. the concepts covered here equally apply to other languages, and to things other than grammar and vocab. you can find the final result [here](./french-example.json)

_before we start, I want personally apologize for the inherent complexity in human languages._

## vocab setup

first make a new element with the `+` at the top of the root element list. let's name it `french`. hit enter to make the new element

you'll now get a fresh column opening to the right with our new `french` element, it will act as the container for our deck.

now let's add some properties to the french element, to define the structure of what we'll be learning. under `properties` click the `+` then enter the name of the property you want to create and hit enter. let's make two properties:

- `fr`: the french content to be learned
- `en`: the english translation

here we leave them blank since we'll define exactly what those are for individual elements later. _adding these simply acts as a reminder when creating new elements under `french` what properties are required_

_now let's add some vocab!_

since we marked `french` as a folder it has its own [element list](#element-lists) labeled `children`. as before, to add a new element click the plus and enter a unique name. let's add an element called: `pen`, and enter in its properties:

- `fr`: stylo
- `en`: pen

then, add a couple more elements under french in the same manner for `boy - garçon`, `window - fenêtre`, and `woman - femme`. (french speakers may see where this is going.)

at this point, you can visit the learning page and you'll see that you have 8 new cards available to learn. (4 words x 2 properties). if you have other decks in there other than french, make sure to filter by `french`.

_for extra credit, do a session and learn them... 🇫🇷_

## trivial grammar: definite articles

as some background, all nouns in french are _gendered_ either masculine or feminine. this shows up in definite articles (the english equivalent being `the`), where a different article is used depending on the gender. _let's model this!_

first let's group our newly added vocab words by gender. to do this, make two folder elements under `french` called `masculine` and `feminine`. (don't forget to mark them as folders!). then go to the masculine nouns (`pen` and `boy`) and change their type to `masculine`. this will move them to the masculine folder.

you can do this in bulk from the element list with the `move` action

repeat the same process, moving the other nouns to `feminine`. with our nouns now categorized by gender, let's make our definite article elements!

now make a new element called `le-noun` (the masculine article). unlike our other elements so far, `le-noun` will have have [parameters](./overview.md#data). create a parameter called `noun` and set its value to `masculine` (the folder we just created). now, whenever an instance of `le-noun` is created it will select a masculine noun at random that we can use in creating the properties for `le-noun`.

since we have properties defined, we can use [jexl expressions](https://github.com/TomFrost/Jexl) to create property vales from our parameters. in this case we simply want add 'le' to the noun. enter the properties as follows

- fr: `'le '+noun.fr`
- en: `'the '+noun.en`

now under example you can click the refresh button a few times and see it randomly switch between `le stylo` and `le garçon`.

at this point we can simply duplicate the process for the `la-noun`, changing le to la and the noun param from masculine to feminine.

### learning grammar cards

again if you like, you can go to the learn page and see what its like to learn them. if you haven't already learned the nouns from the previous section you won't get the article cards until you've learned nouns. the nouns also have to have a certain stability in order to be learned in grammar cards, _otherwise the grammar cards get much too difficult._ if you really want to see how they look being learned make sure to mark all the vocab words as good or easy, otherwise it may take a day or two for them to be sampled. _this is why the 'example' feature in the editor exists_

cards with parameters behave differently in that they have new parameters sampled each time you review them, and they are due much more frequently than an individual vocab card.

## verb conjugation

now let's apply these same concepts to another common use-case _verb conjugation_. without getting too far into the details of french verbs, regular verbs conjugate differently based on their suffix. so, let's make an element structure grouping them by suffix with two common ones "er" and "ir":

- `verbs`
  - `ir-verbs`
    - `fade` pâlir
    - `choose` choisir
  - `er-verbs`
    - `shine` briller
    - `eat` manger

now these can be learned by themselves, but we want to practice conjugation! there are many but let's start with one _third-person-singular (he/she/it \_)_:

- `verb-forms`
  - `third-person-singular` folder for all conjugations of this type
    - `third-person-singular-ir` element for _-ir verbs specifically_
      - params
        - verb = `ir-verbs` (since this only should select ir verbs)
      - props
        - fr = `verb.fr|r('ir', 'it')` **the actual rule:** replace suffix "ir" with "it"
        - en = `'[he/she/it] '+verb.en` if you prefer, you could explicitly state "third person singular past"

now if you refresh the example you'll see two different instances: `choisit` and `pâlit`. perfect! now to support the '-er' verbs add another element under `third-person-singular`

- `third-person-singular-er` element for _-ir verbs specifically_
  - params
    - verb = `er-verbs` now for er
  - props
    - fr = `verb.fr|r('r', '')` **the actual rule:** remove the 'r' from the end
    - en = `'[he/she/it] '+verb.en` same as before

see the implementation for `third-person-singular-past` in [the example](./french-example.json), same idea.

## clause construction

now lets apply both our definite articles and verb conjugations to make a simple sentence element! as a starting point let's just smash together a definite article/noun combination and a verb conjugation.
if you haven't already put `le-noun` and `la-noun` into a folder called `definite-article-noun`. then make an element for the clause:

- `definite-article-verb`
- params
  - article = `definite-article-noun` select a article-noun pair like 'le stylo'
  - vform = `verb-forms` select a verb-conjugation form
- props
  - fr = `article.fr+' '+vform.fr` just stick'em together
  - en = `article.en+' '+vform.en|rg('\[.*\]', '')` same, just remove the "[...]" annotation

### relationship pattern

now if you look at the examples, you may see a problem. we have lots of non-sensical pairings of subjects and verbs like "the window did choose". since we're simply picking nouns and conjugations at random, the element doesn't know any better.

to solve this we can create elements for representing _the subject-verb pairings themselves_. these elements, loosely called "relationship elements" don't have any properties so they aren't learned directly by the user, but they can be used by other elements to enforce semantics. let's make a folder for them:

- `subject-verb-pairs`
- params
  - noun = `nouns` (could be any noun, we'll specify which ones later)
  - verb = `verbs`
- **no properties**

now, you can add individual pairings one by one, or click on `view relationships >` to enter the **relationship editor**. this gives you a grid of possible pairings. when you check and uncheck the boxes, individual pairing elements are created automatically. related groups of elements are also clustered, so you can easier create semantic folders to avoid having to individually add relationship pairs for every new noun and verb.

for our case lets add pairings for boy/woman can eat/choose and pen/window can shine/fade.

next, we have to actually use these parings in our clause. element. returning to `definite-article-verb` add a new parameter:

- rel = `subject-verb-pairs`

and set the [constraint](./overview.md#constraints) to be the params in common between the rel and the other params: `noun verb`. now under examples, we only see clauses that match these pairings!

if you want to test learning this, the clause card won't be learnable for at least a couple days, as you need a certain stability with it's dependents before you can learn it, and that stability threshold increases with depth. if you want to circumvent this you can assign a learning order, say '1', to the whole deck, then set your init order setting to be the same.

## NOTE

please don't take this example as gospel. in a real french deck, you'd likely want to have cards for pronouns and their pairings as well, likewise not all verbs may be commonly used with all conjugations. clever categorization and constraint can get you there. there is no one correct way to tackle every language pattern, it depends on how you want to learn it, and how generalizable you want your elements to be. there is a three-way tradeoff between ease of setup, strict accuracy and end user learning efficiency.\_
