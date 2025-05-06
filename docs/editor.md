# the editor

though not strictly required, the editor is a graphical way of browsing and editing the elements in a deck. access it from the hsrs client by clicking the deck icon.

the editor interface is split into a series of columns, each representing an element, or list of elements.

## element lists

at the top of each list you have buttons for:

- `+` for adding a new/existing element to the list.
- if you have an element(s) selected you'll also see
  - `trash` double click to delete the selected element(s)
  - `move` select another element to move your selection to
  - `duplicate` make a copy of the selected element(s)

## element editor

elements have the following parts:

- `name` the unique name of the element, for organization and referencing it elsewhere
- `O` the [order](./overview.md/#ordering) of the element
- `folder` if checked, the element won't be learnable as a card, rather it functions purely to organize other elements.
- `types` names of elements that this element belongs to. _there can be more than one parent_
- `properties` the actual content of the element see [properties](./overview.md#data)
- `params` what other elements are used to construct the properties for this element
- `mode` the element's [mode string](./overview.md#modes)
- `example` this will generate a random [instance](./overview.md#sampling) of the element and display its computed properties. _elements without params only have one instance_
- if the element is a _folder_ you'll see an [element list](#element-lists) with all its children

at the very top you also have:

- `back arrow` closes the element and returns you to the left
- `stats` opens the stats browser for that element to show you learning info
- `search` search for an element by name and open it separately to the right
