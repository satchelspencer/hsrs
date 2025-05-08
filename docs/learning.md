# learning

this guide assumes you already have a deck setup to learn from. if you don't check out the [jp-en deck](./en-jp-quickstart.md) or [make your own](./deck-creation.md)

## basic use

1.  from the home page, click start session. this will create a set of cards from the deck and enter a new _learning session_.
2.  you'll be presented with cards one by one. click reveal to show their full content, then grade yourself.
3.  cards you miss will keep showing up until you learn them.
4.  the session progress bar shows how many reviews are left. if you struggle, the session will adjust in size automatically.
5.  once you complete the session, you'll be returned to the home page where you can see your overall progress and start another session if you want.
6.  after your first day of learning, a _daily goal_ will appear on the home page. complete this goal to retain what you've already learned.
7.  once the goal is completed you can be done for the day, learn some new cards, or do extra reviews.

_if you want to get into the weeds, you can read more about [sessions](./overview.md#sessions) and [scheduling](./overview.md/#scheduling)_

## card order

each deck defines order sections for its content. when learning, new cards will be drawn random from the sections you're currently in. once you learn all the cards in a section you'll start getting new cards from the next.

you can 'skip ahead' and start drawing from more advanced sections with the **init order** setting. if you set your init order to say 2.2, you'll start getting cards from all sections up to and including 2.2, right from the outset.

complex cards (i.e grammar), rely on you having already seen cards that can 'fit' into their fields. you'll only get them once you've learned their prerequisites, _even if you set your init order_

## falling behind, or ahead

if you fall behind, your daily goals will adjust to catch up on your backlog within roughly the same number of days that you skipped. you won't be able to learn new cards until you're fully caught up though.

if you exceed your daily goal, you'll first get reviews of cards you recently missed / learned. then, you'll get 'pre-reviews' from future days. _these aren't the most efficient use of your time, but won't otherwise impact your learning negatively._

## advanced settings (optional)

- **plugins**: specify which [custom plugins](./plugins.md) you want to use for learning what groups of cards.
- **variables**: pass configuration options to your plugins, _read your plugin's documentation for more info_
- **export**: downloads your current learning history and deck
- **import**: allows replacing your current learning history or deck
- **init order**: see [card order](#card-order)
- **learning settings** (use with caution):
  - **retention**: decide your target retention, or what % of reviews you want to pass per day.
  - **parameters**: clicking optimize will update your fsrs parameters based on your learning history
  - **re-schedule**: re-computes what cards are currently due, you can use it after changing other learning settings though it may _drastically impact_ your reviews schedule.
