'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, useRole } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Loader2,
  Upload,
  Trash2,
  RefreshCw,
  FileText,
  Image,
  File,
  AlertCircle,
  Check,
  Database,
  Sparkles,
  Play,
  X,
} from 'lucide-react'
import type { TrainingDocument } from '@/types/database'

interface DocumentWithUploader extends TrainingDocument {
  profiles?: {
    full_name: string | null
    email: string
  }
}

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-5 w-5 text-red-500" />,
  docx: <FileText className="h-5 w-5 text-blue-500" />,
  txt: <File className="h-5 w-5 text-gray-500" />,
  image: <Image className="h-5 w-5 text-green-500" />,
}

const STATUS_BADGES: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pending: { variant: 'outline', label: 'Pending' },
  processing: { variant: 'secondary', label: 'Processing' },
  ready: { variant: 'default', label: 'Ready' },
  error: { variant: 'destructive', label: 'Error' },
}

const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function TrainingDocumentsPage() {
  const router = useRouter()
  const { isLoading: isAuthLoading } = useAuth()
  const { isSuperAdmin } = useRole()

  // Redirect if not super admin
  useEffect(() => {
    if (!isAuthLoading && !isSuperAdmin) {
      router.push('/dashboard')
    }
  }, [isAuthLoading, isSuperAdmin, router])

  const [documents, setDocuments] = useState<DocumentWithUploader[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Upload state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Delete state
  const [deleteDocument, setDeleteDocument] = useState<DocumentWithUploader | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Processing state
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Get auth token
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  // Load documents
  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/admin/training-documents', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load documents')
      }

      setDocuments(data.documents)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSuperAdmin) {
      loadDocuments()
    }
  }, [isSuperAdmin, loadDocuments])

  // Handle file selection
  const handleFileSelect = (file: File) => {
    setUploadError(null)

    // Validate file type
    const validTypes = Object.keys(ACCEPTED_FILE_TYPES)
    if (!validTypes.includes(file.type)) {
      setUploadError('Unsupported file type. Please upload PDF, DOCX, TXT, or images.')
      return
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File size exceeds 50MB limit.')
      return
    }

    setUploadFile(file)
    if (!uploadName) {
      setUploadName(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Upload document
  const handleUpload = async () => {
    if (!uploadFile) return

    try {
      setIsUploading(true)
      setUploadError(null)

      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('name', uploadName || uploadFile.name)
      if (uploadDescription) {
        formData.append('description', uploadDescription)
      }

      const response = await fetch('/api/admin/training-documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload document')
      }

      setSuccessMessage('Document uploaded successfully')
      setIsUploadOpen(false)
      resetUploadForm()
      loadDocuments()

      // Auto-trigger processing
      if (data.document?.id) {
        handleProcess(data.document.id)
      }

      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload document')
    } finally {
      setIsUploading(false)
    }
  }

  // Reset upload form
  const resetUploadForm = () => {
    setUploadFile(null)
    setUploadName('')
    setUploadDescription('')
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Process document
  const handleProcess = async (documentId: string) => {
    try {
      setProcessingId(documentId)

      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/admin/training-documents/${documentId}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start processing')
      }

      setSuccessMessage('Processing started')
      setTimeout(() => setSuccessMessage(null), 3000)

      // Poll for status updates
      pollDocumentStatus(documentId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing')
    } finally {
      setProcessingId(null)
    }
  }

  // Poll document status
  const pollDocumentStatus = (documentId: string) => {
    const pollInterval = setInterval(async () => {
      const token = await getAuthToken()
      if (!token) {
        clearInterval(pollInterval)
        return
      }

      try {
        const response = await fetch(`/api/admin/training-documents/${documentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        const data = await response.json()

        if (data.document?.status === 'ready' || data.document?.status === 'error') {
          clearInterval(pollInterval)
          loadDocuments()
        } else {
          // Update local state
          setDocuments(prev =>
            prev.map(doc =>
              doc.id === documentId ? { ...doc, status: data.document?.status } : doc
            )
          )
        }
      } catch {
        clearInterval(pollInterval)
      }
    }, 2000)

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000)
  }

  // Delete document
  const handleDelete = async () => {
    if (!deleteDocument) return

    try {
      setIsDeleting(true)

      const token = await getAuthToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(`/api/admin/training-documents/${deleteDocument.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete document')
      }

      setSuccessMessage('Document deleted successfully')
      setDeleteDocument(null)
      loadDocuments()

      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document')
    } finally {
      setIsDeleting(false)
    }
  }

  // Show loading while auth is checking or if not super admin
  if (isAuthLoading || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const readyCount = documents.filter(d => d.status === 'ready').length
  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0)
  const totalTokens = documents.reduce((sum, d) => sum + (d.total_tokens || 0), 0)

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Training Documents</h1>
          <p className="text-muted-foreground">
            Upload documents to train the AI assistant with custom knowledge.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDocuments}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{readyCount}</p>
                <p className="text-sm text-muted-foreground">Ready Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalChunks.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Chunks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <Sparkles className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(totalTokens / 1000).toFixed(1)}K</p>
                <p className="text-sm text-muted-foreground">Total Tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
          <Check className="h-4 w-4" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Manage your training documents. Documents are processed into chunks and embedded for semantic search.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Database className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No documents yet</h3>
              <p className="text-muted-foreground max-w-sm mt-1">
                Upload PDF, DOCX, TXT, or image files to add training data for the AI assistant.
              </p>
              <Button className="mt-4" onClick={() => setIsUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    {FILE_TYPE_ICONS[doc.file_type] || <File className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium truncate">{doc.name}</h4>
                      <Badge variant={STATUS_BADGES[doc.status]?.variant || 'outline'}>
                        {doc.status === 'processing' && (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        )}
                        {STATUS_BADGES[doc.status]?.label || doc.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span>{formatFileSize(doc.file_size)}</span>
                      {doc.chunk_count && doc.chunk_count > 0 && (
                        <span>{doc.chunk_count} chunks</span>
                      )}
                      {doc.total_tokens && doc.total_tokens > 0 && (
                        <span>{(doc.total_tokens / 1000).toFixed(1)}K tokens</span>
                      )}
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                    {doc.description && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {doc.description}
                      </p>
                    )}
                    {doc.status === 'error' && doc.error_message && (
                      <p className="text-sm text-destructive mt-1">
                        Error: {doc.error_message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(doc.status === 'pending' || doc.status === 'error') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProcess(doc.id)}
                        disabled={processingId === doc.id}
                      >
                        {processingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        <span className="ml-2 hidden sm:inline">Process</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteDocument(doc)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => {
        setIsUploadOpen(open)
        if (!open) resetUploadForm()
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Training Document</DialogTitle>
            <DialogDescription>
              Upload a document to add to the AI knowledge base.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Drag and Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : uploadFile
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={Object.entries(ACCEPTED_FILE_TYPES)
                  .flatMap(([mime, exts]) => [mime, ...exts])
                  .join(',')}
                onChange={handleFileInputChange}
                className="hidden"
              />

              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  {FILE_TYPE_ICONS[Object.keys(ACCEPTED_FILE_TYPES).includes(uploadFile.type)
                    ? uploadFile.type === 'application/pdf' ? 'pdf'
                    : uploadFile.type.includes('word') ? 'docx'
                    : uploadFile.type.includes('text') ? 'txt'
                    : 'image'
                    : 'txt'
                  ] || <File className="h-8 w-8" />}
                  <div className="text-left">
                    <p className="font-medium truncate max-w-[200px]">{uploadFile.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(uploadFile.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      setUploadFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">Drop file here or click to browse</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    PDF, DOCX, TXT, JPEG, PNG, WebP (max 50MB)
                  </p>
                </div>
              )}
            </div>

            {/* Name and Description */}
            <div className="space-y-2">
              <Label htmlFor="doc-name">Document Name</Label>
              <Input
                id="doc-name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Enter a name for this document"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-description">Description (optional)</Label>
              <Textarea
                id="doc-description"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="What is this document about?"
                rows={2}
              />
            </div>

            {uploadError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUploadOpen(false)
                resetUploadForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload & Process
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDocument} onOpenChange={(open) => !open && setDeleteDocument(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteDocument?.name}&rdquo;? This will remove the document and all its processed chunks from the knowledge base. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDocument(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
