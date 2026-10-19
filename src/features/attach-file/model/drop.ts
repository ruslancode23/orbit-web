import { useState, type ClipboardEvent, type DragEvent } from 'react'

const carriesFiles = (event: DragEvent): boolean => event.dataTransfer.types.includes('Files')

/**
 * Drag-and-drop of files onto an area. `dragging` lets the area say it will
 * take them; text or links dragged over it are left alone.
 */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false)

  return {
    dragging,
    dropProps: {
      onDragOver: (event: DragEvent) => {
        if (!carriesFiles(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
        setDragging(true)
      },
      onDragLeave: (event: DragEvent) => {
        // Moving onto a child fires a leave too; only leaving the area counts.
        const next = event.relatedTarget
        if (next instanceof Node && event.currentTarget.contains(next)) return
        setDragging(false)
      },
      onDrop: (event: DragEvent) => {
        if (!carriesFiles(event)) return
        event.preventDefault()
        setDragging(false)
        onFiles([...event.dataTransfer.files])
      },
    },
  }
}

/** Files pasted from the clipboard, such as a screenshot; empty for plain text. */
export function pastedFiles(event: ClipboardEvent): File[] {
  return [...event.clipboardData.files]
}
