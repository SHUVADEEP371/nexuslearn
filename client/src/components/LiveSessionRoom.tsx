import { FormEvent, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AlertTriangle, CameraOff, Check, ClipboardList, Download, Loader2, Mic, MicOff, PhoneOff, Send, Sparkles, Video, VideoOff } from 'lucide-react';
import api, { getAccessToken, refreshAccessToken, setAccessToken } from '../config/api';

interface SessionInfo {
  _id: string;
  swapId: string;
  skill: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'scheduled' | 'live' | 'completed' | 'cancelled' | 'disputed';
  mode?: 'CREDIT' | 'PAID';
  paymentStatus?: string;
  participants: string[];
  iceServers?: RTCIceServer[];
}
interface Props { session: SessionInfo; viewerId: string }
interface ChatMessage { _id?: string; sessionId: string; senderId: string; clientMessageId?: string; body: string; createdAt: string }
interface NoteDoc { markdown: string; revision: number; summary?: string; takeaways?: string[] }
interface SocketSignal { sessionId: string; kind: 'offer' | 'answer' | 'ice' | 'ready' | 'hangup'; from: string; sdp?: string; candidate?: RTCIceCandidateInit }

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export default function LiveSessionRoom({ session, viewerId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [note, setNote] = useState<NoteDoc>({ markdown: '', revision: 0 });
  const [draft, setDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamPreview, setStreamPreview] = useState('');
  const [aiError, setAiError] = useState('');
  const [syllabus, setSyllabus] = useState<{ title: string; icebreaker: string; agenda: Array<{ minutes: number; topic: string; activity: string }> } | null>(null);
  const [learningGoal, setLearningGoal] = useState(session.skill);
  const [lessonDuration, setLessonDuration] = useState<30 | 60>(30);
  const [debriefTopics, setDebriefTopics] = useState('');
  const [challenges, setChallenges] = useState('');
  const [feedback, setFeedback] = useState<{ learnerRecommendations?: string[]; teachingInsights?: { strengths: string[]; improvements: string[] }; nextSteps?: Array<{ title: string; detail: string; estimatedMinutes: number }> } | null>(null);
  const [mediaActive, setMediaActive] = useState(false);
  const [sessionStatus, setSessionStatus] = useState(session.status);
  const [callState, setCallState] = useState('Video is off');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const makingOfferRef = useRef(false);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setAiError('Sign in again to join the live session.'); return; }
    const socket = io(socketUrl, { auth: { token }, transports: ['websocket'], reconnection: true, reconnectionAttempts: 8 });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('session:join', { sessionId: session._id }, (result: { ok: boolean; message?: string }) => { if (!result.ok) setAiError(result.message || 'Could not join this session.'); }));
    socket.on('connect_error', async (error: Error) => {
      if (error.message === 'UNAUTHORIZED') {
        try {
          const renewedToken = await refreshAccessToken();
          setAccessToken(renewedToken);
          socket.auth = { token: renewedToken };
          socket.connect();
          return;
        } catch { setAiError('Your sign-in expired. Sign in again to continue.'); return; }
      }
      setAiError('Realtime connection unavailable. Refresh or try again shortly.');
    });
    socket.on('notes:initial', ({ note: initial }: { note: NoteDoc | null }) => { const value = initial || { markdown: '', revision: 0 }; setNote(value); setDraft(value.markdown || ''); });
    socket.on('notes:updated', ({ note: updated }: { note: NoteDoc }) => { setNote(updated); setDraft(updated.markdown || ''); setNotesDirty(false); });
    socket.on('ai:notes:chunk', ({ chunk, attempt }: { chunk: string; attempt: number }) => { if (attempt > 0) setStreamPreview(''); setStreamPreview((current) => `${current}${chunk}`.slice(-4000)); setStreaming(true); setAiError(''); });
    socket.on('ai:notes:complete', ({ note: updated }: { note: NoteDoc }) => { setNote(updated); setDraft(updated.markdown || ''); setNotesDirty(false); setStreaming(false); setStreamPreview(''); });
    socket.on('ai:notes:error', ({ message: reason }: { message: string }) => { setAiError(reason); setStreaming(false); });
    socket.on('ai:feedback:ready', ({ feedback: readyFeedback }: { feedback: NonNullable<typeof feedback> }) => setFeedback(readyFeedback));
    socket.on('chat:history', ({ messages: history }: { messages: ChatMessage[] }) => setMessages(history));
    socket.on('chat:message', (item: ChatMessage) => setMessages((current) => current.some((entry) => entry.clientMessageId && entry.clientMessageId === item.clientMessageId && entry.senderId === item.senderId) ? current : [...current, item]));
    socket.on('call:signal', (signal: SocketSignal) => { void handleCallSignal(signal, socket); });
    socket.on('session:participant-joined', ({ userId }: { userId: string }) => { if (userId !== viewerId && localStreamRef.current) socket.emit('call:signal', { sessionId: session._id, kind: 'ready' }); });
    return () => { socket.disconnect(); socketRef.current = null; closePeer(); };
    // Session identity is immutable while this room is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session._id]);

  useEffect(() => {
    if (!['COMPLETED', 'completed'].includes(session.status)) return;
    api.get(`/ai/session-feedback/${session._id}`).then((response) => setFeedback(response.data.feedback)).catch(() => undefined);
  }, [session._id, session.status]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!notesDirty || !socketRef.current) return;
    const timeout = window.setTimeout(() => {
      const expectedRevision = note.revision;
      socketRef.current?.emit('notes:edit', { sessionId: session._id, markdown: draft, expectedRevision }, (result: { ok: boolean; revision?: number; message?: string }) => {
        if (result.ok && result.revision !== undefined) { setNote((current) => ({ ...current, markdown: draft, revision: result.revision as number })); setNotesDirty(false); }
        else setAiError(result.message || 'Could not save the shared notes.');
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [draft, notesDirty, note.revision, session._id]);

  function createPeer(): RTCPeerConnection {
    if (peerRef.current) return peerRef.current;
    const peer = new RTCPeerConnection({ iceServers: session.iceServers?.length ? session.iceServers : [{ urls: 'stun:stun.l.google.com:19302' }] });
    localStreamRef.current?.getTracks().forEach((track) => peer.addTrack(track, localStreamRef.current as MediaStream));
    peer.ontrack = (event) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0]; setCallState('Connected'); };
    peer.onicecandidate = (event) => { if (event.candidate) socketRef.current?.emit('call:signal', { sessionId: session._id, kind: 'ice', candidate: event.candidate.toJSON() }); };
    peer.onconnectionstatechange = () => { setCallState(peer.connectionState === 'connected' ? 'Connected' : peer.connectionState); };
    peerRef.current = peer;
    return peer;
  }

  function closePeer() {
    peerRef.current?.close(); peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop()); localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }

  async function startVideo() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      createPeer();
      setMediaActive(true); setCallState('Waiting for peer');
      socketRef.current?.emit('call:signal', { sessionId: session._id, kind: 'ready' });
    } catch { setCallState('Camera or microphone permission unavailable'); }
  }

  async function handleCallSignal(signal: SocketSignal, socket: Socket) {
    if (signal.sessionId !== session._id) return;
    if (signal.kind === 'hangup') { closePeer(); setMediaActive(false); setCallState('Peer left the call'); return; }
    if (signal.kind === 'ready') {
      const isInitiator = [...session.participants].sort()[0] === viewerId;
      if (isInitiator && peerRef.current && localStreamRef.current && !peerRef.current.localDescription && !makingOfferRef.current) {
        try {
          makingOfferRef.current = true;
          const offer = await peerRef.current.createOffer();
          await peerRef.current.setLocalDescription(offer);
          socket.emit('call:signal', { sessionId: session._id, kind: 'offer', sdp: JSON.stringify(peerRef.current.localDescription) });
        } catch { setCallState('Could not start the peer connection'); }
        finally { makingOfferRef.current = false; }
      }
      return;
    }
    if (signal.kind === 'ice') {
      if (peerRef.current?.remoteDescription && signal.candidate) await peerRef.current.addIceCandidate(signal.candidate).catch(() => undefined);
      else if (signal.candidate) pendingIceRef.current.push(signal.candidate);
      return;
    }
    if (!peerRef.current || !signal.sdp) return;
    const description = JSON.parse(signal.sdp) as RTCSessionDescriptionInit;
    try {
      await peerRef.current.setRemoteDescription(description);
      for (const candidate of pendingIceRef.current.splice(0)) await peerRef.current.addIceCandidate(candidate).catch(() => undefined);
      if (signal.kind === 'offer') {
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socket.emit('call:signal', { sessionId: session._id, kind: 'answer', sdp: JSON.stringify(peerRef.current.localDescription) });
      }
    } catch { setCallState('Could not establish the peer connection'); }
  }

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    const body = message.trim();
    if (!body || !socketRef.current) return;
    const clientMessageId = crypto.randomUUID();
    socketRef.current.emit('chat:send', { sessionId: session._id, clientMessageId, body }, (result: { ok: boolean; message?: string }) => { if (result.ok) setMessage(''); else setAiError(result.message || 'Unable to send message.'); });
  }

  function requestSummary() {
    setStreaming(true); setStreamPreview(''); setAiError('');
    const transcript = messages.map((item) => `${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${item.senderId === viewerId ? 'Me' : 'Partner'}: ${item.body}`).join('\n').slice(-8000);
    socketRef.current?.emit('ai:notes:trigger', { sessionId: session._id, transcript }, (result: { ok: boolean; message?: string }) => { if (!result.ok) { setStreaming(false); setAiError(result.message || 'AI could not summarize this session.'); } });
  }

  async function generateSyllabus() {
    try {
      const response = await api.post('/ai/generate-syllabus', { swapId: session.swapId, learningGoal, durationMinutes: lessonDuration });
      setSyllabus(response.data.syllabus);
    } catch (error) { setAiError((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Could not generate a lesson plan.'); }
  }

  async function submitDebrief(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await api.post('/ai/session-feedback', { sessionId: session._id, debrief: { topicsCovered: debriefTopics.split(',').map((item) => item.trim()).filter(Boolean), challenges } });
      if (response.data.feedback?.learnerRecommendations?.length) setFeedback(response.data.feedback);
      if (response.data.status === 'awaiting-other-participant') setAiError('Your debrief is saved. Feedback will be ready when your partner submits theirs.');
      else setAiError('');
    } catch (error) { setAiError((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Could not save the debrief.'); }
  }

  async function endSession() {
    try {
      await api.post(`/sessions/${session._id}/end`);
      setSessionStatus('completed');
      closePeer(); setMediaActive(false); setCallState('Session ended');
      socketRef.current?.emit('call:signal', { sessionId: session._id, kind: 'hangup' });
    } catch (error) { setAiError((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Could not end the session.'); }
  }

  async function cancelSession() {
    if (!window.confirm('Cancel this scheduled session and return its Skill Credit to the learner?')) return;
    try {
      await api.post(`/sessions/${session._id}/cancel`);
      setSessionStatus('CANCELLED'); closePeer(); setMediaActive(false); socketRef.current?.disconnect();
      setAiError('Session cancelled. The held Skill Credit was returned to the learner.');
    } catch (error) { setAiError((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Could not cancel the session.'); }
  }

  async function disputeSession() {
    const reason = window.prompt('Briefly describe the attendance or conduct issue (5–1000 characters):')?.trim();
    if (!reason) return;
    try {
      await api.post(`/sessions/${session._id}/dispute`, { reason });
      setSessionStatus('DISPUTED'); closePeer(); setMediaActive(false); socketRef.current?.disconnect();
      setAiError('Dispute recorded. The Skill Credit remains held while it is reviewed.');
    } catch (error) { setAiError((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Could not submit the dispute.'); }
  }

  async function downloadCalendar() {
    try {
      const response = await api.get(`/sessions/${session._id}/ics`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a'); link.href = url; link.download = `nexuslearn-session-${session._id}.ics`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { setAiError('Could not download this calendar event.'); }
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] p-3 text-slate-100 sm:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-300">NexusLearn live room</p><h1 className="mt-1 text-xl font-semibold">{session.skill}</h1></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void downloadCalendar()} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"><Download className="h-4 w-4" /> Calendar</button>
          <button type="button" onClick={() => void generateSyllabus()} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"><ClipboardList className="h-4 w-4" /> Lesson plan</button>
          {mediaActive && <button type="button" onClick={() => { closePeer(); setMediaActive(false); setCallState('Call ended'); socketRef.current?.emit('call:signal', { sessionId: session._id, kind: 'hangup' }); }} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold hover:bg-rose-500"><PhoneOff className="h-4 w-4" /> Leave call</button>}
          {['SCHEDULED', 'ACTIVE', 'scheduled', 'live'].includes(sessionStatus) && <button type="button" onClick={() => void endSession()} className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"><Check className="h-4 w-4" /> End session</button>}
          {['SCHEDULED', 'scheduled'].includes(sessionStatus) && session.mode === 'CREDIT' && session.paymentStatus === 'HELD_IN_ESCROW' && <><button type="button" onClick={() => void cancelSession()} className="inline-flex items-center gap-2 rounded-xl border border-rose-700 px-3 py-2 text-sm text-rose-200 hover:bg-rose-950"><PhoneOff className="h-4 w-4" /> Cancel</button><button type="button" onClick={() => void disputeSession()} className="inline-flex items-center gap-2 rounded-xl border border-amber-700 px-3 py-2 text-sm text-amber-200 hover:bg-amber-950"><AlertTriangle className="h-4 w-4" /> Dispute</button></>}
        </div>
      </header>

      {aiError && <div role="status" className="mb-3 rounded-xl border border-amber-700/50 bg-amber-950/50 px-4 py-3 text-sm text-amber-100">{aiError}<button className="ml-3 underline" onClick={() => setAiError('')}>Dismiss</button></div>}
      <div className="grid min-h-[70vh] gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,.9fr)]">
        <section className="grid min-h-[70vh] gap-4 lg:grid-rows-[minmax(320px,1fr)_minmax(240px,.7fr)]">
          <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
            <video ref={remoteVideoRef} autoPlay playsInline className="h-full min-h-[320px] w-full object-cover" />
            {!mediaActive && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,#1e3a34,#080d16_65%)] text-center"><Video className="h-10 w-10 text-emerald-300" /><p className="font-semibold">{callState}</p><button onClick={() => void startVideo()} className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold hover:bg-emerald-500">Enable camera & microphone</button></div>}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-emerald-400" /> {callState}</div>
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button title={muted ? 'Unmute microphone' : 'Mute microphone'} onClick={() => { localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = muted; }); setMuted((value) => !value); }} className="rounded-full bg-black/60 p-3">{muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
              <button title={cameraOff ? 'Turn camera on' : 'Turn camera off'} onClick={() => { localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = cameraOff; }); setCameraOff((value) => !value); }} className="rounded-full bg-black/60 p-3">{cameraOff ? <CameraOff className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}</button>
            </div>
            <video ref={localVideoRef} autoPlay muted playsInline className="absolute right-4 top-4 h-24 w-36 rounded-xl border border-slate-600 bg-slate-900 object-cover" />
          </div>
          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
            <h2 className="border-b border-slate-700 px-4 py-3 font-semibold">Session chat</h2>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((item, index) => <div key={item._id || item.clientMessageId || index} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${item.senderId === viewerId ? 'ml-auto bg-emerald-800/80' : 'bg-slate-800'}`}><p className="mb-1 text-[11px] text-slate-300">{item.senderId === viewerId ? 'You' : 'Partner'} · {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p><p className="whitespace-pre-wrap break-words">{item.body}</p></div>)}<div ref={chatEndRef} /></div>
            <form onSubmit={submitMessage} className="flex gap-2 border-t border-slate-700 p-3"><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} placeholder="Share a question or idea..." className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500" /><button type="submit" disabled={!message.trim()} aria-label="Send message" className="rounded-xl bg-emerald-600 p-3 disabled:opacity-40"><Send className="h-4 w-4" /></button></form>
          </section>
        </section>

        <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-4 py-3"><div><h2 className="font-semibold">Shared AI notes</h2><p className="mt-0.5 text-xs text-slate-400">Edits sync to both participants · revision {note.revision}</p></div><button type="button" onClick={requestSummary} disabled={streaming || !['SCHEDULED', 'ACTIVE', 'scheduled', 'live'].includes(sessionStatus)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50">{streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {streaming ? 'Summarizing…' : 'AI summarize'}</button></div>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-700 px-4 py-3"><input aria-label="Learning goal" value={learningGoal} onChange={(event) => setLearningGoal(event.target.value)} maxLength={500} className="min-w-40 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" placeholder="Learner's goal for this lesson" /><select aria-label="Lesson duration" value={lessonDuration} onChange={(event) => setLessonDuration(Number(event.target.value) as 30 | 60)} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs"><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></div>
          {streaming && <div className="flex items-center gap-2 bg-emerald-950/50 px-4 py-2 text-xs text-emerald-200"><Loader2 className="h-3 w-3 animate-spin" /> AI is extracting takeaways; the room stays live.</div>}
          {streaming && streamPreview && <pre aria-live="polite" className="max-h-28 overflow-auto border-b border-slate-700 bg-slate-950 px-4 py-2 text-xs text-emerald-100">{streamPreview}</pre>}
          <textarea aria-label="Shared session notes" value={draft} onChange={(event) => { setDraft(event.target.value); setNotesDirty(true); }} readOnly={!['SCHEDULED', 'ACTIVE', 'scheduled', 'live'].includes(sessionStatus)} placeholder="Capture ideas, questions, and examples together…" className="min-h-[380px] flex-1 resize-none bg-slate-950/70 p-5 font-mono text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-600" />
          <div className="border-t border-slate-700 px-4 py-2 text-xs text-slate-400">{notesDirty ? 'Saving shared notes…' : 'All changes saved'}</div>
          {syllabus && <div className="max-h-48 overflow-y-auto border-t border-slate-700 p-4 text-sm"><h3 className="font-semibold text-emerald-200">{syllabus.title}</h3><p className="my-2 text-slate-300">Icebreaker: {syllabus.icebreaker}</p>{syllabus.agenda.map((item, index) => <p key={index} className="py-1 text-slate-300"><b>{item.minutes}m · {item.topic}:</b> {item.activity}</p>)}</div>}
          {['COMPLETED', 'completed'].includes(sessionStatus) && <form onSubmit={submitDebrief} className="border-t border-slate-700 p-4"><h3 className="mb-3 font-semibold">Session debrief</h3><input value={debriefTopics} onChange={(event) => setDebriefTopics(event.target.value)} placeholder="Topics covered, comma separated" className="mb-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /><textarea value={challenges} onChange={(event) => setChallenges(event.target.value)} placeholder="What felt challenging?" maxLength={2000} className="mb-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm" /><button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold">Create shared feedback</button></form>}
          {feedback && <div className="max-h-56 space-y-2 overflow-y-auto border-t border-slate-700 p-4 text-sm"><h3 className="font-semibold text-emerald-200">AI feedback & next steps</h3>{feedback.learnerRecommendations?.map((item, index) => <p key={`lr-${index}`}>• {item}</p>)}{feedback.teachingInsights?.strengths.map((item, index) => <p key={`s-${index}`} className="text-slate-300">Teaching strength: {item}</p>)}{feedback.teachingInsights?.improvements.map((item, index) => <p key={`i-${index}`} className="text-slate-300">Teaching idea: {item}</p>)}{feedback.nextSteps?.map((item, index) => <p key={`n-${index}`}><b>{item.title} ({item.estimatedMinutes}m):</b> {item.detail}</p>)}</div>}
        </section>
      </div>
      <p className="mt-3 text-xs text-slate-500">AI output can be wrong; review generated notes before relying on them. Camera and microphone remain off until you enable them.</p>
    </main>
  );
}
