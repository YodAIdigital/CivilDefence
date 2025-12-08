'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Copy,
  Check,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Share2,
  Download,
  X
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { WizardData } from '../onboarding-wizard'

interface StepSixProps {
  data: WizardData
  updateData: (updates: Partial<WizardData>) => void
  communityId?: string | undefined // The newly created community ID for signup link
}

const STYLE_OPTIONS = [
  { value: 'community', label: 'Community', description: 'Warm, welcoming' },
  { value: 'professional', label: 'Professional', description: 'Trust-inspiring' },
  { value: 'emergency', label: 'Emergency', description: 'Safety theme' },
  { value: 'modern', label: 'Modern', description: 'Minimalist' },
] as const

export function StepSix({ data, updateData, communityId }: StepSixProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  // Initialize from saved data if available
  const [selectedStyle, setSelectedStyle] = useState<string>(data.facebookPromo?.style || 'community')
  const [generatedPost, setGeneratedPost] = useState<string | null>(data.facebookPromo?.post || null)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(data.facebookPromo?.imageUrl || null)
  const [copiedText, setCopiedText] = useState(false)
  const [copiedImage, setCopiedImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  const handleGeneratePromo = async () => {
    setIsGenerating(true)
    setError(null)
    setImageError(false)

    try {
      // Generate signup link for the community
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://civildefence.pro'
      const signupLink = communityId
        ? `${baseUrl}/community/${communityId}`
        : `${baseUrl}/community`

      const response = await fetch('/api/generate-promo-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityName: data.communityName,
          location: data.location || data.meetingPointAddress || 'your area',
          description: data.description,
          style: selectedStyle,
          signupLink,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate promotional content')
      }

      const result = await response.json()
      setGeneratedPost(result.suggestedPost)
      setGeneratedImageUrl(result.imageUrl)

      updateData({
        facebookPromo: {
          post: result.suggestedPost,
          imageUrl: result.imageUrl,
          style: selectedStyle,
        }
      } as Partial<WizardData>)
    } catch (err) {
      console.error('Error generating promo:', err)
      setError('Failed to generate promotional content. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyPost = async () => {
    if (generatedPost) {
      await navigator.clipboard.writeText(generatedPost)
      setCopiedText(true)
      setTimeout(() => setCopiedText(false), 2000)
    }
  }

  const handleCopyImage = async () => {
    if (generatedImageUrl) {
      try {
        // For base64 data URLs, we need to convert to blob manually
        if (generatedImageUrl.startsWith('data:')) {
          // Extract the base64 data
          const [, base64Data] = generatedImageUrl.split(',')

          // Convert base64 to binary
          const binaryString = atob(base64Data || '')
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }

          // Create blob - clipboard requires image/png specifically
          const blob = new Blob([bytes], { type: 'image/png' })

          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ])
        } else {
          // For regular URLs, fetch and copy
          const response = await fetch(generatedImageUrl)
          const blob = await response.blob()
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ])
        }
        setCopiedImage(true)
        setTimeout(() => setCopiedImage(false), 2000)
      } catch (err) {
        console.error('Failed to copy image:', err)
        setError('Failed to copy image to clipboard. Try downloading instead.')
        setTimeout(() => setError(null), 3000)
      }
    }
  }

  const handleShareToFacebook = () => {
    const text = encodeURIComponent(generatedPost || '')
    window.open(
      `https://www.facebook.com/sharer/sharer.php?quote=${text}`,
      '_blank',
      'width=600,height=400'
    )
  }

  const handlePostTextChange = (newText: string) => {
    setGeneratedPost(newText)
  }

  const handleImageClick = () => {
    if (generatedImageUrl && !imageError) {
      setShowLightbox(true)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Promote Your Community</h3>

      {/* 1/3 - 2/3 Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Column - Style Selection & Generate (1/3) */}
        <div className="space-y-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-3">Choose a style:</p>
            <div className="flex flex-col gap-2">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedStyle(option.value)}
                  className={`p-2 rounded-lg border-2 text-left transition-all ${
                    selectedStyle === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs">{option.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {option.description}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <Button
              onClick={handleGeneratePromo}
              disabled={isGenerating || !data.communityName}
              className="w-full mt-4"
              size="sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {generatedPost ? 'Regenerate' : 'Generate'}
                </>
              )}
            </Button>
          </Card>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Right Column - Image & Post Preview (2/3) */}
        <div className="md:col-span-2 space-y-3">
          {/* Image Preview - Clickable */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Generated Image</span>
              </div>
              {generatedImageUrl && !imageError && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={generatedImageUrl} download="community-promo.png" target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
            <div
              className={`relative aspect-square max-w-xs mx-auto rounded-lg overflow-hidden border bg-muted ${
                generatedImageUrl && !imageError ? 'cursor-pointer hover:ring-2 hover:ring-primary transition-all' : ''
              }`}
              onClick={handleImageClick}
            >
              {generatedImageUrl && !imageError ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={generatedImageUrl}
                  alt="Generated promotional image - click to enlarge"
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mb-2 opacity-30" />
                  <p className="text-sm">
                    {imageError ? 'Image failed to load' : 'Image preview'}
                  </p>
                </div>
              )}
            </div>
            {generatedImageUrl && !imageError && (
              <p className="text-xs text-muted-foreground text-center mt-2">Click image to preview</p>
            )}
          </Card>

          {/* Post Text */}
          <Card className="p-4">
            <Textarea
              value={generatedPost || ''}
              onChange={(e) => handlePostTextChange(e.target.value)}
              rows={5}
              className="font-sans text-sm resize-none border-0 p-0 focus-visible:ring-0"
              placeholder="Your generated post will appear here..."
              disabled={!generatedPost}
            />
          </Card>

          {/* Actions - 3 buttons: Copy Image, Copy Text, Share */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCopyImage}
              disabled={!generatedImageUrl || imageError}
              className="flex-1"
              size="sm"
            >
              {copiedImage ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Copy Image
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyPost}
              disabled={!generatedPost}
              className="flex-1"
              size="sm"
            >
              {copiedText ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Text
                </>
              )}
            </Button>
            <Button
              onClick={handleShareToFacebook}
              disabled={!generatedPost}
              className="flex-1 bg-[#1877F2] hover:bg-[#166FE5] disabled:bg-[#1877F2]/50"
              size="sm"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {showLightbox && generatedImageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <div
            className="relative max-w-3xl w-full bg-background rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Image */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedImageUrl}
                alt="Generated promotional image"
                className="w-full h-auto max-h-[60vh] object-contain bg-black"
              />
            </div>

            {/* Post text below image */}
            {generatedPost && (
              <div className="p-4 border-t bg-muted/50 max-h-[30vh] overflow-y-auto">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Post Text:</p>
                <div className="text-sm whitespace-pre-wrap">{generatedPost}</div>
              </div>
            )}

            {/* Action buttons */}
            <div className="p-4 border-t flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={handleCopyImage}
                size="sm"
              >
                {copiedImage ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Copy Image
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyPost}
                disabled={!generatedPost}
                size="sm"
              >
                {copiedText ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Text
                  </>
                )}
              </Button>
              <Button asChild size="sm">
                <a href={generatedImageUrl} download="community-promo.png" target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
