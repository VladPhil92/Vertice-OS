import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { apiFetch } from './api'
import type { ReportMediaState, ReportMediaUploadIntent } from '../types/api'

export interface DeviceCoordinates {
  lat: number
  lng: number
  accuracy: number | null
}

export interface SelectedReportEvidence {
  uri: string
  fileName: string | null
  mimeType: string | null
  width: number
  height: number
}

export async function getCurrentReportCoordinates(): Promise<DeviceCoordinates> {
  const permission = await Location.requestForegroundPermissionsAsync()
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    throw Object.assign(new Error('Necesitamos permiso de ubicación para usar tu posición actual en el reporte.'), {
      code: 'LOCATION_PERMISSION_DENIED',
    })
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  })

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
  }
}

export async function selectReportEvidence(
  source: 'camera' | 'library',
): Promise<SelectedReportEvidence | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      throw Object.assign(new Error('Debes autorizar la cámara para capturar evidencia.'), {
        code: 'CAMERA_PERMISSION_DENIED',
      })
    }
  } else {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      throw Object.assign(new Error('Debes autorizar el acceso a fotos para seleccionar evidencia.'), {
        code: 'PHOTO_LIBRARY_PERMISSION_DENIED',
      })
    }
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
    exif: false,
  }

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options)

  if (result.canceled || !result.assets[0]) return null

  const asset = result.assets[0]
  return {
    uri: asset.uri,
    fileName: asset.fileName ?? null,
    mimeType: asset.mimeType ?? null,
    width: asset.width,
    height: asset.height,
  }
}

export async function uploadAndConfirmReportEvidence(
  evidence: SelectedReportEvidence,
): Promise<ReportMediaState> {
  const intent = await apiFetch<ReportMediaUploadIntent>('/territorial/media/upload-intent', {
    method: 'POST',
  })

  const form = new FormData()
  const extension = evidence.mimeType?.split('/')[1] || 'jpg'
  const fileName = evidence.fileName || `vertice-report-${Date.now()}.${extension}`
  const uploadFile = {
    uri: evidence.uri,
    name: fileName,
    type: evidence.mimeType || 'image/jpeg',
  }

  form.append('file', uploadFile as unknown as Blob)

  const uploadResponse = await fetch(intent.upload_url, {
    method: 'POST',
    body: form,
  })
  if (!uploadResponse.ok) {
    throw Object.assign(new Error('La evidencia no pudo cargarse al almacenamiento seguro.'), {
      code: 'REPORT_MEDIA_DIRECT_UPLOAD_FAILED',
    })
  }

  return apiFetch<ReportMediaState>('/territorial/media/confirm', {
    method: 'POST',
    body: JSON.stringify({ media_asset_id: intent.media_asset_id }),
  })
}
