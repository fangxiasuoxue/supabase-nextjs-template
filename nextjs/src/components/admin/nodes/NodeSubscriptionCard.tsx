'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, QrCode } from 'lucide-react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Props {
  token: string | null
  protocol?: string
  inboundTag?: string
}

// 线上订阅域名 fallback(优先用环境变量 NEXT_PUBLIC_SITE_URL)
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://vip.ibf.qzz.io'
).replace(/\/$/, '')

export function NodeSubscriptionCard({ token, protocol, inboundTag }: Props) {
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // 完整订阅 URL —— 客户端可直接导入
  const fullUrl = token ? `${SITE_URL}/sub/${token}` : ''

  // 异步生成二维码 dataURL
  useEffect(() => {
    if (!fullUrl) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(fullUrl, { width: 160, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [fullUrl])

  const handleCopy = async () => {
    if (!fullUrl) return
    await navigator.clipboard.writeText(fullUrl)
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
    <div className="glass-card-premium p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        {protocol && (
          <span className="px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-[9px] font-black uppercase tracking-widest text-cyan-700">
            {protocol}
          </span>
        )}
        {inboundTag && (
          <span className="text-[9px] text-muted-foreground/50 font-bold tech-mono">{inboundTag}</span>
        )}
      </div>

      <div className="flex items-start gap-4">
        {/* 二维码:扫码即可导入订阅 */}
        <div className="shrink-0 w-[120px] h-[120px] rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="订阅二维码" className="w-full h-full" />
          ) : (
            <QrCode className="h-8 w-8 text-slate-300" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-100 border border-slate-200">
            <span className="tech-mono text-xs text-muted-foreground/70 flex-1 truncate">{fullUrl}</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCopy}
              className="h-7 w-7 rounded-lg shrink-0 hover:bg-primary/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-cyan-600" />}
            </Button>
          </div>
          {/* 裸 token 作为次要信息小字展示 */}
          <p className="text-[9px] text-muted-foreground/40 tech-mono truncate">
            token: {token}
          </p>
        </div>
      </div>
    </div>
  )
}
