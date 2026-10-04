  // =====================================================================
  // まなびスタジアム（先生用）：ここから下は スタジアムの build で game.js の中に入る
  // ・タイトル → 1vs1モード（QR 2まい → A・B が ふせてアイテムをえらぶ → 入場 → 対戦 → 勝利）
  // ・対戦の ルール・画面は まなびバトルと 同じ（vsTurn などを そのまま使う）
  // ・まなびバトルの セーブ（manabi_battle_save）には さわらない
  // =====================================================================
  const STD_VERSION = '0.4.0';
  const STDX = window.STD || { on: false, ok: () => false };
  const stdS = () => ({ stadium: true, owned: Object.keys(D.ITEM), fav: [], sel: { tempo: 'fast' }, debug: null, pname: '先生', qs: {}, st: {} });
  window.STD_SE = k => se(k);
  if (!D.CREDITS.some(c => c[0] === 'Three.js')) D.CREDITS.push(['Three.js', 'three.js authors', '3Dのスタジアム', 'MIT License']);
  function stdTitle() {
    BT = null;
    if (STDX.endWin) try { STDX.endWin(); } catch (e) { }
    const el = render(`<div class="std-title">
      <div class="st-logo">${window.STD_IMG && STD_IMG.logo ? `<img src="${STD_IMG.logo}" alt="まなびスタジアム">` : '<b>まなびスタジアム</b>'}</div>
      <div class="st-sub">せんせいの とうぎじょう</div>
      <button class="btn-main st-mode" id="m1">🆚 1vs1モード</button>
      <button class="btn-gray st-cred" id="cr">📜 クレジット</button>
      <div class="st-ver">ver ${STD_VERSION}（まなびバトル ver ${K.VERSION}）　ディレクション・ゲームデザイン・企画 K.nom</div></div>`, 'title');
    $('#m1', el).onclick = () => stdVs();
    $('#cr', el).onclick = () => creditsPage();
  }
  async function stdVs() {
    let V = loadVs();
    if (V) {
      const c = await dialog({ who: '🆚', text: 'とちゅうの対戦があるよ。どうする？', choices: [{ label: '▶ 続きから', val: 1, cls: 'btn-main' }, { label: '新しく はじめる', val: 0, cls: 'btn-gray' }] });
      if (!c) { clearVs(); V = null; }
    }
    VSV = V || { phase: 'scanA', prof: {}, picks: { a: [], b: [] }, last: null };
    saveVs();
    await stdRun();
  }
  function stdCard(f, who, pr, mx) {
    const col = D.SUBJ_COLOR || {};
    const st = SUBJ.map(s => `<div class="sc-st"><span style="color:${col[s] || '#fff'}">${s}</span><i><b style="width:${Math.max(4, Math.round((pr.st[s] || 0) / mx * 100))}%;background:${col[s] || '#fff'}"></b></i><em>${pr.st[s] || 0}</em></div>`).join('');
    const its = [...f.items].map(n => `<div class="sc-it"><div class="sc-fc">？</div><div class="sc-bk">${artItem(n)}<b>${esc(n)}</b></div></div>`).join('') || '<div class="sc-none">アイテムなし</div>';
    return `<div class="sc-who">プレイヤー${who}</div><div class="sc-pn">${esc(f.pname)}</div>
      <div class="sc-ttl">${f.title ? titleBadge(f.title, 'sm') : ''}</div>
      <div class="sc-nm">${esc(f.name)} <span>${f.type}タイプ</span></div>
      <div class="sc-hp">HP <b>${f.maxhp}</b>　ステータス合計 <b>${total(pr.st)}</b></div>
      <div class="sc-sts">${st}</div><div class="sc-its">${its}</div>`;
  }
  function stdIntroData() {
    const { P, B } = BT, V = VSV, mx = Math.max(1, ...SUBJ.map(s => Math.max(V.prof.a.st[s] || 0, V.prof.b.st[s] || 0)));
    const one = (f, w, pr) => ({ art: f.art, emo: f.emo, name: f.name, nameH: esc(f.name), pnameH: esc(f.pname), card: stdCard(f, w, pr, mx) });
    return { A: one(P, 'A', V.prof.a), B: one(B, 'B', V.prof.b), nA: `${esc(P.pname)}さんの ${esc(P.name)}`, nB: `${esc(B.pname)}さんの ${esc(B.name)}` };
  }
  // わざの打ちあい（3D）に わたすもの。hp0＝ターンの はじめの HP
  function stdFightData(hp0, turn) {
    const { P, B } = BT;
    const one = (f, h) => ({ art: f.art, emo: f.emo, nameH: esc(f.name), pnameH: esc(f.pname), maxhp: f.maxhp, hp: h });
    return { A: one(P, hp0.P), B: one(B, hp0.B), turn };
  }
  async function stdRun() {
    for (;;) {
      const V = VSV;
      if (V.phase === 'scanA' || V.phase === 'scanB') {
        const w = V.phase === 'scanA' ? 'a' : 'b';
        render('<div class="scr center"><div style="font-size:120px">🆚</div></div>', 'res');
        const pr = await scanQR(`🆚 プレイヤー${AB[w]}の QRコードを 読みこんでね`, 'まなびバトルの「QR」ボタンで 出したQRコードを、カメラに見せてね');
        if (!pr) { clearVs(); return stdTitle(); }
        V.prof[w] = pr; V.phase = w === 'a' ? 'scanB' : 'confirm'; saveVs(); continue;
      }
      if (V.phase === 'confirm') {
        const { a, b } = V.prof;
        const line = (k, p) => `プレイヤー${k}：${esc(p.pname)}（${esc(p.cname)}）ステータス合計 ${total(p.st)}`;
        const c = await dialog({ who: '🆚', text: `${line('A', a)}\n${line('B', b)}${a.pname === b.pname && a.cname === b.cname ? '\n<span class="red">⚠️ 同じQRを 2回 読みこんだかも？</span>' : ''}`, choices: [{ label: 'はじめる！', val: 1, cls: 'btn-main' }, { label: 'QRを読みなおす', val: 0, cls: 'btn-gray' }] });
        V.phase = c ? 'pickA' : 'scanA'; if (!c) V.prof = {}; saveVs(); continue;
      }
      if (V.phase === 'pickA' || V.phase === 'pickB') {
        const w = V.phase === 'pickA' ? 'a' : 'b', o = w === 'a' ? 'B' : 'A', pr = V.prof[w];
        await tapScreen(`プレイヤー${AB[w]}（${esc(pr.pname)}）だけ<br>画面を見てください`, `プレイヤー${o}は 後ろを向いてね。画面をタップしてね`);
        const preset = V.picks[w].length ? V.picks[w] : V.last ? V.last[w] : [];
        V.picks[w] = await pickItems(pr, preset.filter(n => pr.owned.includes(n)));
        V.phase = w === 'a' ? 'pickB' : 'intro'; saveVs(); continue;
      }
      if (V.phase === 'intro') {
        await tapScreen('みんなで 画面を見てね！', 'プレイヤーAも Bも 前を向いてね。画面をタップしてね');
        V.bt = { vs: true, bgVs: pick(Object.keys(D.BOSSES)), cfg: { P: vsCfg(V.prof.a, V.picks.a), B: vsCfg(V.prof.b, V.picks.b) }, snap: null, turn: 1, firstId: null, acts: {}, used: [], phase: 'turn', result: null };
        BT = hydrate(V.bt); BT.snap = dynAll(); V.phase = 'battle'; saveVs();
        if (STDX.ok()) {
          render('<div></div>', 'btl').style.background = 'transparent';
          await STDX.intro(stdIntroData());
          battleScreen(); $('#turn').textContent = '🆚 対戦';
        } else {
          battleScreen(); $('#turn').textContent = '🆚 対戦';
          await vsIntro(['プレイヤーA', ''], ['プレイヤーB', '']);
        }
        continue;
      }
      if (V.phase === 'battle') {
        if (!BT) BT = hydrate(V.bt);
        battleScreen();
        while (BT.phase === 'turn') await vsTurn();
        V.result = BT.result; V.pass = BT.pass || null; V.phase = 'end'; saveVs(); continue;
      }
      if (V.phase === 'end') {
        if (!BT) BT = hydrate(V.bt);
        const { P, B } = BT, res = V.result, wf = res === 'P' ? P : B;
        const head = res === 'draw' ? '🤝 引き分け！' : `🏆 プレイヤー${res === 'P' ? 'A' : 'B'}　${esc(wf.pname)}さんの 勝ち！`;
        const el = render(`<div class="std-win">
          <div class="sw-head">${STDX.gt ? STDX.gt(head.replace(/^🏆 |^🤝 /, ''), 'gd') : head}</div>
          ${res === 'draw' ? '' : `<div class="sw-nm">${esc(wf.name)}${V.pass ? '　<span class="sm">（🏳️ あいての こうさん）</span>' : ''}</div>`}
          <div class="sw-hp">${esc(P.name)} HP ${Math.max(0, R0(P.hp))}／${P.maxhp}　　${esc(B.name)} HP ${Math.max(0, R0(B.hp))}／${B.maxhp}</div>
          <div class="sw-btns">
            <button class="btn-main" id="w1">🔁 同じアイテムで 再戦</button>
            <button class="btn-blue" id="w2">🎒 アイテムを えらびなおして 再戦</button>
            <button class="btn-gray" id="w3">🏠 タイトルに もどる</button></div></div>`, 'btl');
        bgm('vsResult');
        el.style.background = 'transparent';
        if (STDX.ok()) await STDX.win(res, stdIntroData());
        el.querySelector('.std-win').classList.add('on');
        const c = await new Promise(r => ['w1', 'w2', 'w3'].forEach(id => ($('#' + id, el).onclick = () => r(id))));
        if (STDX.endWin) STDX.endWin();
        if (c === 'w3') { clearVs(); return stdTitle(); }
        if (c === 'w2') { V.last = { a: V.picks.a, b: V.picks.b }; V.picks = { a: [], b: [] }; V.phase = 'pickA'; }
        else V.phase = 'intro';
        V.bt = null; V.result = null; V.pass = null; BT = null; saveVs(); continue;
      }
      clearVs(); return stdTitle();
    }
  }
