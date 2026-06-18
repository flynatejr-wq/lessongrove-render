import { describe, it, expect, vi, afterEach } from 'vitest'
import { uploadTextbook } from './api.js'

describe('uploadTextbook', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Success / JSON parsing', async () => {
    const mockFile = new File(['content'], 'test.pdf')
    const mockResponse = {
      ok: true,
      json: async () => ({ textbook_id: 1 })
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    const result = await uploadTextbook(mockFile, 'Title')

    expect(result).toEqual({ textbook_id: 1 })
  })

  it('POST method + FormData', async () => {
    const mockFile = new File(['content'], 'test.pdf')
    const mockResponse = {
      ok: true,
      json: async () => ({ textbook_id: 1 })
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await uploadTextbook(mockFile, 'Title')

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8000/upload',
      {
        method: 'POST',
        body: expect.any(FormData)
      }
    )
  })

  it('422 → friendly message', async () => {
    const mockFile = new File(['content'], 'test.pdf')
    const mockResponse = {
      ok: false,
      status: 422,
      text: async () => 'Unprocessable'
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(uploadTextbook(mockFile, 'Title')).rejects.toThrow(
      'This PDF has no extractable text. Try a different file.'
    )
  })

  it('Generic error uses response body', async () => {
    const mockFile = new File(['content'], 'test.pdf')
    const mockResponse = {
      ok: false,
      status: 500,
      text: async () => 'Server exploded'
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(uploadTextbook(mockFile, 'Title')).rejects.toThrow('Server exploded')
  })

  it('Empty body fallback', async () => {
    const mockFile = new File(['content'], 'test.pdf')
    const mockResponse = {
      ok: false,
      status: 503,
      text: async () => ''
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    await expect(uploadTextbook(mockFile, 'Title')).rejects.toThrow('Upload failed (503)')
  })
})
