import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './App.css'

type Task = {
  id: number
  title: string
  date: string
  period: string
  completed: boolean
}

type SchoolLink = {
  id: number
  label: string
  url: string
  kind: string
}

type TaskFile = {
  id: number
  task_id: number
  file_name: string
  file_path: string
}

// Set this to the exact name of your Supabase Storage bucket (Storage dashboard, case-sensitive)
const STORAGE_BUCKET = 'session-bucket'

function BellMark({ size = 28 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
    </span>
  )
}

const today = new Date()
const todayKey = today.toISOString().slice(0, 10)
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

function load<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) as T : fallback
  } catch {
    return fallback
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [view, setView] = useState<'today' | 'reminders'>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const [links, setLinks] = useState<SchoolLink[]>([])
  const [syncState, setSyncState] = useState<'loading' | 'saved' | 'error'>('loading')
  const [taskTitle, setTaskTitle] = useState('')
  const [period, setPeriod] = useState('Monday')
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [notifications, setNotifications] = useState(() => load('reminders-notifications', false))
  const [notice, setNotice] = useState('')
  const [filesByTask, setFilesByTask] = useState<Record<number, TaskFile[]>>({})
  const [uploadingFor, setUploadingFor] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setTasks([])
      setLinks([])
      return
    }
    async function fetchData() {
      const [tasksResult, linksResult] = await Promise.all([
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('links').select('*').order('created_at', { ascending: true }),
      ])
      if (tasksResult.error || linksResult.error) {
        setSyncState('error')
        setNotice('Could not load from cloud')
        return
      }
      setTasks(tasksResult.data ?? [])
      setLinks(linksResult.data ?? [])
      setSyncState('saved')
      const filesResult = await supabase.from('task_files').select('*')
      if (!filesResult.error && filesResult.data) {
        const grouped: Record<number, TaskFile[]> = {}
        for (const file of filesResult.data) {
          ;(grouped[file.task_id] ??= []).push(file)
        }
        setFilesByTask(grouped)
      }
    }
    fetchData()
  }, [user])

  useEffect(() => localStorage.setItem('reminders-notifications', JSON.stringify(notifications)), [notifications])

  const todayTasks = useMemo(() => tasks.filter((task) => task.date === todayKey), [tasks])
  const visibleTasks = useMemo(() => {
    const source = view === 'today' ? todayTasks : tasks
    if (filter === 'pending') return source.filter((task) => !task.completed)
    if (filter === 'done') return source.filter((task) => task.completed)
    return source
  }, [filter, tasks, todayTasks, view])
  const completed = todayTasks.filter((task) => task.completed).length
  const pending = todayTasks.length - completed
  const progress = todayTasks.length ? Math.round((completed / todayTasks.length) * 100) : 0

  const weeklyData = useMemo(() => {
    const day = today.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    return weekdays.map((name, index) => {
      const d = new Date(today)
      d.setDate(today.getDate() + mondayOffset + index)
      const key = d.toISOString().slice(0, 10)
      const dayTasks = tasks.filter((task) => task.date === key)
      const done = dayTasks.filter((task) => task.completed).length
      return {
        name,
        initial: name[0],
        total: dayTasks.length,
        done,
        percent: dayTasks.length ? Math.round((done / dayTasks.length) * 100) : 0,
      }
    })
  }, [tasks])

  async function handleAuth(event: FormEvent) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password })
    setAuthBusy(false)
    if (result.error) {
      setAuthError(result.error.message)
      return
    }
    if (authMode === 'signup' && !result.data.session) {
      setNotice('Check your email to confirm your account')
      window.setTimeout(() => setNotice(''), 3000)
    }
    setPassword('')
  }

  async function signOut() {
    setShowAccountMenu(false)
    await supabase.auth.signOut()
  }

  async function deleteAccount() {
    if (!window.confirm('Permanently delete your account and all your tasks and links? This cannot be undone.')) return
    const { error } = await supabase.rpc('delete_user')
    if (error) {
      setNotice('Could not delete account')
      window.setTimeout(() => setNotice(''), 2400)
      return
    }
    await supabase.auth.signOut()
  }

  async function addTask(event: FormEvent) {
    event.preventDefault()
    const title = taskTitle.trim()
    if (!title) return
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, date: todayKey, period, completed: false, user_id: user?.id })
      .select()
      .single()
    if (error || !data) {
      setNotice('Could not save task')
      window.setTimeout(() => setNotice(''), 2400)
      return
    }
    setTasks((current) => [data, ...current])
    setTaskTitle('')
    setNotice('Task added to today')
    window.setTimeout(() => setNotice(''), 2400)
  }

  async function toggleTask(id: number) {
    const task = tasks.find((item) => item.id === id)
    if (!task) return
    setTasks((current) => current.map((item) => item.id === id ? { ...item, completed: !item.completed } : item))
    const { error } = await supabase.from('tasks').update({ completed: !task.completed }).eq('id', id)
    if (error) {
      setTasks((current) => current.map((item) => item.id === id ? { ...item, completed: task.completed } : item))
      setNotice('Could not update task')
      window.setTimeout(() => setNotice(''), 2400)
    }
  }

  async function deleteTask(id: number) {
    const previous = tasks
    setTasks((current) => current.filter((task) => task.id !== id))
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      setTasks(previous)
      setNotice('Could not delete task')
      window.setTimeout(() => setNotice(''), 2400)
    }
  }

  async function addLink(event: FormEvent) {
    event.preventDefault()
    if (!linkLabel.trim() || !linkUrl.trim()) return
    const { data, error } = await supabase
      .from('links')
      .insert({ label: linkLabel.trim(), url: linkUrl.trim(), kind: 'Shortcut', user_id: user?.id })
      .select()
      .single()
    if (error || !data) {
      setNotice('Could not save link')
      window.setTimeout(() => setNotice(''), 2400)
      return
    }
    setLinks((current) => [...current, data])
    setLinkLabel('')
    setLinkUrl('')
    setShowLinkForm(false)
  }

  async function toggleNotifications() {
    if (!notifications && 'Notification' in window && Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setNotice('Notifications were not enabled')
        return
      }
    }
    setNotifications((current) => !current)
    setNotice(!notifications ? 'Reminders enabled on this device' : 'Reminders paused')
    window.setTimeout(() => setNotice(''), 2400)
  }

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  async function uploadFile(taskId: number, fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file || !user) return
    setUploadingFor(taskId)
    const path = `${user.id}/${taskId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file)
    if (uploadError) {
      setUploadingFor(null)
      flash('Could not upload file')
      return
    }
    const { data, error } = await supabase
      .from('task_files')
      .insert({ task_id: taskId, file_name: file.name, file_path: path, user_id: user.id })
      .select()
      .single()
    setUploadingFor(null)
    if (error || !data) {
      flash('Could not save file')
      return
    }
    setFilesByTask((current) => ({ ...current, [taskId]: [...(current[taskId] ?? []), data] }))
    flash('File attached')
  }

  async function openFile(file: TaskFile) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.file_path, 60)
    if (error || !data) {
      flash('Could not open file')
      return
    }
    window.open(data.signedUrl, '_blank', 'noreferrer')
  }

  async function removeFile(file: TaskFile) {
    const previous = filesByTask
    setFilesByTask((current) => ({ ...current, [file.task_id]: (current[file.task_id] ?? []).filter((item) => item.id !== file.id) }))
    await supabase.storage.from(STORAGE_BUCKET).remove([file.file_path])
    const { error } = await supabase.from('task_files').delete().eq('id', file.id)
    if (error) {
      setFilesByTask(previous)
      flash('Could not delete file')
    }
  }

  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase()

  if (!authReady) {
    return (
      <main className="app-shell">
        <div className="auth-page"><p className="auth-loading">Loading…</p></div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="app-shell">
        <div className="auth-page">
          <form className="auth-card" onSubmit={handleAuth}>
            <BellMark size={36} />
            <h1>{authMode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
            <p>{authMode === 'login' ? 'Sign in to open your workspace.' : 'Sign up to start planning your week.'}</p>
            <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" aria-label="Email address" />
            <input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password (6+ characters)" aria-label="Password" />
            {authError && <p className="auth-error">{authError}</p>}
            <button type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : authMode === 'login' ? 'Log in' : 'Create account'}</button>
            <button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError('') }}>
              {authMode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
            </button>
          </form>
        </div>
        {notice && <div className="toast" role="status">{notice}</div>}
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('today')} aria-label="Go to today's dashboard">
          <BellMark />
          <span>reminders</span>
        </button>
        <div className="topbar-actions">
          <button className="link-trigger" onClick={() => setShowLinkForm((current) => !current)}>
            <span className="link-icon">↗</span> School links <span className="chevron">⌄</span>
          </button>
          <button className="settings-trigger" onClick={() => setShowSettings((current) => !current)} aria-label="Open notification settings">⚙</button>
          <button className="avatar" onClick={() => setShowAccountMenu((current) => !current)} aria-label="Account menu">{initials}</button>
        </div>
      </header>

      {showAccountMenu && (
        <section className="account-menu">
          <small className="account-email">{user.email}</small>
          <button onClick={signOut}>Log out</button>
          <button className="danger" onClick={deleteAccount}>Delete account</button>
        </section>
      )}

      {showLinkForm && (
        <section className="link-popover">
          <div className="popover-heading"><div><span className="eyebrow">Workspace shortcuts</span><h2>School links</h2></div><button className="icon-button" onClick={() => setShowLinkForm(false)} aria-label="Close school links">×</button></div>
          <div className="saved-links">
            {links.map((link) => <a href={link.url} target="_blank" rel="noreferrer" className="saved-link" key={link.id}><span className="saved-link-icon">↗</span><span><strong>{link.label}</strong><small>{link.kind}</small></span></a>)}
          </div>
          <form className="link-form" onSubmit={addLink}><input value={linkLabel} onChange={(event) => setLinkLabel(event.target.value)} placeholder="Link name" aria-label="Link name" /><input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://..." aria-label="Website URL" type="url" /><button className="small-button" type="submit">Add link</button></form>
        </section>
      )}

      {showSettings && <section className="settings-popover"><span><strong>Device reminders</strong><small>Allow prep-time notifications</small></span><button className={`toggle ${notifications ? 'is-on' : ''}`} onClick={toggleNotifications} aria-pressed={notifications}><span /></button></section>}

      <div className="page-wrap">
        <div className="page-heading">
          <div><span className="eyebrow">Saturday, 22 August 2026</span><h1>{view === 'today' ? 'Good morning, Jamie.' : 'Your reminders.'}</h1><p>{view === 'today' ? 'Make space for the work that matters today.' : 'A clear view of everything still in motion.'}</p></div>
          <div className="sync-status"><span className="status-dot" /> {syncState === 'loading' ? 'Syncing…' : syncState === 'saved' ? 'Saved to cloud' : 'Sync error'}</div>
        </div>

        <nav className="view-tabs" aria-label="Main navigation"><button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>Today <span>{todayTasks.length}</span></button><button className={view === 'reminders' ? 'active' : ''} onClick={() => setView('reminders')}>Reminders <span>{pending}</span></button></nav>

        <section className="overview-grid">
          <div className="progress-panel">
            <div className="panel-topline"><span className="eyebrow">Today at a glance</span><span className="date-chip">22 AUG</span></div>
            <div className="progress-content"><div><strong className="progress-number">{progress}<span>%</span></strong><p>of today’s work complete</p></div><div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{completed}</strong><span>done</span></div></div></div>
            <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
            <div className="progress-labels"><span>{pending} pending</span><span>{todayTasks.length} total tasks</span></div>
          </div>
          <div className="mini-chart">
            <div className="panel-topline"><span className="eyebrow">This week</span><span className="trend">{progress}% <small>done today</small></span></div>
            <div className="week-bars">
              {weeklyData.map((day) => (
                <div className="week-col" key={day.name} title={`${day.name}: ${day.done}/${day.total} done`}>
                  <div className="week-track">
                    <span className={day.percent === 100 && day.total > 0 ? 'full' : ''} style={{ height: `${day.total ? Math.max(day.percent, 8) : 3}%` }} />
                  </div>
                  <small>{day.initial}</small>
                </div>
              ))}
            </div>
            <p className="week-note">{tasks.length ? `${tasks.filter((task) => task.completed).length} of ${tasks.length} tasks completed overall.` : 'Add a task to start your week.'}</p>
          </div>
        </section>

        {view === 'today' && <form className="task-entry" onSubmit={addTask}><div className="entry-icon">+</div><input autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="What needs to be done?" aria-label="Task title" /><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Task day"><option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option></select><button type="submit">Add task <span>↵</span></button></form>}

        <section className="task-section"><div className="section-heading"><div><span className="eyebrow">{view === 'today' ? 'Your plan' : 'All reminders'}</span><h2>{view === 'today' ? 'Today’s tasks' : 'Task timeline'}</h2></div><div className="filter-group"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All</button><button className={filter === 'pending' ? 'selected' : ''} onClick={() => setFilter('pending')}>Pending</button><button className={filter === 'done' ? 'selected' : ''} onClick={() => setFilter('done')}>Done</button></div></div><div className="task-list">{visibleTasks.length ? visibleTasks.map((task) => <article className={`task-row ${task.completed ? 'completed' : ''}`} key={task.id}><button className="check-button" onClick={() => toggleTask(task.id)} aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`}>{task.completed ? '✓' : ''}</button><div className="task-copy"><strong>{task.title}</strong><span>{task.period} <i>•</i> {task.date === todayKey ? 'Today' : task.date}</span>{(filesByTask[task.id] ?? []).length > 0 && <span className="file-chips">{filesByTask[task.id].map((file) => <span className="file-chip" key={file.id}><button className="file-open" onClick={() => openFile(file)} title={file.file_name}>📎 {file.file_name}</button><button className="file-remove" onClick={() => removeFile(file)} aria-label={`Remove ${file.file_name}`}>×</button></span>)}</span>}</div><label className={`attach-button ${uploadingFor === task.id ? 'busy' : ''}`} title="Attach a file">{uploadingFor === task.id ? '…' : '📎'}<input type="file" hidden disabled={uploadingFor === task.id} onChange={(event) => { uploadFile(task.id, event.target.files); event.target.value = '' }} /></label><button className="delete-button" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}>×</button></article>) : <div className="empty-state"><span>✦</span><h3>Nothing here yet</h3><p>Clear space for the next useful thing.</p></div>}</div></section>
      </div>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  )

}

export default App
