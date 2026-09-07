'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'
import {
  BadgeCheck,
  Building2,
  Camera,
  CheckCircle2,
  ImageUp,
  Loader2,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { CivicAvatar } from '@/components/community/CivicAvatar'

type CivicProfileType = 'citizen' | 'social_leader' | 'candidate' | 'organization_rep' | 'public_official'
type AvatarStatus = 'missing' | 'approved' | 'rejected'

interface CivicProfile {
  citizen_id: string
  display_name: string | null
  neighborhood: string | null
  profile_type: CivicProfileType
  bio: string | null
  organization: string | null
  public_profile: boolean
  reputation_score: number
}

interface CivicAvatarState {
  citizen_id: string
  avatar_url: string | null
  status: AvatarStatus
  updated_at: string | null
  upload_enabled: boolean
}

interface AvatarUploadIntent {
  asset_id: string
  upload_url: string
}

interface PortraitChecks {
  width: number
  height: number
  face_detector_available: boolean
  face_count: number | null
}

interface FaceDetectorLike {
  detect(image: ImageBitmap): Promise<unknown[]>
}

type FaceDetectorConstructor = new (options?: {
  fastMode?: boolean
  maxDetectedFaces?: number
}) => FaceDetectorLike

const PROFILE_TYPES: Array<{ value: CivicProfileType; label: string; description: string }> = [
  { value: 'citizen', label: 'Ciudadanía', description: 'Participación y gestión desde la comunidad.' },
  { value: 'social_leader', label: 'Liderazgo social', description: 'Trabajo comunitario, territorial o colectivo.' },
  { value: 'candidate', label: 'Candidatura', description: 'Persona aspirante a un cargo de elección popular.' },
  { value: 'organization_rep', label: 'Organización', description: 'Representación de una organización o colectivo.' },
  { value: 'public_official', label: 'Gestión pública', description: 'Servidor o representante de una entidad pública.' },
]

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MIN_IMAGE_SIDE = 640

async function readDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const image = new window.Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error('No fue posible leer la imagen seleccionada.'))
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function inspectPortrait(file: File): Promise<PortraitChecks> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Usa una imagen JPEG, PNG o WebP.')
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('La imagen no puede superar 10 MB.')
  }

  const { width, height } = await readDimensions(file)
  if (width < MIN_IMAGE_SIDE || height < MIN_IMAGE_SIDE) {
    throw new Error(`La foto debe tener al menos ${MIN_IMAGE_SIDE} × ${MIN_IMAGE_SIDE} px.`)
  }

  let faceDetectorAvailable = false
  let faceCount: number | null = null
  const browser = window as typeof window & { FaceDetector?: FaceDetectorConstructor }

  if (browser.FaceDetector && typeof createImageBitmap === 'function') {
    faceDetectorAvailable = true
    const bitmap = await createImageBitmap(file)
    try {
      const detector = new browser.FaceDetector({ fastMode: true, maxDetectedFaces: 3 })
      const faces = await detector.detect(bitmap)
      faceCount = faces.length
    } finally {
      bitmap.close()
    }

    if (faceCount !== 1) {
      throw new Error(faceCount === 0
        ? 'No detectamos un rostro claro. Elige una foto frontal y bien iluminada.'
        : 'La foto debe mostrar a una sola persona.')
    }
  }

  return {
    width,
    height,
    face_detector_available: faceDetectorAvailable,
    face_count: faceCount,
  }
}

export default function CivicProfilePage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<CivicProfile | null>(null)
  const [avatar, setAvatar] = useState<CivicAvatarState | null>(null)
  const [profileType, setProfileType] = useState<CivicProfileType>('citizen')
  const [bio, setBio] = useState('')
  const [organization, setOrganization] = useState('')
  const [publicProfile, setPublicProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [portraitChecks, setPortraitChecks] = useState<PortraitChecks | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [portraitMessage, setPortraitMessage] = useState<string | null>(null)
  const [policyAttested, setPolicyAttested] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    Promise.all([
      apiFetch<CivicProfile>('/community/profile/me'),
      apiFetch<CivicAvatarState>('/community/profile/me/avatar'),
    ])
      .then(([profileData, avatarData]) => {
        setProfile(profileData)
        setAvatar(avatarData)
        setProfileType(profileData.profile_type)
        setBio(profileData.bio ?? '')
        setOrganization(profileData.organization ?? '')
        setPublicProfile(profileData.public_profile)
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'No fue posible cargar el perfil.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const updated = await apiFetch<CivicProfile>('/community/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({
          profile_type: profileType,
          bio: bio.trim() || null,
          organization: organization.trim() || null,
          public_profile: publicProfile,
        }),
      })
      setProfile(updated)
      setMessage('Perfil cívico actualizado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No fue posible actualizar el perfil.')
    } finally {
      setSaving(false)
    }
  }

  async function choosePortrait(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setPortraitMessage(null)
    setPolicyAttested(false)
    try {
      const checks = await inspectPortrait(file)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setSelectedFile(file)
      setPortraitChecks(checks)
      setPreviewUrl(URL.createObjectURL(file))
      setPortraitMessage(checks.face_detector_available
        ? 'Foto lista: resolución y rostro único validados en este dispositivo.'
        : 'Foto lista: resolución validada. Confirma que cumple la política de retrato.')
    } catch (error) {
      setSelectedFile(null)
      setPortraitChecks(null)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      setPortraitMessage(error instanceof Error ? error.message : 'La foto seleccionada no cumple los requisitos.')
    }
  }

  async function uploadPortrait() {
    if (!selectedFile || !portraitChecks || !policyAttested) return
    setUploadingAvatar(true)
    setPortraitMessage(null)
    try {
      const intent = await apiFetch<AvatarUploadIntent>('/community/profile/me/avatar/upload-intent', {
        method: 'POST',
      })

      const form = new FormData()
      form.append('file', selectedFile)
      const providerResponse = await fetch(intent.upload_url, {
        method: 'POST',
        body: form,
      })
      if (!providerResponse.ok) {
        throw new Error('La imagen no pudo cargarse. Intenta con otra fotografía.')
      }

      const updated = await apiFetch<CivicAvatarState>('/community/profile/me/avatar/confirm', {
        method: 'POST',
        body: JSON.stringify({
          asset_id: intent.asset_id,
          policy_attestation: true,
          client_checks: portraitChecks,
        }),
      })

      setAvatar(updated)
      setSelectedFile(null)
      setPortraitChecks(null)
      setPolicyAttested(false)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      setPortraitMessage('Foto de perfil actualizada y lista para tu identidad pública.')
    } catch (error) {
      setPortraitMessage(error instanceof Error ? error.message : 'No fue posible actualizar la foto de perfil.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function removePortrait() {
    if (!window.confirm('¿Eliminar tu foto de perfil pública?')) return
    setUploadingAvatar(true)
    setPortraitMessage(null)
    try {
      const updated = await apiFetch<CivicAvatarState>('/community/profile/me/avatar', { method: 'DELETE' })
      setAvatar(updated)
      setSelectedFile(null)
      setPortraitChecks(null)
      setPolicyAttested(false)
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
      }
      setPortraitMessage('Foto de perfil eliminada.')
    } catch (error) {
      setPortraitMessage(error instanceof Error ? error.message : 'No fue posible eliminar la foto.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[#4A90E2]" /></div>
  }

  const portraitSrc = previewUrl ?? avatar?.avatar_url ?? null

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <section className="rounded-[26px] border border-[#DCE5EF] bg-white p-5 shadow-[0_16px_45px_rgba(10,42,102,.06)] sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#7B8799]">Identidad social pública</div>
            <h1 className="mt-2 text-2xl font-extrabold text-[#0A2A66] sm:text-3xl">Configura cómo apareces en la red cívica.</h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-[#607087]">
              Tu tipo de perfil y tu retrato describen tu presencia pública, pero no modifican tus permisos ni sustituyen la verificación de identidad de VÉRTICE.
            </p>
          </div>
          <div className="rounded-2xl bg-[#EDF3FA] px-4 py-3 text-right">
            <div className="text-[9px] font-extrabold uppercase tracking-[.12em] text-[#7B8799]">Reputación actual</div>
            <div className="mt-1 text-2xl font-extrabold text-[#0A2A66]">{Math.round(profile?.reputation_score ?? 0)}</div>
          </div>
        </div>

        <div className="mt-7 rounded-[22px] border border-[#DCE5EF] bg-[#F8FAFD] p-4 sm:p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <CivicAvatar src={portraitSrc} name={profile?.display_name} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#607087]">Foto de identidad pública</div>
                {avatar?.status === 'approved' && !selectedFile && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF6ED] px-2.5 py-1 text-[9px] font-extrabold text-[#237D36]"><CheckCircle2 size={11} /> Publicada</span>
                )}
              </div>
              <p className="mt-2 max-w-2xl text-xs font-medium leading-6 text-[#607087]">
                Usa una fotografía reciente donde aparezcas tú, con un solo rostro claramente visible. Se mostrará en tu perfil, feed y ranking cívico cuando tu perfil sea público.
              </p>

              <div className="mt-3 grid gap-2 text-[10px] font-semibold leading-5 text-[#607087] sm:grid-cols-2">
                <span>• JPEG, PNG o WebP · máximo 10 MB</span>
                <span>• Mínimo 640 × 640 px</span>
                <span>• Rostro visible, nítido y bien iluminado</span>
                <span>• Sin grupos, logos, dibujos ni filtros extremos</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={choosePortrait}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar || avatar?.upload_enabled === false}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0A2A66] px-4 text-[10px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ImageUp size={14} /> {avatar?.avatar_url ? 'Cambiar foto' : 'Seleccionar foto'}
                </button>
                {avatar?.avatar_url && (
                  <button
                    type="button"
                    onClick={removePortrait}
                    disabled={uploadingAvatar}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E3C7CB] bg-white px-4 text-[10px] font-extrabold text-[#A91D2E] disabled:opacity-50"
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                )}
              </div>

              {avatar?.upload_enabled === false && (
                <div className="mt-3 rounded-xl border border-[#F0D99B] bg-[#FFF8E5] px-3 py-2 text-[10px] font-semibold leading-5 text-[#806210]">
                  La carga de imágenes está temporalmente deshabilitada. El resto del perfil puede editarse normalmente.
                </div>
              )}

              {selectedFile && portraitChecks && (
                <div className="mt-4 rounded-2xl border border-[#C9D8EA] bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#0A2A66]"><Camera size={14} /> Confirmar retrato</div>
                  <div className="mt-2 text-[10px] font-semibold text-[#607087]">
                    {portraitChecks.width} × {portraitChecks.height} px · {selectedFile.type.replace('image/', '').toUpperCase()} · {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={policyAttested}
                      onChange={(event) => setPolicyAttested(event.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="text-[10px] font-semibold leading-5 text-[#526176]">
                      Confirmo que esta fotografía me representa, muestra un solo rostro claramente visible y no utiliza suplantación, logo, ilustración ni alteraciones que impidan reconocerme.
                    </span>
                  </label>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[9px] font-semibold text-[#7B8799]">No se crea ni almacena una plantilla biométrica con esta carga.</span>
                    <button
                      type="button"
                      onClick={uploadPortrait}
                      disabled={!policyAttested || uploadingAvatar}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#246CB6] px-4 text-[10px] font-extrabold text-white disabled:opacity-50"
                    >
                      {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                      Usar esta foto
                    </button>
                  </div>
                </div>
              )}

              {portraitMessage && (
                <div className="mt-3 text-[10px] font-semibold leading-5 text-[#526176]">{portraitMessage}</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {PROFILE_TYPES.map((option) => {
            const selected = option.value === profileType
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setProfileType(option.value)}
                className={selected
                  ? 'rounded-2xl border border-[#4A90E2] bg-[#EDF3FA] p-4 text-left shadow-sm'
                  : 'rounded-2xl border border-[#E1E7EF] bg-white p-4 text-left hover:bg-[#F7F9FC]'}
              >
                <div className="flex items-center gap-2">
                  {option.value === 'organization_rep' ? <Building2 size={16} /> : option.value === 'candidate' ? <BadgeCheck size={16} /> : <UserRound size={16} />}
                  <span className="text-xs font-extrabold text-[#0A2A66]">{option.label}</span>
                </div>
                <p className="mt-2 text-[10px] font-medium leading-5 text-[#607087]">{option.description}</p>
              </button>
            )
          })}
        </div>

        <div className="mt-6 grid gap-5">
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[.11em] text-[#607087]">Biografía de gestión</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={600}
              rows={5}
              placeholder="Describe tu trabajo comunitario, territorio, experiencia y áreas de acción."
              className="mt-2 w-full rounded-2xl border border-[#DCE5EF] bg-[#FBFCFE] px-4 py-3 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]"
            />
            <div className="mt-1 text-right text-[9px] font-semibold text-[#94A0B0]">{bio.length}/600</div>
          </label>

          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[.11em] text-[#607087]">Organización o colectivo</span>
            <input
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
              maxLength={180}
              placeholder="Opcional"
              className="mt-2 h-12 w-full rounded-2xl border border-[#DCE5EF] bg-[#FBFCFE] px-4 text-sm text-[#0A2A66] outline-none focus:border-[#4A90E2]"
            />
          </label>
        </div>

        <div className="mt-6 rounded-2xl border border-[#DCE5EF] bg-[#F7F9FC] p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={publicProfile}
              onChange={(event) => setPublicProfile(event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <div>
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#0A2A66]"><ShieldCheck size={15} /> Publicar mi perfil cívico</div>
              <p className="mt-1 text-[10px] font-medium leading-5 text-[#607087]">
                Al activarlo, tu nombre, foto aprobada, tipo de perfil, organización, territorio y métricas de gestión podrán aparecer en el feed y rankings. Si lo desactivas, tus acciones públicas siguen visibles pero tu identidad se presenta de forma anónima y no participas en rankings personales.
              </p>
            </div>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E9EDF3] pt-5">
          <div className="text-xs font-semibold text-[#607087]">{message ?? (publicProfile ? 'Tu perfil será visible cuando guardes.' : 'Tu identidad permanece anónima en la red pública.')}</div>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0A2A66] px-5 py-2.5 text-xs font-extrabold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Guardar perfil
          </button>
        </div>
      </section>
    </div>
  )
}
