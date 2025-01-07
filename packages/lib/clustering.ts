import _ from 'lodash'
import cluster from 'hierarchical-clustering'

import * as t from '@hsrs/lib/types'
import { getInheritedElement, getNonVirtualDescendents } from '@hsrs/lib/props'

export type AdjLists = { [id: string]: string[] }[]

export function getRelationAdjs(elementId: string, elements: t.IdMap<t.Element>) {
  const element = elements[elementId],
    nonVirtuals = getNonVirtualDescendents(elementId, elements),
    axes = _.sortBy(Object.keys(element.params ?? {}))

  const adjLists: AdjLists = [{}, {}]

  for (const nonVirtualId of nonVirtuals) {
    const { params: veParams = {} } = getInheritedElement(nonVirtualId, elements)
    for (let axisIndex = 0; axisIndex < axes.length; axisIndex++) {
      const axisParam = veParams[axes[axisIndex]],
        otherIndex = (axisIndex + 1) % 2,
        otherParam = veParams[axes[otherIndex]]
      if (elements[axisParam] && elements[otherParam]) {
        adjLists[axisIndex][axisParam] ??= []
        adjLists[axisIndex][axisParam].push(otherParam)
      }
    }
  }
  return adjLists
}

export function getCommonAdjs(cluster: string[], adjLists: AdjLists[number]): string[] {
  return _.intersection(...cluster.map((c) => adjLists[c]))
}

export function clusterNodes(adjLists: AdjLists) {
  const clusters: string[][][][] = []
  for (const adjList of adjLists) {
    const adjListKeys = Object.keys(adjList)
    if (!adjListKeys.length) clusters.push([[]])
    else {
      const levels = cluster({
        input: adjListKeys,
        distance(a, b) {
          return 1 / _.intersection(adjList[a], adjList[b]).length
        },
        linkage: 'complete',
      })

      clusters.push(
        _.reverse(
          levels.map((level) => level.clusters.map((c) => c.map((id) => adjListKeys[id])))
        )
      )
    }
  }
  return clusters
}
