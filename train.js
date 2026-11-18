import { stages, buildBank } from './curriculum.js';
import { loadStudy } from './study-storage.js';
import { setupBackup, setupJournalForm } from './train-forms.js';
import { $, KEY, feedback, save, showPuzzle, train } from './train-state.js';
import { journal, load, next, rebuild } from './train-session.js';
import { draw } from './train-board.js';
import { getHint, markAssisted, play } from './train-play.js';

if (matchMedia('(max-width:700px)').matches) $('topic-panel').open = false;

$('live-position').onclick = () => {
  train.trace = train.trace.filter((t) => !t.refute);
  train.viewStep = -1;
  draw();
};

for (const m of ['today', 'practice', 'review', 'test'])
  $(`mode-${m}`).onclick = () => {
    train.mode = m;
    rebuild();
  };

$('stage-select').onchange = () => {
  train.stage = $('stage-select').value;
  train.topic = 'all';
  rebuild();
  showPuzzle();
};

$('previous').onclick = () => {
  if (train.mode !== 'test' && train.index > 0) {
    train.index--;
    load();
    showPuzzle();
  }
};

$('topic').onchange = () => {
  train.topic = $('topic').value;
  rebuild();
};

$('problem-select').onchange = () => {
  train.index = Number($('problem-select').value);
  load();
  showPuzzle();
};

$('next').onclick = () => {
  next();
  showPuzzle();
};

$('retry').onclick = load;

$('hint').onclick = () => getHint();

$('solution').onclick = () => {
  if (!train.puzzle || train.busy || train.finished || train.mode === 'test') return;
  if (train.viewStep >= 0) {
    feedback('Chọn “Trở lại thế hiện tại” trước khi xem lời giải.');
    return;
  }
  markAssisted();
  if (train.puzzle.kind === 'quiz') {
    $('explanation-wrap').hidden = false;
    feedback(`Đáp án: ${train.puzzle.choices[train.puzzle.answer]}. ${train.puzzle.explanation}`);
    draw();
  } else {
    train.autoPlay = true;
    getHint(true);
  }
};

$('puzzle-pass').onclick = () => play(-1);

$('inspect').onchange = () => {
  if ($('inspect').checked) markAssisted();
  else train.selected = -1;
  draw();
};

setupBackup({
  exportButton: $('backup-export'),
  importInput: $('backup-import'),
  status: $('backup-status'),
  getStudy: () => train.study,
  getBankIds: () => train.bank.map((p) => p.id),
  onImport: (result) => {
    train.study = result.study;
    train.storageWritable = train.storageAvailable = true;
    save();
    rebuild();
    journal();
  },
});

setupJournalForm({
  form: $('game-form'),
  noteInput: $('game-note'),
  urlInput: $('game-url'),
  status: $('journal-status'),
  onAdd: ({ date, url, note }) => {
    train.study.games.push({ date, url, note, stage: train.stage });
    train.study.games = train.study.games.slice(-100);
    save();
    journal();
    return train.storageAvailable;
  },
});

try {
  const response = await fetch('./reading-bank.json');
  if (!response.ok) throw Error('BANK');
  train.bank = buildBank(await response.json());
  const loaded = loadStudy(
    KEY,
    train.bank.map((p) => p.id)
  );
  train.study = loaded.study;
  train.storageAvailable = loaded.available;
  train.storageWritable = loaded.writable;
  const params = new URLSearchParams(location.search);
  if (stages.some((s) => s.id === params.get('stage'))) train.stage = params.get('stage');
  const requested = train.bank.find((p) => p.id === params.get('problem'));
  if (requested) train.stage = requested.stage;
  else if (!params.get('stage')) train.mode = 'today';
  rebuild(requested?.id);
  journal();
  save();
} catch (error) {
  console.error(error);
  $('title').textContent = 'Chưa tải được ngân hàng bài';
  feedback('Kiểm tra kết nối rồi tải lại trang. Tiến độ cũ được giữ nguyên.', 'error');
}
