import React, {memo, useCallback, useMemo} from 'react'
import {Box, Button, Card, Container, Flex, Text} from '@sanity/ui'
import {WarningOutlineIcon, SyncIcon, CloseIcon} from '@sanity/icons'
import styled from 'styled-components'
import {fromString as pathFromString, get as pathGet} from '@sanity/util/paths'
import {KeyedSegment, Reference} from '@sanity/types'
import {map, startWith} from 'rxjs/operators'
import {
  getPublishedId,
  // eslint-disable-next-line camelcase
  unstable_observePathsDocumentPair,
  DocumentAvailability,
} from '@sanity/base/_internal'
import {Observable, of} from 'rxjs'
import {useMemoObservable} from 'react-rx'

import {usePaneRouter} from '../../../contexts/paneRouter'
import {RouterPaneGroup} from '../../../types'

const Root = styled(Card)`
  position: relative;
  z-index: 50;
`

const TextOneLine = styled(Text)`
  & > * {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`

interface ParentReferenceInfo {
  loading: boolean
  result?: {
    availability: {draft: DocumentAvailability; published: DocumentAvailability}
    refValue: string | undefined
  }
}

export const ReferenceChangedBanner = memo(() => {
  const {params, groupIndex, routerPanesState, replaceCurrent, BackLink} = usePaneRouter()
  const routerReferenceId = routerPanesState[groupIndex]?.[0].id
  const parentGroup = routerPanesState[groupIndex - 1] as RouterPaneGroup | undefined
  const parentSibling = parentGroup?.[0]
  const parentId = parentSibling?.id
  const parentHasRev = !!parentSibling?.params?.rev
  const parentRefPath = useMemo(() => {
    return (params?.parentRefPath && pathFromString(params.parentRefPath)) || null
  }, [params?.parentRefPath])

  const parentRef: ParentReferenceInfo = useMemoObservable(
    (): Observable<ParentReferenceInfo> => {
      const parentRefPathSegment = parentRefPath?.[0] as string | undefined
      if (!parentId || !parentRefPathSegment || !parentRefPath) {
        return of({loading: false})
      }

      const publishedId = getPublishedId(parentId)
      const path = pathFromString(parentRefPathSegment)

      // note: observePaths doesn't support keyed path segments, so we need to select the nearest parent
      const keyedSegmentIndex = path.findIndex(
        (p): p is KeyedSegment => typeof p == 'object' && '_key' in p
      )
      return unstable_observePathsDocumentPair(
        publishedId,
        (keyedSegmentIndex === -1 ? path : path.slice(0, keyedSegmentIndex)) as string[][]
      ).pipe(
        map(
          ({draft, published}): ParentReferenceInfo => {
            return {
              loading: false,
              result: {
                availability: {draft: draft.availability, published: published.availability},
                refValue: pathGet<Reference>(draft.snapshot || published.snapshot, parentRefPath)
                  ?._ref,
              },
            }
          }
        ),
        startWith({loading: true})
      )
    },
    [parentId, parentRefPath],
    {loading: true}
  )

  const handleReloadReference = useCallback(() => {
    if (parentRef.loading) return

    if (parentRef.result?.refValue) {
      replaceCurrent({id: parentRef.result.refValue, params: params as Record<string, string>})
    }
  }, [parentRef.loading, parentRef.result, replaceCurrent, params])

  // this will be true if viewing history, in that case, hide this banner
  if (parentHasRev) return null

  if (
    parentRef.loading ||
    !parentId ||
    !parentRefPath ||
    parentRef.result?.refValue === routerReferenceId ||
    // if the parent document is not available (i.e. due to permission denied or not found)
    // we don't want to display a warning here, but instead rely on the parent
    // view to display the appropriate message
    (!parentRef.result?.availability.draft.available &&
      !parentRef.result?.availability.published.available)
  ) {
    return null
  }

  return (
    <Root shadow={1} tone="caution">
      <Container paddingX={4} paddingY={2} sizing="border" width={1}>
        <Flex align="center">
          <Text size={1}>
            <WarningOutlineIcon />
          </Text>

          {parentRef.result?.refValue ? (
            <>
              <Box flex={1} marginLeft={3}>
                <TextOneLine title="This reference has changed since you opened it." size={1}>
                  This reference has changed since you opened it.
                </TextOneLine>
              </Box>
              <Box marginLeft={3}>
                <Button
                  onClick={handleReloadReference}
                  icon={SyncIcon}
                  fontSize={1}
                  mode="ghost"
                  padding={2}
                  space={2}
                  text="Reload reference"
                />
              </Box>
            </>
          ) : (
            <>
              <Box flex={1} marginLeft={3}>
                <TextOneLine title="This reference has been removed since you opened it." size={1}>
                  This reference has been removed since you opened it.
                </TextOneLine>
              </Box>
              <Box marginLeft={3}>
                <Button
                  as={BackLink}
                  icon={CloseIcon}
                  fontSize={1}
                  mode="ghost"
                  padding={2}
                  space={2}
                  text="Close reference"
                />
              </Box>
            </>
          )}
        </Flex>
      </Container>
    </Root>
  )
})

ReferenceChangedBanner.displayName = 'ReferenceChangedBanner'