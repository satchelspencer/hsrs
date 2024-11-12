import { describe, it, expect } from 'vitest'
import { getElementAndParents, getElementProps, generateElementInstances } from './props'
import { Element, IdMap } from './types'
import _ from 'lodash'

describe('getElementAndParents', () => {
  it('should resolve deep parents with circular refz', async () => {
    expect(
      getElementAndParents('a', {
        a: { name: 'a', parents: ['b'], props: {} },
        b: { name: 'b', parents: ['c', 'd'], props: {} },
        c: { name: 'c', parents: [], props: {} },
        d: { name: 'd', parents: ['a'], props: {} },
        e: { name: 'e', parents: [], props: {} },
      })
    ).toEqual(['a', 'b', 'd', 'c'])
  })
})

describe('resolveProps', () => {
  it('should resolve deep props ', async () => {
    expect(
      getElementProps('a', {
        a: { name: 'a', parents: ['b'], props: { p1: ['1', '1b'] } },
        b: { name: 'b', parents: ['c', 'd'], props: { p1: ['2', '2b'] } },
        c: { name: 'c', parents: [], props: { p3: ['a', 'ab'], p4: ['b', 'bb'] } },
        d: { name: 'c', parents: ['a'], props: {} },
      })
    ).toEqual({ p1: ['1', '1b'], p3: ['a', 'ab'], p4: ['b', 'bb'] })
  })
})

describe('elementInstances', () => {
  it.only('should resolve deep props ', async () => {
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
        },
        condition: {
          name: 'condition',
          parents: [],
          props: {},
          params: { because: 'sentence', this: 'sentence' },
        },
      },
      id = 'condition'
    let i = 0
    for (const g of generateElementInstances(id, elements)) {
      console.log(JSON.stringify(g, null, 2))
      //break
    }

    expect({}).toEqual({})
  })
})
