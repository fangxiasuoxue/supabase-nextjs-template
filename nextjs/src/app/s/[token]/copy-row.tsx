'use client'

import { useState } from 'react'

// 公开单终端页的一行「标签 + 值 + 复制」。纯客户端小组件(复制需浏览器 API)。
export default function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪贴板不可用时用户可长按选中 */
    }
  }
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-1 text-xs text-gray-500">{label}</div>
      <div className="flex items-center gap-2">
        <code className="block flex-1 select-all break-all font-mono text-xs text-gray-800">{value}</code>
        <button
          onClick={copy}
          className="shrink-0 rounded bg-gray-900 px-2.5 py-1 text-xs text-white active:bg-gray-700"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
    </div>
  )
}
