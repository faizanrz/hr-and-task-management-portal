'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Button, Badge, Card, CardContent, Input, Textarea, Modal, AnimatedPage, AnimatedSection, SkeletonPage } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { Announcement } from '@/types'

export default function AnnouncementsPage() {
  const { employee, isAdmin, canManageTeam, loading: ctxLoading } = useEmployee()
  const [announcements, setAnnouncements] = useState<(Announcement & { poster?: { first_name: string; last_name: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title: '',
    body: '',
    is_pinned: false,
    expires_at: '',
  })

  useEffect(() => {
    if (!employee) return
    loadData()
  }, [employee])

  async function loadData() {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('announcements')
      .select('*, poster:posted_by(first_name, last_name)')
      .or(`expires_at.is.null,expires_at.gte.${today}`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (data) setAnnouncements(data as any)
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!employee) return
    setSaving(true)
    const supabase = createClient()

    await supabase.from('announcements').insert({
      title: form.title,
      body: form.body,
      is_pinned: form.is_pinned,
      posted_by: employee.id,
      expires_at: form.expires_at || null,
    })

    setShowCreate(false)
    setForm({ title: '', body: '', is_pinned: false, expires_at: '' })
    setSaving(false)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement?')) return
    const supabase = createClient()
    await supabase.from('announcements').delete().eq('id', id)
    loadData()
  }

  async function togglePin(id: string, currentPin: boolean) {
    const supabase = createClient()
    await supabase.from('announcements').update({ is_pinned: !currentPin }).eq('id', id)
    loadData()
  }

  if (ctxLoading || loading) return <SkeletonPage />

  return (
    <AnimatedPage className="space-y-6">
      <AnimatedSection>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-100">Announcements</h1>
            <p className="text-sm text-gray-500 mt-1">Company notices and updates</p>
          </div>
          {canManageTeam && (
            <Button onClick={() => setShowCreate(true)}>New Announcement</Button>
          )}
        </div>
      </AnimatedSection>

      <AnimatedSection>
      {announcements.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-400 text-center py-8">No announcements yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-medium text-gray-100">{a.title}</h3>
                      {a.is_pinned && <Badge variant="default">Pinned</Badge>}
                      {a.expires_at && new Date(a.expires_at) < new Date() && (
                        <Badge variant="neutral">Expired</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 whitespace-pre-wrap">{a.body}</p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                      {a.poster && <span>Posted by {a.poster.first_name} {a.poster.last_name}</span>}
                      <span>&middot;</span>
                      <span>{formatDate(a.created_at)}</span>
                      {a.expires_at && (
                        <>
                          <span>&middot;</span>
                          <span>Expires {formatDate(a.expires_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {canManageTeam && (
                    <div className="flex gap-1 ml-4">
                      <Button size="sm" variant="ghost" onClick={() => togglePin(a.id, a.is_pinned)}>
                        {a.is_pinned ? 'Unpin' : 'Pin'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </AnimatedSection>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Announcement">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            id="ann-title"
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <Textarea
            id="ann-body"
            label="Body"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            required
          />
          <Input
            id="ann-expires"
            label="Expires At (optional)"
            type="date"
            value={form.expires_at}
            onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))}
              className="rounded border-gray-300 text-brand focus:ring-brand"
            />
            Pin this announcement
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Posting...' : 'Post'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </AnimatedPage>
  )
}
