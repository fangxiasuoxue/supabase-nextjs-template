// @ts-nocheck
'use client'

import { useState } from 'react'
import { Copy, Check, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Props {
  token: string | null
  protocol?: string
  inboundTag?: string
}

export function NodeSubscriptionCard({ token, protocol, inboundTag }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    toast.success('订阅链接已复制')
    setTimeout(() => setCopied(false), 2000)
  }

  if (!token) return (
    <div className="flex items-center justify-center h-24 text-muted-foreground/30 text-xs uppercase tracking-widest">
      暂无订阅 Token
    </div>
  )

  return (
    <div className="glass-card-premium p-5 rounded-2xl border border-white/5 space-y-4">
      <div className="flex items-center gap-3">
        {protocol && (
          <span className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary">
            {protocol}
          </span>
        )}
        {inboundTag && (
          <span className="text-[9px] text-muted-foreground/50 font-bold tech-mono">{inboundTag}</span>
        )}
      </div>

      <div className="flex items-center gap-2 p-3 rounded-xl bg-black/40 border border-white/5">
        <span className="tech-mono text-xs text-muted-foreground/70 flex-1 truncate">{token}</span>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCopy}
          className="h-7 w-7 rounded-lg shrink-0 hover:bg-primary/10"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-primary/60" />}
        </Button>
      </div>
    </div>
  )
}
