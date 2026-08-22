import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
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

const today = new Date()
const todayKey = today.toISOString().slice(0, 10)

const starterTasks: Task[] = [
  { id: 1, title: 'Print 25 photosynthesis lab sheets', date: todayKey, period: 'Period 1', completed: false },
  { id: 2, title: 'Upload Year 8 reading feedback', date: todayKey, period: 'Period 3', completed: true },
  { id: 3, title: 'Email cover work for Friday', date: todayKey, period: 'Admin', completed: false },
  { id: 4, title: 'Set up microscopes for biology', date: todayKey, period: 'Period 5', completed: false },
]

const starterLinks: SchoolLink[] = [
  { id: 1, label: 'Staff portal', url: 'https://portal.example.edu', kind: 'Portal' },
  { id: 2, label: 'Gradebook', url: 'https://grades.example.edu', kind: 'Grades' },
]

function load<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) as T : fallback
  } catch {
    return fallback
  }
}

function App() {
  const [view, setView] = useState<'today' | 'reminders'>('today')
  const [tasks, setTasks] = useState<Task[]>(() => load('lessonplanr-tasks', starterTasks))
  const [links, setLinks] = useState<SchoolLink[]>(() => load('lessonplanr-links', starterLinks))
  const [taskTitle, setTaskTitle] = useState('')
  const [period, setPeriod] = useState('Period 1')
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [notifications, setNotifications] = useState(() => load('lessonplanr-notifications', false))
  const [notice, setNotice] = useState('')

  useEffect(() => localStorage.setItem('lessonplanr-tasks', JSON.stringify(tasks)), [tasks])
  useEffect(() => localStorage.setItem('lessonplanr-links', JSON.stringify(links)), [links])
  useEffect(() => localStorage.setItem('lessonplanr-notifications', JSON.stringify(notifications)), [notifications])

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

  function addTask(event: FormEvent) {
    event.preventDefault()
    const title = taskTitle.trim()
    if (!title) return
    setTasks((current) => [{ id: Date.now(), title, date: todayKey, period, completed: false }, ...current])
    setTaskTitle('')
    setNotice('Task added to today')
    window.setTimeout(() => setNotice(''), 2400)
  }

  function toggleTask(id: number) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, completed: !task.completed } : task))
  }

  function deleteTask(id: number) {
    setTasks((current) => current.filter((task) => task.id !== id))
  }

  function addLink(event: FormEvent) {
    event.preventDefault()
    if (!linkLabel.trim() || !linkUrl.trim()) return
    setLinks((current) => [...current, { id: Date.now(), label: linkLabel.trim(), url: linkUrl.trim(), kind: 'Shortcut' }])
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('today')} aria-label="Go to today's dashboard">
          <span className="brand-mark">lp</span>
          <span>lessonplanr</span>
        </button>
        <div className="topbar-actions">
          <button className="link-trigger" onClick={() => setShowLinkForm((current) => !current)}>
            <span className="link-icon">↗</span> School links <span className="chevron">⌄</span>
          </button>
          <button className="settings-trigger" onClick={() => setShowSettings((current) => !current)} aria-label="Open notification settings">⚙</button>
          <div className="avatar" aria-label="Teacher profile">JR</div>
        </div>
      </header>

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
          <div className="sync-status"><span className="status-dot" /> Saved locally</div>
        </div>

        <nav className="view-tabs" aria-label="Main navigation"><button className={view === 'today' ? 'active' : ''} onClick={() => setView('today')}>Today <span>{todayTasks.length}</span></button><button className={view === 'reminders' ? 'active' : ''} onClick={() => setView('reminders')}>Reminders <span>{pending}</span></button></nav>

        <section className="overview-grid">
          <div className="progress-panel">
            <div className="panel-topline"><span className="eyebrow">Today at a glance</span><span className="date-chip">22 AUG</span></div>
            <div className="progress-content"><div><strong className="progress-number">{progress}<span>%</span></strong><p>of today’s work complete</p></div><div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{completed}</strong><span>done</span></div></div></div>
            <div className="progress-bar"><span style={{ width: `${progress}%` }} /></div>
            <div className="progress-labels"><span>{pending} pending</span><span>{todayTasks.length} total tasks</span></div>
          </div>
          <div className="mini-chart"><div className="panel-topline"><span className="eyebrow">This week</span><span className="trend">↗ 18% <small>vs last week</small></span></div><div className="circle-chart-layout"><div className="weekly-ring" style={{ '--weekly-progress': `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}<span>%</span></strong><small>complete</small></div></div><div className="chart-legend"><div><span className="legend-dot completed-dot" /><span>Completed</span><strong>{completed}</strong></div><div><span className="legend-dot pending-dot" /><span>Pending</span><strong>{pending}</strong></div><p>Keep the momentum going.</p></div></div></div>
        </section>

        {view === 'today' && <form className="task-entry" onSubmit={addTask}><div className="entry-icon">+</div><input autoFocus value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="What needs to be done?" aria-label="Task title" /><select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Task period"><option>Period 1</option><option>Period 2</option><option>Period 3</option><option>Period 4</option><option>Period 5</option><option>Admin</option></select><button type="submit">Add task <span>↵</span></button></form>}

        <section className="task-section"><div className="section-heading"><div><span className="eyebrow">{view === 'today' ? 'Your plan' : 'All reminders'}</span><h2>{view === 'today' ? 'Today’s tasks' : 'Task timeline'}</h2></div><div className="filter-group"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All</button><button className={filter === 'pending' ? 'selected' : ''} onClick={() => setFilter('pending')}>Pending</button><button className={filter === 'done' ? 'selected' : ''} onClick={() => setFilter('done')}>Done</button></div></div><div className="task-list">{visibleTasks.length ? visibleTasks.map((task) => <article className={`task-row ${task.completed ? 'completed' : ''}`} key={task.id}><button className="check-button" onClick={() => toggleTask(task.id)} aria-label={`${task.completed ? 'Reopen' : 'Complete'} ${task.title}`}>{task.completed ? '✓' : ''}</button><div className="task-copy"><strong>{task.title}</strong><span>{task.period} <i>•</i> {task.date === todayKey ? 'Today' : task.date}</span></div><button className="delete-button" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}>×</button></article>) : <div className="empty-state"><span>✦</span><h3>Nothing here yet</h3><p>Clear space for the next useful thing.</p></div>}</div></section>
      </div>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  )

}

export default App
