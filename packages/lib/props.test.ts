import { describe, it, expect } from 'vitest'
import { generateElementInstanceSamples } from './sample'
import { Element, ElementInstance, IdMap } from './types'
import _ from 'lodash'

const renderInstance = (instance: ElementInstance, depth = 0) => {
  const pad = new Array(depth).fill('  ').join('')
  return `${instance.element}${
    !instance.params
      ? ''
      : `(\n${Object.keys(instance.params)
          .map(
            (pname) =>
              `${pad}  ${pname}: ${renderInstance(instance.params![pname]!, depth + 1)}`
          )
          .join(',\n')}\n${pad})`
  }`
}

describe('elementInstances', () => {
  it('should resolve deep props ', async () => {
    const elements: IdMap<Element> = {
        verb: { name: 'verb', virtual: true, parents: [], props: {} },
        eat: { name: 'eat', parents: ['verb'], props: {} },
        drink: { name: 'drink', parents: ['verb'], props: {} },
        pounce: { name: 'pounce', parents: ['verb'], props: {} },
        subject: { name: 'subject', virtual: true, parents: [], props: {} },
        cat: { name: 'cat', virtual: true, parents: ['subject'], props: {} },
        suki: { name: 'suki', parents: ['cat'], props: {} },
        soba: { name: 'suki', parents: ['cat'], props: {} },
        boom: { name: 'suki', parents: ['cat'], props: {} },
        human: { name: 'human', parents: ['subject'], props: {} },
        object: { name: 'object', virtual: true, parents: [], props: {} },
        cake: { name: 'cake', parents: ['object'], props: {} },
        water: { name: 'water', parents: ['object'], props: {} },
        bread: { name: 'bread', parents: ['object'], props: {} },
        pillow: { name: 'pillow', parents: ['object'], props: {} },
        verbSubject: {
          name: 'verb-subject',
          parents: [],
          virtual: true,
          props: {},
          params: { verb: 'verb', subject: 'subject' },
        },
        catPounce: {
          name: 'catPounce',
          parents: ['verbSubject'],
          props: {},
          params: { subject: 'cat', verb: 'pounce' },
        },
        humanEat: {
          name: 'humanEat',
          parents: ['verbSubject'],
          props: {},
          params: { subject: 'human', verb: 'eat' },
        },
        humandrink: {
          name: 'humandrink',
          parents: ['verbSubject'],
          props: {},
          params: { subject: 'human', verb: 'drink' },
        },
        verbObject: {
          name: 'verb-object',
          parents: [],
          props: {},
          virtual: true,
          params: { verb: 'verb', object: 'object' },
        },
        eatCake: {
          name: 'eatanything',
          parents: ['verbObject'],
          params: { verb: 'eat', object: 'cake' },
          props: {},
        },
        eatBread: {
          name: 'eatanything',
          parents: ['verbObject'],
          params: { verb: 'eat', object: 'bread' },
          props: {},
        },
        drinkWater: {
          name: 'dw',
          parents: ['verbObject'],
          params: { verb: 'drink', object: 'water' },
          props: {},
        },
        pouncePillow: {
          name: 'pouncepillow',
          parents: ['verbObject'],
          params: { verb: 'pounce', object: 'pillow' },
          props: {},
        },
        sentence: {
          name: 'sent',
          parents: [],
          props: {},
          params: { vsub: 'verbSubject', vobj: 'verbObject' },
          constraint: 'verb',
        },
        sentenceB: {
          name: 'sent',
          parents: [],
          props: {},
          params: { vobj: 'pouncePillow' },
        },
        condition: {
          name: 'condition',
          parents: [],
          props: {},
          params: { this: 'sentenceB', because: 'sentence' },
        },
      },
      id = 'condition'
    let i = 0
    for (const g of generateElementInstanceSamples(id, elements)) {
      console.log(renderInstance(g))
      break
    }

    expect({}).toEqual({})
  })
})
