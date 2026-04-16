'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmployee } from '@/lib/employee-context'
import { Button, Badge, Card, CardHeader, CardContent, Input, Select, Modal, AnimatedPage, AnimatedSection, SkeletonPage } from '@/components/ui'
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '@/components/ui'
import { DOCUMENT_TYPES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { HRDocument, Employee } from '@/types'

export default function DocumentsPage() {
  const { employee, isAdmin, isManager, isTeamLead, canManageTeam, loading: ctxLoading } = useEmployee()
  const canViewTeam = canManageTeam
  const [documents, setDocuments] = useState<(HRDocument & { employee?: { first_name: string; last_name: string }; uploader?: { first_name: string; last_name: string } })[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')

  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    employee_id: '',
    document_type: 'contract',
    title: '',
    notes: '',
  })
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    if (!employee) return
    loadData()
    if (canViewTeam) {
      const supabase = createClient()
      let empQuery = supabase.from('employees').select('*').eq('is_active', true).neq('department', 'co-founder').order('first_name')
      if (isTeamLead && !isAdmin && !isManager && employee.department) {
        empQuery = empQuery.eq('department', employee.department)
      }
      empQuery.then(({ data }) => { if (data) setEmployees(data as Employee[]) })
    }
  }, [employee, isAdmin, isManager, isTeamLead, canViewTeam])

  async function loadData() {
    const supabase = createClient()
    let query = supabase
      .from('hr_documents')
      .select('*, employee:employee_id(first_name, last_name), uploader:uploaded_by(first_name, last_name)')
      .order('created_at', { ascending: false })

    if (!canViewTeam) {
      query = query.eq('employee_id', employee!.id)
    } else if (isManager) {
      const { data: allMembers } = await supabase
        .from('employees')
        .select('id')
        .eq('is_active', true)
        .neq('department', 'co-founder')

      const allIds = (allMembers || []).map((m) => m.id)
      if (allIds.length > 0) {
        query = query.in('employee_id', allIds)
      }
    } else if (isTeamLead && employee?.department) {
      const { data: teamMembers } = await supabase
        .from('employees')
        .select('id')
        .eq('is_active', true)
        .eq('department', employee.department)

      const teamIds = (teamMembers || []).map((m) => m.id)
      if (teamIds.length > 0) {
        query = query.in('employee_id', teamIds)
      } else {
        query = query.eq('employee_id', employee!.id)
      }
    }

    const { data } = await query
    if (data) setDocuments(data as any)
    setLoading(false)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !employee) return
    setUploading(true)

    const supabase = createClient()
    const filePath = `${uploadForm.employee_id}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('hr-documents')
      .upload(filePath, file)

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    await supabase.from('hr_documents').insert({
      employee_id: uploadForm.employee_id,
      document_type: uploadForm.document_type,
      title: uploadForm.title,
      file_path: filePath,
      file_size: file.size,
      uploaded_by: employee.id,
      notes: uploadForm.notes || null,
    })

    setShowUpload(false)
    setUploadForm({ employee_id: '', document_type: 'contract', title: '', notes: '' })
    setFile(null)
    setUploading(false)
    loadData()
  }

  async function handleDownload(doc: HRDocument) {
    const supabase = createClient()
    const { data } = await supabase.storage
      .from('hr-documents')
      .createSignedUrl(doc.file_path, 60)

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    }
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function formatDocType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const filtered = documents.filter((d) => {
    if (filterType && d.document_type !== filterType) return false
    if (filterEmployee && d.employee_id !== filterEmployee) return false
    return true
  })

  if (ctxLoading || loading) return <SkeletonPage />

  return (
    <AnimatedPage className="space-y-6">
      <AnimatedSection>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-100">HR Documents</h1>
            <p className="text-sm text-gray-500 mt-1">Contracts, policies, and employee documents</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowUpload(true)}>Upload Document</Button>
          )}
          {(isManager || isTeamLead) && !isAdmin && (
            <span className="text-xs text-gray-500">Viewing your department&apos;s documents</span>
          )}
        </div>
      </AnimatedSection>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          options={[
            { value: '', label: 'All Types' },
            ...DOCUMENT_TYPES.map((t) => ({ value: t, label: formatDocType(t) })),
          ]}
        />
        {canViewTeam && (
          <Select
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
            options={[
              { value: '', label: 'All Employees' },
              ...employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
            ]}
          />
        )}
      </div>

      {/* Documents Table */}
      <AnimatedSection>
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Title</TableHeader>
              {canViewTeam && <TableHeader>Employee</TableHeader>}
              <TableHeader>Type</TableHeader>
              <TableHeader>Size</TableHeader>
              <TableHeader>Uploaded</TableHeader>
              <TableHeader>{' '}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium text-gray-100">{doc.title}</TableCell>
                {canViewTeam && (
                  <TableCell>
                    {doc.employee ? `${doc.employee.first_name} ${doc.employee.last_name}` : '—'}
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant="neutral">{formatDocType(doc.document_type)}</Badge>
                </TableCell>
                <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                <TableCell>{formatDate(doc.created_at)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)}>
                    Download
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell className="text-center text-gray-400 py-8">
                  No documents found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      </AnimatedSection>

      {/* Upload Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Document">
        <form onSubmit={handleUpload} className="space-y-4">
          <Select
            id="doc-emp"
            label="Employee"
            value={uploadForm.employee_id}
            onChange={(e) => setUploadForm((f) => ({ ...f, employee_id: e.target.value }))}
            options={[
              { value: '', label: 'Select employee' },
              ...employees.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
            ]}
            required
          />
          <Select
            id="doc-type"
            label="Document Type"
            value={uploadForm.document_type}
            onChange={(e) => setUploadForm((f) => ({ ...f, document_type: e.target.value }))}
            options={DOCUMENT_TYPES.map((t) => ({ value: t, label: formatDocType(t) }))}
          />
          <Input
            id="doc-title"
            label="Title"
            value={uploadForm.title}
            onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Employment Contract 2026"
            required
          />
          <div className="space-y-1">
            <label className="block text-sm text-gray-500">File</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              required
            />
          </div>
          <Input
            id="doc-notes"
            label="Notes (optional)"
            value={uploadForm.notes}
            onChange={(e) => setUploadForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowUpload(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </AnimatedPage>
  )
}
