'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
  readOnly?: boolean
}

function ToolbarBtn({
  onClick, active, title, children,
}: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-primary text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = '180px', readOnly = false }: Props) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ underline: false }), Underline],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'focus:outline-none prose prose-sm max-w-none px-3 py-3 text-sm text-gray-800',
        style: `min-height:${minHeight}`,
      },
    },
    immediatelyRender: false,
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    if (editor) editor.setEditable(!readOnly)
  }, [readOnly, editor])

  if (!editor) return null

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-shadow bg-white ${readOnly ? 'opacity-75 cursor-default' : ''}`}>
      {!readOnly && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita (Ctrl+B)">
            <span className="text-[13px] font-bold w-5 h-5 flex items-center justify-center">B</span>
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva (Ctrl+I)">
            <span className="text-[13px] italic w-5 h-5 flex items-center justify-center">I</span>
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado (Ctrl+U)">
            <span className="text-[13px] underline w-5 h-5 flex items-center justify-center">U</span>
          </ToolbarBtn>
          <div className="w-px h-4 bg-gray-200 mx-1.5" />
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista de viñetas">
            <span className="material-symbols-outlined text-[17px] w-5 h-5 flex items-center justify-center">format_list_bulleted</span>
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
            <span className="material-symbols-outlined text-[17px] w-5 h-5 flex items-center justify-center">format_list_numbered</span>
          </ToolbarBtn>
          <div className="w-px h-4 bg-gray-200 mx-1.5" />
          <ToolbarBtn onClick={() => editor.chain().focus().setHardBreak().run()} active={false} title="Salto de línea (Shift+Enter)">
            <span className="material-symbols-outlined text-[17px] w-5 h-5 flex items-center justify-center">keyboard_return</span>
          </ToolbarBtn>
        </div>
      )}
      <div className="relative">
        {editor.isEmpty && placeholder && (
          <p className="absolute top-3 left-3 text-gray-400 text-sm pointer-events-none select-none leading-relaxed">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
