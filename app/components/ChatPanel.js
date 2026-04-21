'use client'
import { useRef } from 'react'
const avatarColors = [
  { bg:'#eff6ff', c:'#1d4ed8' },
  { bg:'#f0fdf4', c:'#16a34a' },
  { bg:'#faf5ff', c:'#7c3aed' },
  { bg:'#fff7ed', c:'#c2410c' },
]
function getCol(i) { return avatarColors[i % 4] }
function initials(n) { return (n || '?').split(' ').map(x => x[0]).join('').toUpperCase().substring(0, 2) }
function fmtTime(d, lang) { return new Date(d).toLocaleTimeString(lang === 'pl' ? 'pl-PL' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) }
function fileIcon(n) {
  if (!n) return 'FILE'
  if (n.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'IMG'
  if (n.match(/\.pdf$/i)) return 'PDF'
  return 'FILE'
}
export default function ChatPanel({
  user, lang,
  chatUsers, chatSelected, setChatSelected,
  chatMessages, chatText, setChatText,
  chatUnread, chatTaskObj, setChatTaskObj,
  chatTaskRef, setChatTaskRef,
  showChatTaskPicker, setShowChatTaskPicker,
  chatTaskSearch, setChatTaskSearch,
  chatAllTasks, chatSending,
  chatEndRef, chatFileRef, chatInputRef,
  sendChatMsg, sendChatFile,
  onClose,
}) {
  const filtTasks = chatAllTasks.filter(t =>
    !chatTaskSearch ||
    (t.product_name || '').toLowerCase().includes(chatTaskSearch.toLowerCase()) ||
    (t.order_number || '').toLowerCase().includes(chatTaskSearch.toLowerCase())
  )
  return (
    <div style={{ width: '320px', background: '#fff', borderLeft: '1px solid #e8e8e6', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #e8e8e6', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M12 7c0 2.8-2.2 5-5 5l-3 1.5.5-2C3 10.4 2 8.8 2 7c0-2.8 2.2-5 5-5s5 2.2 5 5z" stroke="#374151" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#111', flex: 1, letterSpacing: '-0.2px' }}>
          {lang === 'pl' ? 'Wiadomosci' : 'Messages'}
        </span>
        <button onClick={onClose} style={{ width: '22px', height: '22px', background: '#f4f4f3', border: 'none', borderRadius: '5px', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', lineHeight: '1' }}>×</button>
      </div>
      {/* User list */}
      {!chatSelected && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '500', padding: '10px 14px 6px' }}>
            {lang === 'pl' ? 'Wybierz osobe' : 'Select person'}
          </div>
          {chatUsers.map((u, i) => {
            const col = getCol(i)
            const unread = chatUnread[u.id] || 0
            return (
              <div
                key={u.id}
                onClick={() => setChatSelected(u)}
                style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0ee' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f4f4f3'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: col.bg, color: col.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '500', flexShrink: 0 }}>
                  {initials(u.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: unread ? '600' : '500', color: '#111' }}>{u.full_name}</div>
                </div>
                {unread > 0 && (
                  <span style={{ background: '#2563eb', color: 'white', fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '8px' }}>{unread}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {/* Conversation */}
      {chatSelected && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Conversation header */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e8e8e6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setChatSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '16px', padding: '0', lineHeight: '1' }}>←</button>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#111', flex: 1 }}>{chatSelected.full_name}</div>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }}></div>
          </div>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fafaf9' }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '12px', marginTop: '30px' }}>
                {lang === 'pl' ? 'Brak wiadomosci' : 'No messages yet'}
              </div>
            )}
            {chatMessages.map(msg => {
              const isMine = msg.sender_id === user?.id
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '85%', alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
                  {msg.task_ref && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '5px', padding: '2px 7px', fontSize: '10px', color: '#1d4ed8', fontWeight: '500', marginBottom: '3px' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#2563eb' }}></div>
                      {msg.task_ref}
                    </div>
                  )}
                  {msg.content && (
                    msg.task_ref && !isMine ? (
                      <div style={{ padding: '8px 12px', borderRadius: '10px', fontSize: '12px', lineHeight: '1.5', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
                        {msg.content}
                        <div style={{ marginTop: '4px', fontSize: '10px', color: '#93c5fd' }}>
                          {lang === 'pl' ? 'Kliknij task powyzej aby otworzyc' : 'Click task above to open'}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '8px 12px', borderRadius: '10px', fontSize: '12px', lineHeight: '1.5', background: isMine ? '#111' : '#fff', color: isMine ? 'white' : '#111', border: isMine ? 'none' : '1px solid #e8e8e6' }}>
                        {msg.content}
                      </div>
                    )
                  )}
                  {msg.file_url && (
                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 11px', borderRadius: '9px', background: '#fff', border: '1px solid #e8e8e6' }}>
                        <div style={{ width: '28px', height: '28px', background: '#eff6ff', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '600', color: '#1d4ed8' }}>
                          {fileIcon(msg.file_name)}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '500', color: '#111', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.file_name}
                        </div>
                      </div>
                    </a>
                  )}
                  <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '2px' }}>{fmtTime(msg.created_at, lang)}</div>
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>
          {/* Input area */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #e8e8e6', background: '#fff' }}>
            {chatTaskObj && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '3px 8px', fontSize: '10px', color: '#1d4ed8', fontWeight: '500', marginBottom: '7px' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#2563eb' }}></div>
                {chatTaskRef}
                <button onClick={() => { setChatTaskObj(null); setChatTaskRef('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: '14px', padding: '0 0 0 3px' }}>×</button>
              </div>
            )}
            {showChatTaskPicker && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e6', borderRadius: '9px', padding: '8px', marginBottom: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                <input
                  value={chatTaskSearch}
                  onChange={e => setChatTaskSearch(e.target.value)}
                  placeholder={lang === 'pl' ? 'Szukaj zadania...' : 'Search task...'}
                  style={{ width: '100%', padding: '6px 9px', border: '1px solid #e8e8e6', borderRadius: '6px', fontSize: '11px', outline: 'none', marginBottom: '6px', fontFamily: "'DM Sans',sans-serif" }}
                  autoFocus
                />
                {filtTasks.slice(0, 6).map(t => (
                  <div
                    key={t.id}
                    onClick={() => { setChatTaskObj(t); setChatTaskRef(`#${t.order_number || t.id.substring(0, 6).toUpperCase()} · ${t.product_name}`); setShowChatTaskPicker(false); setChatTaskSearch('') }}
                    style={{ padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#111', display: 'flex', alignItems: 'center', gap: '7px' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f4f4f3'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ color: '#2563eb', fontWeight: '500', fontFamily: "'DM Mono',monospace", fontSize: '10px' }}>
                      {t.order_number || t.id.substring(0, 6).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.product_name}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input ref={chatFileRef} type="file" style={{ display: 'none' }} onChange={sendChatFile} />
              <button
                onClick={() => chatFileRef.current?.click()}
                style={{ width: '30px', height: '30px', background: '#fafaf9', border: '1px solid #e8e8e6', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M10 6L6 10C4.6 11.4 2.3 11.4 1 10C-.3 8.7-.3 6.4 1 5L6 .5C6.9-.4 8.4-.4 9.3.5C10.1 1.4 10.1 2.9 9.3 3.7L4.3 8.7C3.8 9.2 3.1 9.2 2.6 8.7C2.1 8.2 2.1 7.5 2.6 7L7 2.5" stroke="#6b7280" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
              </button>
              <button
                onClick={() => setShowChatTaskPicker(v => !v)}
                style={{ padding: '0 9px', height: '30px', background: showChatTaskPicker ? '#eff6ff' : '#fafaf9', border: `1px solid ${showChatTaskPicker ? '#bfdbfe' : '#e8e8e6'}`, borderRadius: '7px', cursor: 'pointer', fontSize: '10px', color: showChatTaskPicker ? '#1d4ed8' : '#6b7280', fontWeight: '500', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap' }}
              >
                + Task
              </button>
              <input
                ref={chatInputRef}
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMsg() } }}
                placeholder={lang === 'pl' ? 'Napisz... (Enter)' : 'Type... (Enter)'}
                style={{ flex: 1, padding: '7px 10px', border: '1px solid #e8e8e6', borderRadius: '7px', fontSize: '12px', outline: 'none', background: '#fafaf9', color: '#111', fontFamily: "'DM Sans',sans-serif" }}
                onFocus={e => e.target.style.borderColor = '#111'}
                onBlur={e => e.target.style.borderColor = '#e8e8e6'}
              />
              <button
                onClick={sendChatMsg}
                disabled={chatSending || !(chatText || '').trim()}
                style={{ width: '30px', height: '30px', background: '#111', border: 'none', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: (chatSending || !(chatText || '').trim()) ? 0.4 : 1 }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M11 6H1M11 6L7 2M11 6L7 10" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
