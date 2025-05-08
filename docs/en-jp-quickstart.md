# en-jp quickstart

setting up hsrs for en-jp learning with the grsly deck and tts plugin

## caveats

this client has the exact same learning functionality as [grsly](https://grsly.com), but:

- for convenience this guide uses the hosted build urls. if you want to use hsrs _fully independently_, follow the instructions to [build it locally](../../readme.md#run-locally) and change the urls accordingly.
- **optionally**, text-to-speech can be handled via google's cloud text-to-speech api. normal usage falls well within their free credits, but you'll still have to setup an account and enter billing info.
- you are responsible for managing your own data. as a fully client-side web app, your review history is subject to some rare but painful persistence [limitations](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria#does_browser-stored_data_persist). firefox has quite reliable persistence. Regardless, _make sure to back up your history from time to time._

## basic setup

1.  download the grsly Japanese deck from [here](https://app.grsly.com/jp.deck.json) _(right click > save link as, may be helpful)_
2.  open the hsrs client at https://elldev.com/hsrs/
3.  open the settings page
4.  click the **upload** button next to import and select the Japanese deck
5.  under **plugins** add a new one for `jp` with the url `https://elldev.com/hsrs-tts/?lang=ja-JP&voice=ja-JP-Standard-C&tts=tl&txt=jp&modes=polite-casual.male-female.subbordinate-rude.spoken-written`

## google tts setup _(optional)_

*without these steps the tts plugin will fall back to your device's builtin text-to-speech which is generally pretty bad, and lacks [SSML](https://www.w3.org/TR/speech-synthesis11/) control so its a damn coin toss what you'll hear for something like 生*

1. go to https://cloud.google.com/ and create an account.
2. setup billing at https://console.cloud.google.com/billing _any hsrs usage will fall well within google's monthly free tier_
3. go to the console at https://console.cloud.google.com/ and create a new project
4. with that project selected go to https://console.cloud.google.com/apis/library/texttospeech.googleapis.com and click **enable**
5. go to credentials https://console.cloud.google.com/apis/credentials then **create credentials > api key**
6. _recommended_ click edit api key, enable api restrictions and only allow the _cloud text-to-speech api_
7. go back to hsrs' settings page and under variables add `google-key` with your api key

now you're ready to [start learning](./learning.md)!
