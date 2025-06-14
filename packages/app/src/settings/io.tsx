import React, { useRef, useState } from 'react'
import _ from 'lodash'
import { css, cx } from '@emotion/css'

import { Button, SolidButton, WarnButton } from '../components/button'
import { Icon } from '../components/icon'
import { LabelGroup } from '../components/labels'
import { db, db2learning, learning2db } from '../redux/db'
import * as r from '../redux'
import { historyVersionable, deckVersionable } from '@hsrs/lib/versions'
import { defaultretention, getTime } from '@hsrs/lib/schedule'
import CodeInput from '../components/code'
import { ElListPicker } from '../editor/element'
import { getCache } from '@hsrs/lib/cache'

const downloadJSON = (data: object, filename: string) => {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' }),
    url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()

  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ImportExport() {
  const { elements, settings: deckSettings } = r.useSelector((s) => s.deck),
    dispatch = r.useDispatch()

  const [loading, setLoading] = useState(false)

  const [exportFilter, setExportFilter] = useState<string[]>([]),
    cache = getCache(elements)

  const handleExport = async () => {
    const now = getTime()
    setLoading(true)
    const filterName = exportFilter.map((c) => elements[c].name).join('-')

    const e = historyVersionable.create({ type: 'history', history: [] })
    await db.cardLearning.orderBy('id').each((learning) => {
      if (
        !exportFilter ||
        exportFilter.includes(cache.tree.roots[learning.elIds[0]] ?? '')
      )
        e.history.push(db2learning(learning))
    })
    downloadJSON(e, filterName + now + 'history.json')

    const deckExport = deckVersionable.create({
      type: 'deck',
      elements: _.pickBy(
        elements,
        (e, id) => !exportFilter || exportFilter.includes(cache.tree.roots[id] ?? id)
      ),
    })
    downloadJSON(deckExport, filterName + now + 'deck.json')

    setLoading(false)
  }

  const fileInputRef = useRef<HTMLInputElement>(null),
    handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
      setLoading(true)
      const file = event.target.files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = async (e) => {
          const json = JSON.parse(e.target?.result as string)

          if (json['type'] === 'deck') {
            const deck = deckVersionable.migrate(json)
            dispatch(r.actions.importElements(deck))
          } else if (json['type'] === 'history') {
            const history = historyVersionable.migrate(json)
            await db.cardLearning.clear()
            db.cardLearning.bulkAdd(history.history.map(learning2db))
            dispatch(r.actions.recomputeCards())
          }
        }
        reader.readAsText(file)
      }
      setLoading(false)
    },
    triggerFileInput = () => fileInputRef.current?.click()

  return (
    <LabelGroup
      items={[
        [
          'Export',
          <div style={{ display: 'flex', gap: 8 }}>
            <SolidButton disabled={loading} onClick={handleExport}>
              <Icon name="download" />
              &nbsp; Download
            </SolidButton>
            <ElListPicker
              multiline={false}
              placeholder="All decks..."
              value={exportFilter}
              onChange={(value) => setExportFilter(value)}
            />
          </div>,
        ],
        [
          'Import',
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
            <SolidButton disabled={loading} onClick={triggerFileInput}>
              <Icon name="upload" />
              &nbsp;Upload
            </SolidButton>
          </>,
        ],
        [
          'Schedule',
          <Button
            disabled={loading}
            onClick={async () => {
              setLoading(true)
              await dispatch(r.actions.recomputeCards())
              setLoading(false)
            }}
          >
            Re-schedule
          </Button>,
        ],
        [
          'Parameters',
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              disabled={loading}
              onClick={async () => {
                setLoading(true)
                await dispatch(r.actions.computeParams())
                setLoading(false)
              }}
            >
              Optimize
            </Button>
            <WarnButton
              onClick={() =>
                dispatch(r.actions.setDeckSettings({ fsrsParams: undefined }))
              }
            >
              Reset
            </WarnButton>
          </div>,
        ],
        [
          'Retention',
          <div className={inputWrapper}>
            <CodeInput
              value={
                deckSettings.retention
                  ? deckSettings.retention + ''
                  : defaultretention + ''
              }
              throttle
              onChange={(rt) => {
                let rtv: number | undefined = undefined
                try {
                  rtv = parseFloat(rt ?? '')
                } catch {}
                dispatch(r.actions.setDeckSettings({ retention: rtv }))
              }}
            />
          </div>,
        ],
        [
          'Init order',
          <div className={inputWrapper}>
            <CodeInput
              placeholder="0.0"
              value={deckSettings.startOrder}
              throttle
              onChange={(order) => {
                dispatch(r.actions.setDeckSettings({ startOrder: order }))
              }}
            />
          </div>,
        ],
        [
          'Props',
          <div style={{ width: 200 }}>
            <CodeInput
              value={deckSettings.propsFilter?.join(',')}
              throttle
              placeholder="Learn all props..."
              onChange={(filter) => {
                dispatch(
                  r.actions.setDeckSettings({
                    propsFilter: filter?.length ? filter.split(',') : [],
                  })
                )
              }}
            />
          </div>,
        ],
      ]}
    />
  )
}

const inputWrapper = cx(css`
  width: 50px;
`)
