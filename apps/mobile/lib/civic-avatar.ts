import * as ImagePicker from 'expo-image-picker'
import { apiFetch } from './api'
import type { CivicAvatarState, CivicAvatarUploadIntent } from '../types/api'

export interface SelectedAvatarPhoto {
  uri: string
  fileName: string | null
  mimeType: string | null
  width: number
  height: number
}

// Mirrors ConfirmCivicAvatarSchema's client_checks.width/height minimum in
// apps/api/src/modules/community/community.schema.ts.
const MIN_AVATAR_SIDE = 640

export async function selectCivicAvatarPhoto(
  source: 'camera' | 'library',
): Promise<SelectedAvatarPhoto | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      throw Object.assign(new Error('Debes autorizar la cámara para tomar tu foto de perfil.'), {
        code: 'CAMERA_PERMISSION_DENIED',
      })
    }
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      throw Object.assign(new Error('Debes autorizar el acceso a fotos para elegir tu foto de perfil.'), {
        code: 'PHOTO_LIBRARY_PERMISSION_DENIED',
      })
    }
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    exif: false,
  }

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options)

  if (result.canceled || !result.assets[0]) return null

  const asset = result.assets[0]
  if (asset.width < MIN_AVATAR_SIDE || asset.height < MIN_AVATAR_SIDE) {
    throw Object.assign(
      new Error(`La foto debe medir al menos ${MIN_AVATAR_SIDE}x${MIN_AVATAR_SIDE} píxeles.`),
      { code: 'CIVIC_AVATAR_TOO_SMALL' },
    )
  }

  return {
    uri: asset.uri,
    fileName: asset.fileName ?? null,
    mimeType: asset.mimeType ?? null,
    width: asset.width,
    height: asset.height,
  }
}

export async function uploadAndConfirmCivicAvatar(
  photo: SelectedAvatarPhoto,
): Promise<CivicAvatarState> {
  const intent = await apiFetch<CivicAvatarUploadIntent>('/community/profile/me/avatar/upload-intent', {
    method: 'POST',
    body: '{}',
  })

  const form = new FormData()
  const extension = photo.mimeType?.split('/')[1] || 'jpg'
  const fileName = photo.fileName || `vertice-avatar-${Date.now()}.${extension}`
  const uploadFile = {
    uri: photo.uri,
    name: fileName,
    type: photo.mimeType || 'image/jpeg',
  }
  form.append('file', uploadFile as unknown as Blob)

  const uploadResponse = await fetch(intent.upload_url, {
    method: 'POST',
    body: form,
  })
  if (!uploadResponse.ok) {
    throw Object.assign(new Error('La foto no pudo cargarse al almacenamiento seguro.'), {
      code: 'CIVIC_AVATAR_DIRECT_UPLOAD_FAILED',
    })
  }

  return apiFetch<CivicAvatarState>('/community/profile/me/avatar/confirm', {
    method: 'POST',
    body: JSON.stringify({
      asset_id: intent.asset_id,
      policy_attestation: true,
      // React Native has no built-in FaceDetector API (unlike the web upload
      // flow, which uses the browser's native FaceDetector when available).
      // Reporting this honestly keeps ConfirmCivicAvatarSchema's face-count
      // check inapplicable instead of faking a detector result.
      client_checks: {
        width: photo.width,
        height: photo.height,
        face_detector_available: false,
        face_count: null,
      },
    }),
  })
}

export async function removeCivicAvatar(): Promise<CivicAvatarState> {
  return apiFetch<CivicAvatarState>('/community/profile/me/avatar', { method: 'DELETE' })
}

export async function getCivicAvatarState(): Promise<CivicAvatarState> {
  return apiFetch<CivicAvatarState>('/community/profile/me/avatar')
}
