import { NextRequest, NextResponse } from 'next/server'
import { requireModuleAccess, requireNodeAccess } from '@/lib/auth/resourceAccess'
import { callAgent } from '@/lib/agent/client'
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient'
import { buildClientRoute, buildOutboundPlan, safeOutboundSummary } from '@/lib/outbound/plan'
import { compileCatalogOutbound, runtimeHash } from '@/lib/outbound/runtime'

async function agentJson(vpsId: string, path: string, init?: RequestInit) {
  const response = await callAgent(vpsId, path, init)
  const text = await response.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = null }
  if (!response.ok) throw new Error(body?.message || body?.error || `Agent ${response.status}`)
  return body
}

async function gates(nodeId: string) {
  const moduleGate = await requireModuleAccess('outbound', 'manage')
  if ('error' in moduleGate) return moduleGate
  return requireNodeAccess(nodeId, 'manage')
}

async function context(admin: any, nodeId: string, ids: string[]) {
  const { data: node } = await admin.from('nodes').select('id,inbound_tag,vps_instance_id').eq('id', nodeId).maybeSingle()
  if (!node?.vps_instance_id) throw new Error('Node 没有关联 VPS runtime')
  const { data: rows, error } = await admin.from('node_outbounds').select('*')
    .in('id', ids).eq('target_vps_instance_id', node.vps_instance_id).eq('desired_state', 'present')
  if (error) throw new Error(error.message)
  if ((rows ?? []).length !== ids.length) throw new Error('部分出口不存在、不属于该 VPS 或已移除')
  return { node, rows: rows ?? [] }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: nodeId } = await ctx.params
  const gate = await gates(nodeId)
  if ('error' in gate) return gate.error
  const body = await req.json().catch(() => ({}))
  const mode = String(body.mode || '')
  const ids: string[] = Array.from(new Set<string>((Array.isArray(body.outbound_ids) ? body.outbound_ids : []).map((x: unknown) => String(x)))).slice(0, 50)
  if (!['plan', 'apply', 'verify', 'rollback'].includes(mode)) return NextResponse.json({ error: 'mode 无效' }, { status: 400 })
  if (!ids.length && mode !== 'rollback') return NextResponse.json({ error: '至少选择一个出口' }, { status: 400 })

  const admin = await createServerAdminClient() as any
  try {
    if (mode === 'plan') return await plan(admin, gate.user.id, nodeId, ids)
    if (mode === 'apply') return await apply(admin, gate.user.id, nodeId, ids, String(body.plan_run_id || ''))
    if (mode === 'verify') return await verify(admin, gate.user.id, nodeId, ids)
    return await rollback(admin, gate.user.id, nodeId, String(body.apply_run_id || ''))
  } catch (e: any) {
    const message = String(e?.message || '出口操作失败').slice(0, 500)
    const status = /not configured|尚未|没有关联/.test(message) ? 409 : 422
    return NextResponse.json({ error: message }, { status })
  }
}

async function plan(admin: any, userId: string, nodeId: string, ids: string[]) {
  const { node, rows } = await context(admin, nodeId, ids)
  let observed: any[] = []
  let observedWarning: string | null = null
  try {
    const response = await agentJson(node.vps_instance_id, '/xray/outbounds')
    observed = Array.isArray(response) ? response : []
  } catch (e: any) {
    observedWarning = `Agent 运行态暂不可读：${String(e?.message || 'unknown').slice(0, 200)}；本次为离线 Plan，Apply 前必须恢复控制通道`
  }
  const observedTags = new Set(observed.map((x: any) => x.tag).filter(Boolean)) as Set<string>
  const result = buildOutboundPlan(rows, observedTags)
  const previews = []
  for (const row of rows) {
    const compiled = await compileCatalogOutbound(admin, row)
    const hash = runtimeHash(compiled)
    await admin.from('node_outbounds').update({ desired_hash: hash, last_error: null }).eq('id', row.id)
    previews.push({ id: row.id, hash, ...safeOutboundSummary(compiled) })
  }
  const { data: clients } = await admin.from('node_clients').select('id,email,outbound_id').in('outbound_id', ids).eq('enabled', true)
  const routes = (clients ?? []).map((c: any) => buildClientRoute(c.id, node.inbound_tag, c.email, rows.find((x: any) => x.id === c.outbound_id)!.tag))
  const summary = { node_id: nodeId, outbound_ids: ids, actions: result.actions, previews, routes, observed_available: !observedWarning, warning: observedWarning }
  const inserted = await admin.from('outbound_apply_runs').insert({ target_vps_instance_id: node.vps_instance_id, requested_by: userId, mode: 'plan', status: 'succeeded', desired_hash: runtimeHash(previews.map((x) => x.hash)), summary, started_at: new Date().toISOString(), finished_at: new Date().toISOString() }).select('id').single()
  if (inserted.error) throw new Error(inserted.error.message)
  return NextResponse.json({ run_id: inserted.data.id, ...summary, mutates_runtime: result.mutatesRuntime })
}

async function apply(admin: any, userId: string, nodeId: string, ids: string[], planRunId: string) {
  if (!planRunId) throw new Error('Apply 必须引用成功的 Plan')
  const { node, rows } = await context(admin, nodeId, ids)
  const { data: planRun } = await admin.from('outbound_apply_runs').select('id,status,summary,target_vps_instance_id').eq('id', planRunId).eq('mode', 'plan').maybeSingle()
  if (!planRun || planRun.status !== 'succeeded' || planRun.target_vps_instance_id !== node.vps_instance_id) throw new Error('Plan 不存在、未成功或不属于该 VPS')
  if (JSON.stringify([...(planRun.summary?.outbound_ids || [])].sort()) !== JSON.stringify([...ids].sort())) throw new Error('Apply 选择范围与 Plan 不一致')

  const inserted = await admin.from('outbound_apply_runs').insert({ target_vps_instance_id: node.vps_instance_id, requested_by: userId, mode: 'apply', status: 'running', summary: { plan_run_id: planRunId, outbound_ids: ids, created_tags: [] }, started_at: new Date().toISOString() }).select('id').single()
  if (inserted.error) throw new Error(inserted.error.message)
  const runId = inserted.data.id
  const created: string[] = []
  try {
    const observed = await agentJson(node.vps_instance_id, '/xray/outbounds')
    const byTag = new Map((Array.isArray(observed) ? observed : []).map((x: any) => [x.tag, x]))
    for (const row of rows) {
      const compiled = await compileCatalogOutbound(admin, row)
      if (runtimeHash(compiled) !== row.desired_hash) throw new Error(`${row.tag} 自 Plan 后已变化，请重新 Plan`)
      const existing = byTag.get(row.tag)
      if (existing) {
        if (runtimeHash(existing) !== row.desired_hash) throw new Error(`${row.tag} 已存在不同配置；首版禁止覆盖，请先人工处理`)
      } else {
        await agentJson(node.vps_instance_id, '/xray/outbounds', { method: 'POST', body: JSON.stringify(compiled) })
        created.push(row.tag)
      }
    }
    const { data: clients } = await admin.from('node_clients').select('id,email,outbound_id').in('outbound_id', ids).eq('enabled', true)
    for (const client of clients ?? []) {
      const row = rows.find((x: any) => x.id === client.outbound_id)
      const route = buildClientRoute(client.id, node.inbound_tag, client.email, row.tag)
      try { await agentJson(node.vps_instance_id, `/xray/routing/ruleset/${encodeURIComponent(route.ruleTag)}`, { method: 'DELETE' }) } catch { /* absent is expected */ }
      await agentJson(node.vps_instance_id, '/xray/routing/ruleset', { method: 'POST', body: JSON.stringify(route) })
    }
    await structuralVerify(admin, node, rows)
    const now = new Date().toISOString()
    await admin.from('node_outbounds').update({ deploy_state: 'active', last_applied_at: now, last_observed_at: now, last_error: null }).in('id', ids)
    await admin.from('outbound_apply_runs').update({ status: 'succeeded', summary: { plan_run_id: planRunId, outbound_ids: ids, created_tags: created }, finished_at: now }).eq('id', runId)
    return NextResponse.json({ run_id: runId, status: 'succeeded', created_tags: created })
  } catch (e: any) {
    for (const tag of created.reverse()) { try { await agentJson(node.vps_instance_id, `/xray/outbounds/${encodeURIComponent(tag)}`, { method: 'DELETE' }) } catch { /* best effort compensation */ } }
    const message = String(e?.message || 'Apply failed').slice(0, 500)
    await admin.from('node_outbounds').update({ deploy_state: 'error', last_error: message }).in('id', ids)
    await admin.from('outbound_apply_runs').update({ status: 'failed', summary: { plan_run_id: planRunId, outbound_ids: ids, created_tags: created }, error_message: message, finished_at: new Date().toISOString() }).eq('id', runId)
    throw new Error(message)
  }
}

async function structuralVerify(admin: any, node: any, rows: any[]) {
  for (const row of rows) {
    const actual = await agentJson(node.vps_instance_id, `/xray/outbounds/${encodeURIComponent(row.tag)}`)
    if (runtimeHash(actual) !== row.desired_hash) throw new Error(`${row.tag} 运行态 hash 与期望态不一致`)
  }
  const { data: clients } = await admin.from('node_clients').select('id,email,outbound_id').in('outbound_id', rows.map((x) => x.id)).eq('enabled', true)
  for (const client of clients ?? []) {
    const row = rows.find((x: any) => x.id === client.outbound_id)
    const ruleTag = `jiedian-client-${client.id}`
    const route = await agentJson(node.vps_instance_id, `/xray/routing/ruleset/${encodeURIComponent(ruleTag)}`)
    if (route.outboundTag !== row.tag || !(route.user || []).includes(client.email) || !(route.inboundTag || []).includes(node.inbound_tag)) throw new Error(`${client.email} routing 验证失败`)
  }
}

async function verify(admin: any, userId: string, nodeId: string, ids: string[]) {
  const { node, rows } = await context(admin, nodeId, ids)
  const run = await admin.from('outbound_apply_runs').insert({ target_vps_instance_id: node.vps_instance_id, requested_by: userId, mode: 'reconcile', status: 'running', summary: { outbound_ids: ids }, started_at: new Date().toISOString() }).select('id').single()
  if (run.error) throw new Error(run.error.message)
  try {
    await structuralVerify(admin, node, rows)
    const now = new Date().toISOString()
    await admin.from('node_outbounds').update({ deploy_state: 'active', last_observed_at: now, last_error: null }).in('id', ids)
    await admin.from('outbound_apply_runs').update({ status: 'succeeded', finished_at: now }).eq('id', run.data.id)
    return NextResponse.json({ run_id: run.data.id, status: 'succeeded', verification: 'structural' })
  } catch (e: any) {
    const message = String(e.message).slice(0, 500)
    await admin.from('node_outbounds').update({ deploy_state: 'drifted', last_error: message }).in('id', ids)
    await admin.from('outbound_apply_runs').update({ status: 'failed', error_message: message, finished_at: new Date().toISOString() }).eq('id', run.data.id)
    throw e
  }
}

async function rollback(admin: any, userId: string, nodeId: string, applyRunId: string) {
  if (!applyRunId) throw new Error('Rollback 必须引用 Apply run')
  const { data: applyRun } = await admin.from('outbound_apply_runs').select('*').eq('id', applyRunId).eq('mode', 'apply').maybeSingle()
  if (!applyRun) throw new Error('Apply run 不存在')
  const ids = (applyRun.summary?.outbound_ids || []) as string[]
  const { node, rows } = await context(admin, nodeId, ids)
  if (applyRun.target_vps_instance_id !== node.vps_instance_id) throw new Error('Apply run 不属于该 VPS')
  const run = await admin.from('outbound_apply_runs').insert({ target_vps_instance_id: node.vps_instance_id, requested_by: userId, mode: 'rollback', status: 'running', summary: { apply_run_id: applyRunId, outbound_ids: ids }, started_at: new Date().toISOString() }).select('id').single()
  if (run.error) throw new Error(run.error.message)
  const created = (applyRun.summary?.created_tags || []) as string[]
  for (const row of rows) {
    const ruleClients = await admin.from('node_clients').select('id').eq('outbound_id', row.id)
    for (const client of ruleClients.data ?? []) { try { await agentJson(node.vps_instance_id, `/xray/routing/ruleset/${encodeURIComponent(`jiedian-client-${client.id}`)}`, { method: 'DELETE' }) } catch {} }
  }
  for (const tag of created) { try { await agentJson(node.vps_instance_id, `/xray/outbounds/${encodeURIComponent(tag)}`, { method: 'DELETE' }) } catch {} }
  const now = new Date().toISOString()
  await admin.from('node_outbounds').update({ deploy_state: 'draft', last_observed_at: now, last_error: null }).in('id', ids)
  await admin.from('outbound_apply_runs').update({ status: 'rolled_back', finished_at: now }).eq('id', run.data.id)
  return NextResponse.json({ run_id: run.data.id, status: 'rolled_back', removed_tags: created })
}
