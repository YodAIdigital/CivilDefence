/**
 * DOCX Parser using officeparser
 * Extracts text content from Word documents
 */

import officeParser from 'officeparser'
import type { ParsedDocument } from '../types'

export async function parseDocx(buffer: ArrayBuffer): Promise<ParsedDocument> {
  try {
    // Convert ArrayBuffer to Buffer for officeparser
    const nodeBuffer = Buffer.from(buffer)

    // Extract text from DOCX
    const text = await officeParser.parseOfficeAsync(nodeBuffer)

    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in document')
    }

    // Try to extract document structure (paragraphs as pseudo-pages)
    const paragraphs = text
      .split(/\n{2,}/)
      .filter((p: string) => p.trim().length > 0)

    // Group paragraphs into logical "pages" (approximately 3000 chars each)
    const pages: { pageNumber: number; text: string }[] = []
    let currentPage = ''
    let pageNumber = 1

    for (const paragraph of paragraphs) {
      if (currentPage.length + paragraph.length > 3000 && currentPage.length > 0) {
        pages.push({
          pageNumber,
          text: currentPage.trim(),
        })
        pageNumber++
        currentPage = paragraph
      } else {
        currentPage += (currentPage ? '\n\n' : '') + paragraph
      }
    }

    // Add the last page
    if (currentPage.trim().length > 0) {
      pages.push({
        pageNumber,
        text: currentPage.trim(),
      })
    }

    return {
      text: text.trim(),
      pages,
      metadata: {
        pageCount: pages.length,
      },
    }
  } catch (error) {
    console.error('[DOCX Parser] Error parsing DOCX:', error)
    throw new Error(
      `Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
