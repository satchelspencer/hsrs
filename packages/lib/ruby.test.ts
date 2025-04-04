import { describe, it, expect } from 'vitest'
import _ from 'lodash'
import { renderRuby } from './ruby'

describe('ruby', () => {
  it('basic ruby', async () => {
    expect(
      renderRuby('はさみ~で~お姉さん~が~切れた', 'はさみ~で~おねえさん~が~きれた')
    ).eq('はさみでお<ruby>姉<rt>ねえ</rt></ruby>さんが<ruby>切<rt>き</rt></ruby>れた')
  })
})
