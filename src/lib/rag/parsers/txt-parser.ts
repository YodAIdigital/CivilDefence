/**
 * Plain Text Parser
 * Handles .txt files with structure detection
 */

import type { ParsedDocument } from '../types'

export async function parseTxt(buffer: ArrayBuffer): Promise<ParsedDocument> {
  try {
    // Decode buffer to text
    const decoder = new TextDecoder('utf-8')
    const text = decoder.decode(buffer)

    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in file')
    }

    // Try to detect section breaks and create logical "pages"
    // Common section separators: multiple newlines, horizontal rules, numbered headings
    const sections = text
      .split(/(?:\n{3,}|(?:^|\n)(?:={3,}|-{3,}|\*{3,})(?:\n|$))/)
      .filter(s => s.trim().length > 0)

    // Group into pages of approximately 3000 characters
    const pages: { pageNumber: number; text: string }[] = []
    let currentPage = ''
    let pageNumber = 1

    for (const section of sections) {
      if (currentPage.length + section.length > 3000 && currentPage.length > 0) {
        pages.push({
          pageNumber,
          text: currentPage.trim(),
        })
        pageNumber++
        currentPage = section
      } else {
        currentPage += (currentPage ? '\n\n' : '') + section
      }
    }

    // Add the last page
    if (currentPage.trim().length > 0) {
      pages.push({
        pageNumber,
        text: currentPage.trim(),
      })
    }

    // Try to extract a title from the first line
    const firstLine = text.split('\n')[0]?.trim()
    const title = firstLine && firstLine.length < 200 ? firstLine : undefined

    return {
      text: text.trim(),
      pages,
      metadata: {
        ...(title && { title }),
        pageCount: pages.length,
      },
    }
  } catch (error) {
    console.error('[TXT Parser] Error parsing text file:', error)
    throw new Error(
      `Failed to parse text file: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
