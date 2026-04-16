import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: doneColumns, error: columnError } = await admin
    .from('board_columns')
    .select('id')
    .eq('name', 'Done')

  if (columnError) {
    return NextResponse.json({ error: 'Failed to fetch columns' }, { status: 500 })
  }

  const doneColumnIds = ((doneColumns || []) as Array<{ id: number }>).map((column) => column.id)
  if (doneColumnIds.length === 0) {
    return NextResponse.json({ archivedCount: 0, message: 'No Done columns found' })
  }

  const archiveBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error: candidateError } = await admin
    .from('tasks')
    .select('id')
    .eq('is_archived', false)
    .in('column_id', doneColumnIds)
    .not('completed_at', 'is', null)
    .lte('completed_at', archiveBefore)

  if (candidateError) {
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }

  const taskIds = ((candidates || []) as Array<{ id: number }>).map((task) => task.id)
  if (taskIds.length === 0) {
    return NextResponse.json({ archivedCount: 0, message: 'No tasks eligible for archiving' })
  }

  const { error: updateError } = await admin
    .from('tasks')
    .update({
      is_archived: true,
      updated_at: new Date().toISOString(),
    })
    .in('id', taskIds)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to archive tasks' }, { status: 500 })
  }

  return NextResponse.json({ archivedCount: taskIds.length })
}
