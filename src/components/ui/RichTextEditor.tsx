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
  // 'nota': skin pixel-perfect del diseño de nota clínica por especialidad
  // (toolbar .tb de 26px, 6º botón "deshacer" en vez de "salto de línea").
  // Por defecto ('default') el comportamiento y el aspecto no cambian —
  // los demás consumidores (NuevoInformeSlide, NuevaNotaHistorialForm,
  // NotaContenido, NotaDetalleEditor) no pasan esta prop.
  variant?: 'default' | 'nota'
}

function ToolbarBtn({
  onClick, active, title, children, variant,
}: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
  variant: 'default' | 'nota'
}) {
  if (variant === 'nota') {
    return (
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); onClick() }}
        title={title}
        className={active ? 'on' : ''}
      >
        {children}
      </button>
    )
  }
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

export default function RichTextEditor({ value, onChange, placeholder, minHeight = '180px', readOnly = false, variant = 'default' }: Props) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ underline: false }), Underline],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: variant === 'nota'
          ? 'ns-editor-content focus:outline-none prose prose-sm max-w-none text-sm text-gray-800'
          : 'focus:outline-none prose prose-sm max-w-none px-3 py-3 text-sm text-gray-800',
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

  if (variant === 'nota') {
    return (
      <div className="relative">
        {!readOnly && (
          <div className="tb">
            <ToolbarBtn variant="nota" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita (Ctrl+B)">
              <span style={{ fontWeight: 700, fontSize: 13 }}>B</span>
            </ToolbarBtn>
            <ToolbarBtn variant="nota" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva (Ctrl+I)">
              <span style={{ fontStyle: 'italic', fontSize: 13 }}>I</span>
            </ToolbarBtn>
            <ToolbarBtn variant="nota" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado (Ctrl+U)">
              <span style={{ textDecoration: 'underline', fontSize: 13 }}>U</span>
            </ToolbarBtn>
            <span className="sp" />
            <ToolbarBtn variant="nota" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista de viñetas">
              <svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" /></svg>
            </ToolbarBtn>
            <ToolbarBtn variant="nota" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
              <svg viewBox="0 0 24 24"><path d="M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></svg>
            </ToolbarBtn>
            <span className="sp" />
            <ToolbarBtn variant="nota" onClick={() => editor.chain().focus().undo().run()} active={false} title="Deshacer (Ctrl+Z)">
              <svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
            </ToolbarBtn>
          </div>
        )}
        <div className="relative">
          {editor.isEmpty && placeholder && (
            <p className="absolute top-3 left-3.5 text-gray-400 text-sm pointer-events-none select-none leading-relaxed">
              {placeholder}
            </p>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  }

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-shadow bg-white ${readOnly ? 'opacity-75 cursor-default' : ''}`}>
      {!readOnly && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
          <ToolbarBtn variant="default" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita (Ctrl+B)">
            <span className="text-[13px] font-bold w-5 h-5 flex items-center justify-center">B</span>
          </ToolbarBtn>
          <ToolbarBtn variant="default" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva (Ctrl+I)">
            <span className="text-[13px] italic w-5 h-5 flex items-center justify-center">I</span>
          </ToolbarBtn>
          <ToolbarBtn variant="default" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado (Ctrl+U)">
            <span className="text-[13px] underline w-5 h-5 flex items-center justify-center">U</span>
          </ToolbarBtn>
          <div className="w-px h-4 bg-gray-200 mx-1.5" />
          <ToolbarBtn variant="default" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista de viñetas">
            <span className="material-symbols-outlined text-[17px] w-5 h-5 flex items-center justify-center">format_list_bulleted</span>
          </ToolbarBtn>
          <ToolbarBtn variant="default" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
            <span className="material-symbols-outlined text-[17px] w-5 h-5 flex items-center justify-center">format_list_numbered</span>
          </ToolbarBtn>
          <div className="w-px h-4 bg-gray-200 mx-1.5" />
          <ToolbarBtn variant="default" onClick={() => editor.chain().focus().setHardBreak().run()} active={false} title="Salto de línea (Shift+Enter)">
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
