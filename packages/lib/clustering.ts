import _ from 'lodash'
import cluster from 'hierarchical-clustering'

import * as t from '@hsrs/lib/types'
import { getElementParams, getNonVirtualDescendents } from '@hsrs/lib/props'

export function clusterNodes(elementId: string, elements: t.IdMap<t.Element>) {
  const element = elements[elementId],
    nonVirtuals = getNonVirtualDescendents(elementId, elements),
    axes = _.sortBy(Object.keys(element.params ?? {}))

  if (!nonVirtuals.length) return [[[]], [[]]]
  const adjLists: { [id: string]: string[] }[] = [{}, {}]

  for (const nonVirtualId of nonVirtuals) {
    const veParams = getElementParams(nonVirtualId, elements)
    for (let axisIndex = 0; axisIndex < axes.length; axisIndex++) {
      const axisParam = veParams[axes[axisIndex]],
        otherIndex = (axisIndex + 1) % 2,
        otherParam = veParams[axes[otherIndex]]
      adjLists[axisIndex][axisParam] ??= []
      adjLists[axisIndex][axisParam].push(otherParam)
    }
  }

  const clusters: string[][][][] = []
  for (const adjList of adjLists) {
    const adjListKeys = Object.keys(adjList),
      levels = cluster({
        input: adjListKeys,
        distance(a, b) {
          return 1 / _.intersection(adjList[a], adjList[b]).length
        },
        linkage(distances) {
          // var sum = distances.reduce((a, b) => a + b, 0) // Sum of all distances
          // return sum / distances.length // Average distance
          return Math.min.apply(null, distances)
        },
      })

    clusters.push(
      levels.map((level) => level.clusters.map((c) => c.map((id) => adjListKeys[id])))
    )
  }
  return clusters
}
