import { css, injectGlobal } from '@emotion/css'
import { convertOkhslToOklab, convertOklabToRgb, formatRgb, Okhsl } from 'culori'

injectGlobal`
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    font-size:14px;
    font-weight:400;
    background:white;
  }
  @media (prefers-color-scheme: dark) {
    html {
      filter: hue-rotate(180deg) invert(1) contrast(0.8);
    }
    * {
      box-shadow:none !important;
    }
  }
`

function createColor(base: Color) {
  return (c?: Color) => color({ ...normColor(base), ...normColor(c) })
}

type Color = { l?: number; s?: number; h?: number } | number

function normColor(color?: Color) {
  return color && (typeof color === 'number' ? { l: color } : color)
}

export function color(color?: Color) {
  return formatRgb(
    convertOklabToRgb(convertOkhslToOklab({ l: 1, s: 0, ...normColor(color) }))
  )
}
color.active = createColor({ l: 0.8, s: 0.8, h: 250 })

export const box = css`
  box-sizing: border-box;
  display: flex;
`

export const fill = css`
  ${box}
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  display: flex;
  align-items: stretch;
`

export const surface = css`
  ${box}
  background:${color(1)};
  color: ${color(0.3)};
`

export const surfaceTone = css`
  ${box}
  background:${color(0.97)};
  color: ${color(0.3)};
`
