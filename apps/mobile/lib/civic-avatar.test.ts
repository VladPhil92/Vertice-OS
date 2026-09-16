jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))

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
import * as ImagePicker from 'expo-image-picker'
import { apiFetch } from './api'
import { selectCivicAvatarPhoto, uploadAndConfirmCivicAvatar } from './civic-avatar'

const mockApiFetch = apiFetch as jest.Mock
const MockFile = File as unknown as jest.Mock

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

    it('appends a real expo-file-system File instead of the classic {uri, name, type} object', async () => {
      // Regression: Expo SDK 57's global fetch/FormData throws "Unsupported
      // FormDataPart implementation" for React Native's classic {uri, name,
      // type} part shape — it only accepts a value with a .bytes() method.
      // This broke every avatar upload on a real device despite passing in
      // a mocked-fetch test, since the mock never exercised the real
      // FormData serialization.
      mockApiFetch.mockResolvedValueOnce({ asset_id: 'asset-1', upload_url: 'https://upload.example/asset-1' })
      ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })
      mockApiFetch.mockResolvedValueOnce({
        citizen_id: 'c1', avatar_url: 'https://cdn.example/asset-1', status: 'approved', updated_at: '2026-09-16T00:00:00Z', upload_enabled: true,
      })

      await uploadAndConfirmCivicAvatar(photo, true)

      expect(MockFile).toHaveBeenCalledWith(photo.uri)
    })

    it('refuses to upload without explicit policy attestation, before any network call', async () => {
      // Regression: the mobile UI must show the portrait policy and require
      // an explicit checkbox, mirroring apps/web/app/dashboard/community/
      // profile/page.tsx's policyAttested gate. This is defense-in-depth so
      // a UI regression that skips the checkbox can never fabricate a
      // consent record by calling this function with an implicit `true`.
      await expect(uploadAndConfirmCivicAvatar(photo, false)).rejects.toMatchObject({
        code: 'CIVIC_AVATAR_POLICY_NOT_ATTESTED',
      })
      expect(mockApiFetch).not.toHaveBeenCalled()
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

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

      await uploadAndConfirmCivicAvatar(photo, true)

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

      await expect(uploadAndConfirmCivicAvatar(photo, true)).rejects.toMatchObject({
        code: 'CIVIC_AVATAR_DIRECT_UPLOAD_FAILED',
      })
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })
  })
})
