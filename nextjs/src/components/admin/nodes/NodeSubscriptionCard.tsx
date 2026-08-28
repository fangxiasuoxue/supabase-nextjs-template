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
  /** 订阅 URL 路径前缀,默认 /sub;聚合订阅用 /sub/bundle */
  pathPrefix?: string
  /** 可选标题(如「聚合订阅」),给卡片顶部加一行醒目标签 */
  heading?: string
}

// 线上订阅域名 fallback(优先用环境变量 NEXT_PUBLIC_SITE_URL)
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://vip.ibf.qzz.io'
).replace(/\/$/, '')

export function NodeSubscriptionCard({ token, protocol, inboundTag, pathPrefix = '/sub', heading }: Props) {
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  // SDD 61 #8:短链别名
  const [shortUrl, setShortUrl] = useState<string | null>(null)
  const [shortQr, setShortQr] = useState<string | null>(null)
  const [minting, setMinting] = useState(false)
  const [copiedShort, setCopiedShort] = useState(false)

  // 完整订阅 URL —— 客户端可直接导入
  const prefix = pathPrefix.replace(/\/$/, '')
  const fullUrl = token ? `${SITE_URL}${prefix}/${token}` : ''

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

  // 铸造/取该订阅的短链别名(幂等:同一 target 返回既有短码),并生成短链二维码。
  const handleMint = async () => {
    if (!token || minting) return
    setMinting(true)
    try {
      const res = await fetch('/api/v1/admin/sub-short-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath: `${prefix}/${token}`, label: heading || protocol || null }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || '生成失败')
      setShortUrl(data.url)
      QRCode.toDataURL(data.url, { width: 160, margin: 1 }).then(setShortQr).catch(() => setShortQr(null))
      toast.success('短链已生成')
    } catch (e: any) {
      toast.error(e?.message || '短链生成失败')
    } finally {
      setMinting(false)
    }
  }

  const handleCopyShort = async () => {
    if (!shortUrl) return
    await navigator.clipboard.writeText(shortUrl)
    setCopiedShort(true)
    toast.success('短链已复制')
    setTimeout(() => setCopiedShort(false), 2000)
  }

  if (!token) return (
    <div className="flex items-center justify-center h-24 text-muted-foreground/30 text-xs uppercase tracking-widest">
      暂无订阅 Token
    </div>
  )

  return (
    <div className="glass-card-premium p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      {heading && (
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-cyan-600 text-[9px] font-black uppercase tracking-widest text-white">
            {heading}
          </span>
        </div>
      )}
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
          {/* 一条链接通吃所有客户端(SDD 61:按 UA 自动转 Clash/sing-box/Surge,其余 base64) */}
          <p className="text-[10px] text-cyan-700/70 font-medium">
            一条链接自动适配所有客户端(Clash Meta / sing-box / v2rayNG / Shadowrocket / Surge)
          </p>

          {/* 短链别名(SDD 61 #8):又短又好记,扫码/复制皆可 */}
          {!shortUrl ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMint}
              disabled={minting}
              className="h-7 text-[10px] rounded-lg"
            >
              {minting ? '生成中…' : '生成短链'}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              {shortQr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shortQr} alt="短链二维码" className="w-10 h-10 rounded bg-white border border-slate-200 shrink-0" />
              )}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 flex-1 min-w-0">
                <span className="tech-mono text-[11px] text-emerald-800 flex-1 truncate">{shortUrl}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCopyShort}
                  className="h-6 w-6 rounded shrink-0 hover:bg-emerald-100"
                >
                  {copiedShort ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-emerald-600" />}
                </Button>
              </div>
            </div>
          )}

          {/* 裸 token 作为次要信息小字展示 */}
          <p className="text-[9px] text-muted-foreground/40 tech-mono truncate">
            token: {token}
          </p>
        </div>
      </div>
    </div>
  )
}
