# benchmark

_does it even work?_

## method

the hsrs benchmark is based on the [RMSE(bins)](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Metric#rmse-bins) method used by open spaced repetition to evaluate conventional SRSs.

hsrs usage typically involves a mixture of deep and shallow card reviews. this benchmark aims to _only measure the performance of hsrs on deep card recall prediction_. during evaluation all cards have their states updated as normal, but only predictions on deep cards are included in the results so as to isolate the effect of hsrs separate from fsrs.

the benchmark currently doesn't take into account same-day reviews.

## running

- install the hsrs cli `npm i -g @hsrs/cli`
- run `hsrs benchmark <path-to-revlog.json> <path-to-deck.json> <graph-output.png>`

you can download the grsly deck.json [here](https://app.grsly.com/jp.deck.json)

## results

for now there is relatively little data for the benchmark, so results are not necessarily representative. these results are based on a [dataset](https://github.com/satchelspencer/hsrs-bench-data) including mostly my own revlog and a few other willing users so it's little more than a preliminary sanity check.

of the 463k total reviews, only 72k are on deep cards. this is due to users having significant anki histories before using hsrs, as well as reviewing both deep and shallow cards in hsrs. all 463k are updated during evaluation because deep card retention depends on shallow card states and visa versa.

the probability distribution is also _incredibly_ biased due to hsrs' very high target retention for deep cards (so you see them more frequently) and essentially never reviewing late. there's _barely_ any data below r=0.9 and it's very noisy.

![rmse](./img/rmse.png)

the rmse is similar to fsrs' own [score](https://github.com/open-spaced-repetition/srs-benchmark?tab=readme-ov-file#without-same-day-reviews). however, i am concerned that it is _lower_ error than fsrs since i would expect deep cards to be fundamentally more difficult to estimate as their content isn't fixed. 

this benchmark will still be useful for measuring comparative improvements in future versions of hsrs, especially once hsrs supports optimizing its own hyperparameters!
