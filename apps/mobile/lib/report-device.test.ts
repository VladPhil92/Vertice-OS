jest.mock('expo-file-system', () => ({
  // The real global FormData in this test environment (unlike Expo's
  // patched runtime FormData) strictly requires the appended value to be
  // `instanceof Blob`, so the mock must actually extend Blob to exercise
  // the real form.append() call the way production code does.
  File: jest.fn().mockImplementation((uri: string) => Object.assign(new Blob(), { uri, bytes: jest.fn() })),
}))

jest.mock('./api', () => ({
  apiFetch: jest.fn(),
}))

import { File } from 'expo-file-system'
import { apiFetch } from './api'
import { uploadAndConfirmReportEvidence, type SelectedReportEvidence } from './report-device'

const mockApiFetch = apiFetch as jest.Mock
const MockFile = File as unknown as jest.Mock

describe('apps/mobile lib/report-device', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    globalThis.fetch = jest.fn()
  })

  describe('uploadAndConfirmReportEvidence', () => {
    const evidence: SelectedReportEvidence = {
      uri: 'file://evidence.jpg',
      fileName: 'evidence.jpg',
      mimeType: 'image/jpeg',
      width: 1200,
      height: 900,
    }

    it('appends a real expo-file-system File instead of the classic {uri, name, type} object', async () => {
      // Regression: Expo SDK 57's global fetch/FormData throws "Unsupported
      // FormDataPart implementation" for React Native's classic {uri, name,
      // type} part shape — it only accepts a value with a .bytes() method.
      // This is the same bug that broke civic avatar uploads on a real
      // device; report evidence used the identical broken pattern.
      mockApiFetch.mockResolvedValueOnce({ media_asset_id: 'asset-1', upload_url: 'https://upload.example/asset-1' })
      ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })
      mockApiFetch.mockResolvedValueOnce({ media_asset_id: 'asset-1', url: 'https://cdn.example/asset-1', status: 'confirmed' })

      await uploadAndConfirmReportEvidence(evidence)

      expect(MockFile).toHaveBeenCalledWith(evidence.uri)
    })

    it('confirms with the media_asset_id returned by the upload-intent call', async () => {
      mockApiFetch.mockResolvedValueOnce({ media_asset_id: 'asset-1', upload_url: 'https://upload.example/asset-1' })
      ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })
      mockApiFetch.mockResolvedValueOnce({ media_asset_id: 'asset-1', url: 'https://cdn.example/asset-1', status: 'confirmed' })

      await uploadAndConfirmReportEvidence(evidence)

      const confirmCall = mockApiFetch.mock.calls[1]
      expect(confirmCall[0]).toBe('/territorial/media/confirm')
      expect(JSON.parse(confirmCall[1].body as string)).toEqual({ media_asset_id: 'asset-1' })
    })

    it('throws a domain error when the direct upload to the storage provider fails', async () => {
      mockApiFetch.mockResolvedValueOnce({ media_asset_id: 'asset-1', upload_url: 'https://upload.example/asset-1' })
      ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

      await expect(uploadAndConfirmReportEvidence(evidence)).rejects.toMatchObject({
        code: 'REPORT_MEDIA_DIRECT_UPLOAD_FAILED',
      })
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })
  })
})
