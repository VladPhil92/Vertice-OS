jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))

jest.mock('./api', () => ({
  apiFetch: jest.fn(),
}))

import * as ImagePicker from 'expo-image-picker'
import { apiFetch } from './api'
import { selectCivicAvatarPhoto, uploadAndConfirmCivicAvatar } from './civic-avatar'

const mockApiFetch = apiFetch as jest.Mock

describe('apps/mobile lib/civic-avatar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    globalThis.fetch = jest.fn()
  })

  describe('selectCivicAvatarPhoto', () => {
    it('throws a domain error when camera permission is denied instead of calling the picker', async () => {
      ;(ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false })

      await expect(selectCivicAvatarPhoto('camera')).rejects.toMatchObject({ code: 'CAMERA_PERMISSION_DENIED' })
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled()
    })

    it('rejects a photo smaller than the schema minimum before any network call', async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true })
      ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: [{ uri: 'file://tiny.jpg', width: 200, height: 200, fileName: 'tiny.jpg', mimeType: 'image/jpeg' }],
      })

      await expect(selectCivicAvatarPhoto('library')).rejects.toMatchObject({ code: 'CIVIC_AVATAR_TOO_SMALL' })
    })

    it('returns null when the picker is dismissed without a selection', async () => {
      ;(ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true })
      ;(ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: true, assets: [] })

      await expect(selectCivicAvatarPhoto('library')).resolves.toBeNull()
    })
  })

  describe('uploadAndConfirmCivicAvatar', () => {
    const photo = {
      uri: 'file://avatar.jpg',
      fileName: 'avatar.jpg',
      mimeType: 'image/jpeg',
      width: 800,
      height: 800,
    }

    it('reports an honest face_detector_available: false, face_count: null since React Native has no FaceDetector API', async () => {
      // Regression: ConfirmCivicAvatarSchema (apps/api) only enforces
      // face_count === 1 when face_detector_available is true. Sending a
      // fabricated `true` here to look like the web client would either fail
      // validation or silently claim a face check that never ran.
      mockApiFetch.mockResolvedValueOnce({ asset_id: 'asset-1', upload_url: 'https://upload.example/asset-1' })
      ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })
      mockApiFetch.mockResolvedValueOnce({
        citizen_id: 'c1', avatar_url: 'https://cdn.example/asset-1', status: 'approved', updated_at: '2026-09-16T00:00:00Z', upload_enabled: true,
      })

      await uploadAndConfirmCivicAvatar(photo)

      const confirmCall = mockApiFetch.mock.calls[1]
      expect(confirmCall[0]).toBe('/community/profile/me/avatar/confirm')
      const body = JSON.parse(confirmCall[1].body as string)
      expect(body.client_checks.face_detector_available).toBe(false)
      expect(body.client_checks.face_count).toBeNull()
      expect(body.asset_id).toBe('asset-1')
      expect(body.policy_attestation).toBe(true)
    })

    it('throws a domain error when the direct upload to the storage provider fails', async () => {
      mockApiFetch.mockResolvedValueOnce({ asset_id: 'asset-1', upload_url: 'https://upload.example/asset-1' })
      ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

      await expect(uploadAndConfirmCivicAvatar(photo)).rejects.toMatchObject({
        code: 'CIVIC_AVATAR_DIRECT_UPLOAD_FAILED',
      })
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })
  })
})
