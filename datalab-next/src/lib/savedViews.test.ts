import { describe, expect, it } from 'vitest'
import { deleteSavedView, listSavedViews, saveSavedView } from './savedViews'

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
    clear: () => map.clear(),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size
    },
  }
}

describe('listSavedViews', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(listSavedViews('user-1', createMemoryStorage())).toEqual([])
  })

  it('returns an empty array (not a throw) for corrupted JSON', () => {
    const storage = createMemoryStorage()
    storage.setItem('sahelspot:savedViews:user-1', 'not json')
    expect(listSavedViews('user-1', storage)).toEqual([])
  })

  it('returns an empty array for a non-array stored value', () => {
    const storage = createMemoryStorage()
    storage.setItem('sahelspot:savedViews:user-1', JSON.stringify({ not: 'an array' }))
    expect(listSavedViews('user-1', storage)).toEqual([])
  })
})

describe('saveSavedView', () => {
  it('persists a view and returns it with a generated id and timestamp', () => {
    const storage = createMemoryStorage()
    const view = saveSavedView('user-1', { name: 'Missing Covers', params: { missing: 'cover' } }, storage)

    expect(view.name).toBe('Missing Covers')
    expect(view.params).toEqual({ missing: 'cover' })
    expect(view.id).toBeTruthy()
    expect(view.createdAt).toBeTruthy()
    expect(listSavedViews('user-1', storage)).toEqual([view])
  })

  it('appends to existing views rather than overwriting them', () => {
    const storage = createMemoryStorage()
    saveSavedView('user-1', { name: 'First', params: { status: 'draft' } }, storage)
    saveSavedView('user-1', { name: 'Second', params: { status: 'review' } }, storage)

    const views = listSavedViews('user-1', storage)
    expect(views).toHaveLength(2)
    expect(views.map((v) => v.name)).toEqual(['First', 'Second'])
  })

  it('does not store an icon field when none is provided', () => {
    const storage = createMemoryStorage()
    const view = saveSavedView('user-1', { name: 'No Icon', params: {} }, storage)
    expect(view.icon).toBeUndefined()
  })

  it('keeps different users fully isolated', () => {
    const storage = createMemoryStorage()
    saveSavedView('user-1', { name: 'User 1 View', params: {} }, storage)
    saveSavedView('user-2', { name: 'User 2 View', params: {} }, storage)

    expect(listSavedViews('user-1', storage).map((v) => v.name)).toEqual(['User 1 View'])
    expect(listSavedViews('user-2', storage).map((v) => v.name)).toEqual(['User 2 View'])
  })

  it('does not persist a sort field (omitted from the model this sprint)', () => {
    const storage = createMemoryStorage()
    const view = saveSavedView('user-1', { name: 'Draft Cleanup', params: { status: 'draft' } }, storage)
    expect('sort' in view).toBe(false)
  })
})

describe('deleteSavedView', () => {
  it('removes only the targeted view', () => {
    const storage = createMemoryStorage()
    const first = saveSavedView('user-1', { name: 'First', params: {} }, storage)
    const second = saveSavedView('user-1', { name: 'Second', params: {} }, storage)

    deleteSavedView('user-1', first.id, storage)

    expect(listSavedViews('user-1', storage)).toEqual([second])
  })

  it('is a no-op for an unknown id', () => {
    const storage = createMemoryStorage()
    saveSavedView('user-1', { name: 'First', params: {} }, storage)

    deleteSavedView('user-1', 'does-not-exist', storage)

    expect(listSavedViews('user-1', storage)).toHaveLength(1)
  })
})
