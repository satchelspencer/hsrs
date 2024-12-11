import React, { useRef, useState } from 'react'
import _ from 'lodash'

import { Button, SolidButton } from '../components/button'
import { Icon } from '../components/icon'
import { LabelGroup } from '../components/labels'
import { db, db2learning, learning2db } from '../redux/db'
import * as r from '../redux'
import { historyVersionable, deckVersionable } from '../redux/versions'
import { getTime } from '@hsrs/lib/schedule'

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
  const elements = r.useSelector((s) => s.deck.elements),
    dispatch = r.useDispatch()

  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    const now = getTime()
    setLoading(true)

    const e = historyVersionable.create({ type: 'history', history: [] })
    await db.cardLearning.orderBy('id').each((learning) => {
      e.history.push(db2learning(learning))
    })
    downloadJSON(e, now + 'history.json')

    const deckExport = deckVersionable.create({ type: 'deck', elements })
    downloadJSON(deckExport, now + 'deck.json')

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
          <SolidButton disabled={loading} onClick={handleExport}>
            <Icon name="download" />
            &nbsp; Download
          </SolidButton>,
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
          <Button onClick={() => dispatch(r.actions.recomputeCards())}>
            Re-schedule
          </Button>,
        ],
      ]}
    />
  )
}
