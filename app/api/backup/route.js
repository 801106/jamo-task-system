// app/api/backup/route.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', ''))
    
    const isCron = request.headers.get('x-cron-key') === process.env.CRON_SECRET

    if (!user && !isCron) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-')
    const filename = `taskflow_backup_${dateStr}_${timeStr}.json`

    // Export all tables
    const [
      { data: clients },
      { data: interactions },
      { data: tasks },
      { data: comments },
      { data: suggestions },
      { data: profiles },
    ] = await Promise.all([
      supabase.from('clients').select('*').order('created_at'),
      supabase.from('client_interactions').select('*').order('created_at'),
      supabase.from('tasks').select('*').order('created_at'),
      supabase.from('comments').select('*').order('created_at'),
      supabase.from('suggestions').select('*').order('created_at'),
      supabase.from('profiles').select('id, full_name, role, created_at').order('created_at'),
    ])

    const backup = {
      version: '1.0',
      created_at: now.toISOString(),
      created_by: user?.email || 'cron',
      workspace: 'jamo_healthy',
      stats: {
        clients: clients?.length || 0,
        interactions: interactions?.length || 0,
        tasks: tasks?.length || 0,
        comments: comments?.length || 0,
        suggestions: suggestions?.length || 0,
      },
      data: {
        clients: clients || [],
        client_interactions: interactions || [],
        tasks: tasks || [],
        comments: comments || [],
        suggestions: suggestions || [],
        profiles: profiles || [],
      }
    }

    const jsonContent = JSON.stringify(backup, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const arrayBuffer = await blob.arrayBuffer()

    // Save to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(filename, arrayBuffer, {
        contentType: 'application/json',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return Response.json({ error: uploadError.message }, { status: 500 })
    }

    // Clean old backups — keep last 30
    const { data: files } = await supabase.storage.from('backups').list('', {
      sortBy: { column: 'created_at', order: 'desc' }
    })

    if (files && files.length > 30) {
      const toDelete = files.slice(30).map(f => f.name)
      await supabase.storage.from('backups').remove(toDelete)
    }

    return Response.json({
      success: true,
      filename,
      stats: backup.stats,
      size_kb: Math.round(jsonContent.length / 1024),
      created_at: now.toISOString(),
    })

  } catch (err) {
    console.error('Backup error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    // List available backups
    const { data: files, error } = await supabase.storage.from('backups').list('', {
      sortBy: { column: 'created_at', order: 'desc' }
    })

    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ backups: files || [] })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
