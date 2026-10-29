// 自動で書き出されたファイルです（Code.gs から）
function buildRatingChart_(games) {
  if (games.length < 2) return '';

  const W = 700, H = 240;
  const padL = 46, padR = 12, padT = 14, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  // 出発点（最初の対局前）から、各対局後のレーティングを並べる
  const pts = [games[0].rating - games[0].delta];
  games.forEach(g => pts.push(g.rating));

  let lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts);
  if (hi === lo) { hi += 10; lo -= 10; }
  const span = hi - lo;
  const pad = Math.max(Math.round(span * 0.12), 5);
  lo = Math.floor((lo - pad) / 10) * 10;
  hi = Math.ceil((hi + pad) / 10) * 10;

  const x = i => padL + (pts.length === 1 ? 0 : (innerW * i) / (pts.length - 1));
  const y = v => padT + innerH - (innerH * (v - lo)) / (hi - lo);

  // 目盛り（4本）
  let grid = '';
  for (let i = 0; i <= 4; i++) {
    const v = Math.round(lo + ((hi - lo) * i) / 4);
    const gy = y(v);
    grid += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy
      + '" stroke="#e6e2d6" stroke-width="1"/>'
      + '<text x="' + (padL - 6) + '" y="' + (gy + 4) + '" text-anchor="end" '
      + 'font-size="11" fill="#8a8a8a">' + v + '</text>';
  }

  let line = '', area = '';
  pts.forEach((v, i) => {
    const px = x(i).toFixed(1), py = y(v).toFixed(1);
    line += (i === 0 ? 'M' : 'L') + px + ' ' + py;
    area += (i === 0 ? 'M' + px + ' ' + y(lo).toFixed(1) + 'L' + px + ' ' + py : 'L' + px + ' ' + py);
  });
  area += 'L' + x(pts.length - 1).toFixed(1) + ' ' + y(lo).toFixed(1) + 'Z';

  // 最高値の位置に印をつける
  let peakIdx = 0;
  pts.forEach((v, i) => { if (v > pts[peakIdx]) peakIdx = i; });
  const peak = '<circle cx="' + x(peakIdx).toFixed(1) + '" cy="' + y(pts[peakIdx]).toFixed(1)
    + '" r="3.5" fill="#0f5132"/>'
    + '<text x="' + x(peakIdx).toFixed(1) + '" y="' + (y(pts[peakIdx]) - 8).toFixed(1)
    + '" text-anchor="middle" font-size="11" fill="#0f5132">' + pts[peakIdx] + '</text>';

  // 両端の日付
  const firstDate = games[0].date || '';
  const lastDate = games[games.length - 1].date || '';
  const labels = '<text x="' + padL + '" y="' + (H - 8) + '" font-size="11" fill="#8a8a8a">'
    + firstDate + '</text>'
    + '<text x="' + (W - padR) + '" y="' + (H - 8) + '" text-anchor="end" font-size="11" fill="#8a8a8a">'
    + lastDate + '</text>';

  const last = pts[pts.length - 1];
  const endDot = '<circle cx="' + x(pts.length - 1).toFixed(1) + '" cy="' + y(last).toFixed(1)
    + '" r="3.5" fill="#a3372c"/>';

  return '<div class="card" style="margin-bottom:14px;">'
    + '<svg viewBox="0 0 ' + W + ' ' + H + '" '
    + 'style="width:100%;height:auto;display:block;">'
    + grid
    + '<path d="' + area + '" fill="#0f5132" fill-opacity="0.08"/>'
    + '<path d="' + line + '" fill="none" stroke="#0f5132" stroke-width="2" '
    + 'stroke-linejoin="round" stroke-linecap="round"/>'
    + peak + endDot + labels
    + '</svg>'
    + '<div style="font-size:11px;color:#8a8a8a;margin-top:4px;">'
    + games.length + '局分の推移（緑の点＝最高、赤の点＝現在）</div>'
    + '</div>';
}

function renderPlayerPage_(ctx) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const base = ctx.base;
  const playerUrl = (n, y) => base + '?player=' + encodeURIComponent(n) + (y ? '&year=' + encodeURIComponent(y) : '');
  const archiveUrl = s => base + '?sheet=' + encodeURIComponent(s);

  const playerName = ctx.name;
  const allGames = ctx.games || [];
  const p = ctx.profile || {};
  let html = ctx.css + '<div class="wrap">' + ctx.nav;

  if (!String(playerName || '').trim()) return html + '<div class="card">選手名が指定されていません。</div></div>';
  if (allGames.length === 0) {
    return html + '<h1>' + esc(playerName) + '</h1><div class="card">'
      + 'この選手の対局が見つかりませんでした。</div></div>';
  }

  // 対局が存在する年の一覧（新しい年が先）
  const yearSet = {};
  allGames.forEach(g => { const y = String(g.date || '').slice(0, 4); if (y) yearSet[y] = true; });
  const years = Object.keys(yearSet).sort().reverse();

  const yearParam = ctx.year;
  const year = (yearParam && (yearParam === 'all' || yearSet[yearParam])) ? yearParam : (years[0] || 'all');
  const games = (year === 'all') ? allGames : allGames.filter(g => String(g.date || '').slice(0, 4) === year);

  if (games.length === 0) {
    return html + '<h1>' + esc(playerName) + '</h1><div class="card">' + year + '年の対局はありません。</div></div>';
  }

  // 成績の集計（選択中の年の分）
  let win = 0, lose = 0, draw = 0;
  let max = -Infinity, sum = 0;
  games.forEach(g => {
    if (g.symbol === '○') win++;
    else if (g.symbol === '×') lose++;
    else draw++;
    if (g.rating > max) max = g.rating;
    sum += g.rating;
  });
  const first = games[0].rating - games[0].delta;
  const last = games[games.length - 1].rating;
  const avg = Math.round(sum / games.length);
  const rate = ((win + draw * 0.5) / games.length).toFixed(3);

  // 現在の連勝・連敗（選択中の年の中で）
  let streak = 0, streakType = '';
  for (let i = games.length - 1; i >= 0; i--) {
    if (i === games.length - 1) { streakType = games[i].symbol; streak = 1; continue; }
    if (games[i].symbol === streakType) streak++;
    else break;
  }
  let best = 0, run = 0;
  games.forEach(g => { if (g.symbol === '○') { run++; if (run > best) best = run; } else run = 0; });

  // 現在のレーティングは常に全期間の最新値を出す（年で絞っても表示は変わらない）
  const currentRating = allGames[allGames.length - 1].rating;

  html += '<h1>' + esc(p.name || playerName) + '</h1>'
    + '<div class="card" style="margin-bottom:14px;">'
    + '<div style="display:flex;flex-wrap:wrap;gap:20px;font-size:13px;">'
    + '<div><b style="font-size:22px;color:#0f5132;">' + esc(currentRating) + '</b>'
    + (p.dan ? ' <span style="color:#5b6f63;">' + esc(p.dan) + '</span>' : '')
    + (p.block ? ' <span style="color:#5b6f63;">' + esc(p.block) + '</span>' : '') + '</div>'
    + '</div><hr style="border:none;border-top:1px solid #eee;margin:10px 0;">'
    + '<div style="font-size:12.5px;color:#5b6f63;margin-bottom:6px;">' + (year === 'all' ? '全期間' : year + '年') + '成績</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px 24px;font-size:13px;">'
    + '<div>' + win + '勝' + lose + '敗' + draw + '分（' + games.length + '試合）</div>'
    + '<div>勝率：' + rate + '</div>'
    + '<div>変動：' + first + ' → ' + last + '</div>'
    + '<div>最高：' + max + '</div>'
    + '<div>平均：' + avg + '</div>'
    + '<div>' + (streakType === '○' ? streak + '連勝中' : streakType === '×' ? streak + '連敗中' : '直近は引き分け')
    + '（最高：' + best + '連勝）</div>'
    + '</div></div>';

  // 年の切り替え
  if (years.length > 1) {
    const yLink = (y, label) => {
      const on = (y === year);
      return '<a href="' + playerUrl(playerName, y) + '" target="_top" style="'
        + 'display:inline-block;margin:0 6px 6px 0;padding:3px 10px;border-radius:4px;text-decoration:none;font-size:13px;'
        + (on ? 'background:#0f5132;color:#fff;' : 'background:#fff;color:#0f5132;border:1px solid #cfe0d5;')
        + '">' + label + '</a>';
    };
    html += '<div style="margin:0 0 14px;">' + yLink('all', '全年');
    years.forEach(y => { html += yLink(y, y); });
    html += '</div>';
  }

  // レーティング推移のグラフ（選択中の年の分）
  html += buildRatingChart_(games);

  html += '<div class="card"><table><thead><tr>'
    + '<th>対戦日</th><th>大会名</th><th>対戦相手</th><th>結果</th><th>レート</th>'
    + '</tr></thead><tbody>';

  // 新しい対局が上
  games.slice().reverse().forEach(g => {
    const cls = g.symbol === '○' ? 'w' : g.symbol === '×' ? 'l' : 'd';
    const bg = g.symbol === '○' ? '#fdf6e3' : g.symbol === '×' ? '#e8f0fb' : '#f5f1e0';
    const tournamentCell = g.legacy
      ? '<span class="sub">' + esc(g.sheetName) + '</span>'
      : '<a class="pl" href="' + archiveUrl(g.sheetName) + '" target="_blank">'
        + esc(String(g.sheetName).replace(/_\d{8}_\d{4}(_\d+)?$/, '')) + '</a>';
    html += '<tr style="background:' + bg + ';">'
      + '<td>' + esc(g.date || '—') + '</td>'
      + '<td class="name">' + tournamentCell + '</td>'
      + '<td class="name"><a class="op" href="' + playerUrl(g.oppName) + '" target="_blank">'
      + esc(g.oppName) + '</a><br><span class="sub">' + esc(g.oppRating) + '</span></td>'
      + '<td class="' + cls + '">' + g.symbol + '</td>'
      + '<td>' + g.rating + '<br><span class="' + cls + '" style="font-size:11px;">'
      + (g.delta > 0 ? '+' : '') + g.delta + '</span></td>'
      + '</tr>';
  });

  html += '</tbody></table></div></div>';
  return html;
}
