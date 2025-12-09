/**
 * PDF Parser using unpdf
 * Extracts text content from PDF documents
 */

import { extractText, getDocumentProxy } from 'unpdf'
import type { ParsedDocument } from '../types'

export async function parsePdf(buffer: ArrayBuffer): Promise<ParsedDocument> {
  try {
    // Create a copy of the buffer to avoid detached ArrayBuffer issues
    const bufferCopy = buffer.slice(0)
    const uint8Array = new Uint8Array(bufferCopy)

    // Get document proxy for metadata
    const pdf = await getDocumentProxy(uint8Array)

    // Extract text from all pages (create fresh copy for each operation)
    const { text, totalPages } = await extractText(new Uint8Array(buffer.slice(0)), {
      mergePages: true,
    })

    // Extract page-by-page text for better chunking
    const pages: { pageNumber: number; text: string }[] = []

    // Extract text without merging to get page-by-page text
    const pageResult = await extractText(new Uint8Array(buffer.slice(0)), {
      mergePages: false,
    })

    if (pageResult.text) {
      // When mergePages is false, text is an array of strings (one per page)
      const pageTexts = Array.isArray(pageResult.text) ? pageResult.text : [pageResult.text]
      pageTexts.forEach((pageText, index) => {
        if (pageText.trim()) {
          pages.push({
            pageNumber: index + 1,
            text: pageText.trim(),
          })
        }
      })
    }

    // If page splitting didn't work, just use the full text
    if (pages.length === 0 && text) {
      pages.push({
        pageNumber: 1,
        text: text.trim(),
      })
    }

    // Get metadata if available
    let metadata: ParsedDocument['metadata'] = {
      pageCount: totalPages,
    }

    try {
      const pdfMetadata = await pdf.getMetadata()
      if (pdfMetadata?.info) {
        const info = pdfMetadata.info as Record<string, unknown>
        const title = info.Title as string | undefined
        const author = info.Author as string | undefined
        const createdAt = info.CreationDate as string | undefined
        metadata = {
          ...metadata,
          ...(title && { title }),
          ...(author && { author }),
          ...(createdAt && { createdAt }),
        }
      }
    } catch {
      // Metadata extraction failed, continue with basic metadata
    }

    return {
      text: text || pages.map(p => p.text).join('\n\n'),
      pages,
      metadata,
    }
  } catch (error) {
    console.error('[PDF Parser] Error parsing PDF:', error)
    throw new Error(
      `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
