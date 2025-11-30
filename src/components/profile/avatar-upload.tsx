'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

interface AvatarUploadProps {
  userId: string
  currentAvatarUrl: string | null
  email: string | undefined
  fullName: string | undefined
  onUploadComplete: (url: string) => void
}

// Generate Gravatar URL from email using MD5-like hash
function getGravatarUrl(email: string, size: number = 200): string {
  const hash = email.toLowerCase().trim()
  let hashCode = 0
  for (let i = 0; i < hash.length; i++) {
    hashCode = hash.charCodeAt(i) + ((hashCode << 5) - hashCode)
  }
  const hashHex = Math.abs(hashCode).toString(16).padStart(32, '0').slice(0, 32)
  return `https://www.gravatar.com/avatar/${hashHex}?s=${size}&d=identicon`
}

export function AvatarUpload({
  userId,
  currentAvatarUrl,
  email,
  fullName,
  onUploadComplete,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Determine which avatar to display
  const gravatarUrl = email ? getGravatarUrl(email) : null
  const displayUrl = previewUrl || currentAvatarUrl || gravatarUrl

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB')
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        console.error('Upload error details:', uploadError)
        // Handle common storage errors
        if (uploadError.message.includes('bucket') || uploadError.message.includes('Bucket not found')) {
          throw new Error('Avatar storage is not configured. Please run the storage migration.')
        }
        if (uploadError.message.includes('row-level security') || uploadError.message.includes('policy')) {
          throw new Error('Storage permission denied. Please check RLS policies.')
        }
        if (uploadError.message.includes('exceeded') || uploadError.message.includes('size')) {
          throw new Error('File size exceeds the limit. Please use a smaller image.')
        }
        throw new Error(uploadError.message || 'Failed to upload avatar')
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)

      if (updateError) throw updateError

      onUploadComplete(publicUrl)
    } catch (err) {
      console.error('Error uploading avatar:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload avatar')
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!currentAvatarUrl) return

    setIsUploading(true)
    setError(null)

    try {
      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId)

      if (updateError) throw updateError

      setPreviewUrl(null)
      onUploadComplete('')
    } catch (err) {
      console.error('Error removing avatar:', err)
      setError('Failed to remove avatar')
    } finally {
      setIsUploading(false)
    }
  }

  const initials = fullName?.charAt(0).toUpperCase() || email?.charAt(0).toUpperCase() || 'U'

  return (
    <div className="flex items-start gap-6">
      {/* Avatar Preview */}
      <div className="relative">
        <div className="h-24 w-24 overflow-hidden rounded-full bg-gradient-to-br from-primary to-accent">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={fullName || 'Profile'}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
              {initials}
            </div>
          )}
        </div>
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <span className="material-icons animate-spin text-2xl text-white">sync</span>
          </div>
        )}
      </div>

      {/* Upload Controls */}
      <div className="flex-1 space-y-3">
        <div>
          <h3 className="font-medium">Profile Photo</h3>
          <p className="text-sm text-muted-foreground">
            {currentAvatarUrl
              ? 'You have a custom avatar uploaded'
              : gravatarUrl
              ? 'Using your Gravatar. Upload a custom photo to override.'
              : 'Upload a profile photo'}
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <span className="material-icons text-sm">error</span>
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <span className="material-icons text-lg">upload</span>
            {currentAvatarUrl ? 'Change Photo' : 'Upload Photo'}
          </button>

          {currentAvatarUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              disabled={isUploading}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
            >
              <span className="material-icons text-lg">delete</span>
              Remove
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Recommended: Square image, at least 200x200 pixels. Max 2MB.
        </p>
      </div>
    </div>
  )
}
