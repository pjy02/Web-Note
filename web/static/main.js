const state = {
  notes: [],
  currentId: null,
  authEnabled: false,
};

const noteListEl = document.getElementById('noteList');
const titleInput = document.getElementById('titleInput');
const contentInput = document.getElementById('contentInput');
const tagsInput = document.getElementById('tagsInput');
const previewArea = document.getElementById('previewArea');
const searchInput = document.getElementById('searchInput');
const tagFilter = document.getElementById('tagFilter');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');
const newNoteBtn = document.getElementById('newNoteBtn');

async function fetchConfig() {
  const res = await fetch('/api/config');
  const data = await res.json();
  state.authEnabled = data.auth_enabled;
  loginBtn.style.display = state.authEnabled ? 'inline-block' : 'none';
  logoutBtn.style.display = state.authEnabled ? 'inline-block' : 'none';
}

function renderList(notes) {
  noteListEl.innerHTML = '';
  if (!notes.length) {
    noteListEl.innerHTML = '<li class="empty">暂无笔记</li>';
    return;
  }
  notes.forEach((note) => {
    const li = document.createElement('li');
    li.textContent = `${note.title} (${new Date(note.updated_at || note.created_at).toLocaleString()})`;
    li.onclick = () => loadNote(note.id);
    if (state.currentId === note.id) li.classList.add('active');
    noteListEl.appendChild(li);
  });
}

function currentPayload() {
  return {
    title: titleInput.value.trim(),
    content: contentInput.value,
    tags: tagsInput.value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t),
  };
}

async function loadNotes() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.append('query', searchInput.value.trim());
  if (tagFilter.value.trim()) params.append('tag', tagFilter.value.trim());
  const res = await fetch(`/api/notes?${params.toString()}`);
  if (!res.ok) return alert('加载笔记失败');
  state.notes = await res.json();
  renderList(state.notes);
}

async function loadNote(id) {
  const res = await fetch(`/api/notes/${id}`);
  if (!res.ok) return alert('加载失败');
  const note = await res.json();
  state.currentId = note.id;
  titleInput.value = note.title;
  contentInput.value = note.content;
  tagsInput.value = (note.tags || []).join(',');
  updatePreview();
  renderList(state.notes);
}

function updatePreview() {
  const raw = contentInput.value;
  previewArea.innerHTML = marked.parse(raw || '');
}

async function saveNote() {
  const payload = currentPayload();
  const opts = {
    method: state.currentId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
  const url = state.currentId ? `/api/notes/${state.currentId}` : '/api/notes';
  const res = await fetch(url, opts);
  if (res.status === 401) return alert('请先登录');
  if (!res.ok) return alert('保存失败');
  const note = await res.json();
  state.currentId = note.id;
  await loadNotes();
}

async function deleteNote() {
  if (!state.currentId) return alert('请先选择笔记');
  if (!confirm('确认删除？')) return;
  const res = await fetch(`/api/notes/${state.currentId}`, { method: 'DELETE' });
  if (res.status === 401) return alert('请先登录');
  if (!res.ok) return alert('删除失败');
  resetEditor();
  await loadNotes();
}

function resetEditor() {
  state.currentId = null;
  titleInput.value = '';
  contentInput.value = '';
  tagsInput.value = '';
  previewArea.innerHTML = '';
  renderList(state.notes);
}

async function handleLogin() {
  const password = prompt('请输入管理密码');
  if (password === null) return;
  const form = new FormData();
  form.append('password', password);
  const res = await fetch('/api/login', { method: 'POST', body: form });
  if (!res.ok) return alert('登录失败');
  alert('登录成功');
}

async function handleLogout() {
  const res = await fetch('/api/logout', { method: 'POST' });
  if (!res.ok) return alert('登出失败');
  alert('已登出');
}

function bindEvents() {
  searchInput.addEventListener('input', () => loadNotes());
  tagFilter.addEventListener('input', () => loadNotes());
  contentInput.addEventListener('input', updatePreview);
  newNoteBtn.addEventListener('click', resetEditor);
  saveBtn.addEventListener('click', saveNote);
  deleteBtn.addEventListener('click', deleteNote);
  loginBtn.addEventListener('click', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
}

async function bootstrap() {
  bindEvents();
  await fetchConfig();
  await loadNotes();
  updatePreview();
}

bootstrap();
