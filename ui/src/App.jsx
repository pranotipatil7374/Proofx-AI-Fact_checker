import { useEffect, useRef, useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  ClipboardCheck,
  FileImage,
  ImagePlus,
  LoaderCircle,
  Radar,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || ''
const LOCAL_API_KEY = 'defame-local-key'
const POLL_MS = 1600
const JOB_TIMEOUT_MS = 90000

const stages = [
  { key: 'PENDING', label: 'Queued' },
  { key: 'RUNNING', label: 'Investigating' },
  { key: 'DONE', label: 'Verdict ready' },
]

function App() {
  const [claim, setClaim] = useState('')
  const [image, setImage] = useState(null)
  const [job, setJob] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jobStartedAt, setJobStartedAt] = useState(null)
  const fileInput = useRef(null)

  useEffect(() => {
    if (!job?.job_id || ['DONE', 'FAILED'].includes(job.status)) return undefined
    const timer = window.setInterval(async () => {
      try {
        if (jobStartedAt && Date.now() - jobStartedAt > JOB_TIMEOUT_MS) {
          setError((current) => current || 'The investigation is taking longer than expected. Still checking for results...')
        }
        const response = await fetch(`${API_URL}/results/${job.job_id}`)
        if (!response.ok) throw new Error(`Status request failed (${response.status})`)
        const data = await response.json()
        setJob({ job_id: job.job_id, status: data.job_info.status, message: data.job_info.status_message })
        if (data.job_info.status === 'DONE' || data.job_info.status === 'FAILED') {
          setResult(data)
          setIsSubmitting(false)
          setError('')
        }
      } catch (requestError) {
        setError(requestError.message)
        setIsSubmitting(false)
      }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [job?.job_id, job?.status, jobStartedAt])

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImage({ name: file.name, preview: reader.result, base64: reader.result.split(',')[1] })
    reader.readAsDataURL(file)
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!claim.trim() && !image) {
      setError('Add a claim, an image, or both before starting.')
      return
    }
    setIsSubmitting(true)
    setJobStartedAt(Date.now())
    setError('')
    setResult(null)
    setJob({ status: 'PENDING', message: 'Sending your claim to DEFAME...' })
    const content = []
    if (claim.trim()) content.push(['text', claim.trim()])
    if (image) content.push(['image', image.base64])

    try {
      const response = await fetch(`${API_URL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': LOCAL_API_KEY },
        body: JSON.stringify({ content }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`)
      setJob({ job_id: data.job_id, status: 'PENDING', message: 'Job accepted. Preparing investigation...' })
    } catch (requestError) {
      setJob(null)
      setJobStartedAt(null)
      setIsSubmitting(false)
      setError(requestError.message)
    }
  }

  const reset = () => {
    setClaim('')
    setImage(null)
    setJob(null)
    setJobStartedAt(null)
    setResult(null)
    setError('')
  }

  const verdict = result?.content?.verdict || result?.claims?.[0]?.verdict
  const justification = result?.claims?.[0]?.justification || []
  const firstClaimId = result?.claims?.[0]?.claim_id
  const reportClaimIndex = firstClaimId?.split('/').at(-1)
  const reportUrl = result?.job_info?.status === 'DONE' && reportClaimIndex !== undefined
    ? `${API_URL}/results/${result.job_info.job_id}/${reportClaimIndex}/report.pdf`
    : null
  const statusIndex = job?.status === 'DONE' ? 2 : job?.status === 'RUNNING' ? 1 : 0

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="DEFAME home">
          <span className="brand-mark"><Radar size={18} strokeWidth={2.5} /></span>
          <span>ProofX-AI<span className="brand-slash"></span></span>
        </a>
        <div className="topbar-meta"><span className="status-dot" /> Evidence intelligence <span className="topbar-divider" /> API connected</div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={14} /> Dynamic evidence-based fact checking</p>
          <h1>Bring a claim.<br /><em>Leave with clarity.</em></h1>
          <p className="hero-intro">Submit a statement, an image, or both. DEFAME will trace the signal through live evidence and return a reasoned verdict.</p>
        </div>
        <div className="hero-stamp"><span>01</span><span>VERIFY<br />WHAT'S<br />REAL</span></div>
      </section>

      <section className="workspace">
        <form className="input-panel" onSubmit={submit}>
          <div className="panel-heading"><div><span className="section-kicker">Start an investigation</span><h2>What should we examine?</h2></div><span className="panel-number">A / 01</span></div>
          <label className="claim-label" htmlFor="claim">Your claim</label>
          <textarea id="claim" value={claim} onChange={(event) => setClaim(event.target.value)} placeholder="Write the statement you want checked..." rows="5" />
          <div className="input-foot"><span>{claim.length} characters</span><span>Text is optional when an image is attached</span></div>

          <div className="upload-zone" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]) }}>
            <input ref={fileInput} type="file" accept="image/*" onChange={(event) => handleFile(event.target.files[0])} />
            {image ? <div className="image-selected"><img src={image.preview} alt="Selected claim" /><div><strong>{image.name}</strong><span>Image attached for context</span></div><button type="button" className="remove-image" onClick={(event) => { event.stopPropagation(); setImage(null) }} aria-label="Remove image"><X size={16} /></button></div> : <><span className="upload-icon"><ImagePlus size={21} /></span><div><strong>Drop an image here</strong><span>or choose from your device · JPG, PNG, WEBP</span></div><Upload size={17} className="upload-arrow" /></>}
          </div>

          {error && <div className="error-message"><CircleAlert size={16} />{error}</div>}
          <button className="submit-button" type="submit" disabled={isSubmitting}><span>{isSubmitting ? 'Investigation in progress' : 'Run fact-check'}</span>{isSubmitting ? <LoaderCircle className="spin" size={19} /> : <ArrowUpRight size={19} />}</button>
        </form>

        <aside className="status-panel">
          <div className="panel-heading"><div><span className="section-kicker">Live status</span><h2>Signal monitor</h2></div><Tooltip.Provider delayDuration={250}><Tooltip.Root><Tooltip.Trigger asChild><span className="live-badge"><span /> LIVE</span></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="tooltip-content" sideOffset={8}>Backend monitor is online<Tooltip.Arrow className="tooltip-arrow" /></Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider></div>
          <div className="signal-graphic"><div className="signal-ring ring-one" /><div className="signal-ring ring-two" /><div className="signal-core"><Radar size={28} /></div><span className="scan-line" /></div>
          <div className="stage-list">{stages.map((stage, index) => <div className={`stage ${index <= statusIndex && job ? 'active' : ''}`} key={stage.key}><span className="stage-marker">{index < statusIndex ? <Check size={12} /> : index === statusIndex && job ? <span className="stage-pulse" /> : String(index + 1).padStart(2, '0')}</span><span>{stage.label}</span>{index === statusIndex && job && <small>{job.message || 'Working...'}</small>}</div>)}</div>
          <div className="monitor-note"><ClipboardCheck size={17} /><span>Every result is supported by retrieved sources and a transparent reasoning trail.</span></div>
        </aside>
      </section>

      {result && <section className="result-panel"><div className="result-header"><div><span className="section-kicker">Investigation complete</span><h2>The signal report</h2></div><button className="reset-button" onClick={reset}><RotateCcw size={16} /> New check</button></div><div className="result-grid"><div className={`verdict-card ${String(verdict || '').toLowerCase()}`}><span className="verdict-label">Verdict</span><strong>{verdict || 'No verdict'}</strong><p>{result.job_info?.status_message}</p>{reportUrl && <a className="report-link" href={reportUrl} target="_blank" rel="noreferrer"><FileImage size={16} /> View report PDF</a>}<ShieldCheck size={44} /></div><div className="reasoning-card"><span className="verdict-label">Reasoning</span><p>{justification.length ? justification.map((part) => part[1]).join(' ') : 'The backend returned no written justification.'}</p><div className="source-line"><span className="status-dot" /> Evidence trail recorded in DEFAME</div></div></div></section>}

      <footer><span>DEFAME / SIGNAL DESK</span><span>Built for careful reading in a noisy world</span><span>LOCAL INSTANCE · {API_URL.replace('http://', '')}</span></footer>
    </main>
  )
}

export default App
