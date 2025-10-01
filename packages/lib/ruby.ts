import { RUBY_DELIM } from './expr'

/* take text split by ruby delim and for each chunk only apply
ruby to part between text and ruby without matching prefix or suffix */

export function renderRuby(text: string, ruby: string) {
  const tcs = text.split(RUBY_DELIM),
    rcs = ruby.split(RUBY_DELIM)

  if (tcs.length !== rcs.length) return cleanRuby(text)

  let res = ''

  for (let i = 0; i < tcs.length; i++) {
    const tc = tcs[i],
      rc = rcs[i]

    if (tc === rc) {
      res += `${tc}<wbr/>`
    } else {
      let prec = '',
        postc = ''

      for (let c = 0; c < tc.length; c++) {
        if (tc[c] === rc[c]) prec += tc[c]
        else break
      }

      for (let c = 0; c < tc.length; c++) {
        if (tc[tc.length - 1 - c] === rc[rc.length - 1 - c])
          postc = tc[tc.length - 1 - c] + postc
        else break
      }
      const tcc = tc.substring(prec.length, tc.length - postc.length),
        rcc = rc.substring(prec.length, rc.length - postc.length)

      res += `${prec}<ruby>${tcc}<rt>${rcc}</rt></ruby>${postc}<wbr/>`
    }
  }
  return res.replaceAll('@', '')
}

export function cleanRuby<T>(text: T, breaks?: boolean): T {
  return typeof text === 'string'
    ? (text.replaceAll(RUBY_DELIM, breaks ? '<wbr/>' : '').replaceAll('@', '') as T)
    : text
}
