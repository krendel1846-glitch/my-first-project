

(function(){
  if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
  }
  if (!Element.prototype.closest) {
    Element.prototype.closest = function(selector) {
      var el = this;
      while (el && el.nodeType === 1) {
        if (el.matches(selector)) return el;
        el = el.parentElement || el.parentNode;
      }
      return null;
    };
  }
})();

const app = {
  state: {
    flavors: [],
    favorites: [],
    jsonMode: false,
    generationHistory: {}
  },

  getBundledBase() {
    const node = document.getElementById('bundled-base-data');
    if (!node) return [];
    try {
      const parsed = JSON.parse(node.textContent || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('bundled base parse failed:', error);
      return [];
    }
  },

  loadBundledBase() {
    const bundled = this.getBundledBase();
    if (!bundled.length) return 0;
    const existingByKey = new Map(this.state.flavors.map(item => [this.normalizeText(item.brand) + '||' + this.normalizeText(item.name), item]));
    let added = 0;
    bundled.forEach(source => {
      const key = this.normalizeText(source.brand) + '||' + this.normalizeText(source.name);
      const existing = existingByKey.get(key);
      const clean = {
        id: existing && existing.id ? existing.id : source.id,
        brand: source.brand || '',
        name: source.name || '',
        description: source.description || '',
        strength: source.strength || '',
        type: source.type || '',
        weight: source.weight || ''
      };
      clean.analysis = this.analyzeFlavor(clean);
      if (existing) {
        existing.brand = clean.brand;
        existing.name = clean.name;
        existing.description = clean.description;
        existing.strength = clean.strength;
        existing.type = clean.type;
        existing.weight = clean.weight;
        existing.analysis = clean.analysis;
      } else {
        this.state.flavors.push(clean);
        existingByKey.set(key, clean);
        added += 1;
      }
    });
    return added;
  },

  traitKeywords: {
    sweetness: ['слад','honey','мед','карамел','vanilla','ваниль','cream','слив','milk','молок','dessert','cookie','cake','шоколад','choco','крем','candy'],
    acidity: ['кисл','sour','acid','лимон','lemon','lime','лайм','grapefruit','грейп','kiwi','киви','passion','маракуй'],
    freshness: ['fresh','свеж','mint','мята','ice','cold','лед','frost','cool','freeze','menthol'],
    cooling: ['mint','мята','ice','лед','frost','cold','cool','menthol','supernova','iceberg','freeze'],
    creaminess: ['cream','слив','молок','milk','yogurt','йогурт','ice cream','морож','cookie','печень','vanilla','ваниль','custard','cheesecake','dessert'],
    dryness: ['tea','чай','earl','бергамот','wood','woods','woody','древ','tobacco','табак','coffee','кофе','spice','прян','chai'],
    brightness: ['citrus','лимон','lime','лайм','orange','апельс','berry','ягод','kiwi','киви','passion','маракуй','fresh','mint','minty'],
    depth: ['dark','black','cola','кола','coffee','кофе','wine','вин','grape','виноград','nut','орех','woody','табак','spice','прян'],
    floral: ['rose','роза','jasmine','жасмин','lavender','лаванда','floral','цвет'],
    spicy: ['spice','прян','cinnamon','кориц','ginger','имбир','chai','cardamom','кардамон','clove','гвоздик'],
    citrus: ['lemon','лимон','lime','лайм','orange','апельс','grapefruit','грейп','bergamot','бергамот','mandarin','мандарин'],
    berry: ['berry','ягод','strawberry','клубник','raspberry','малин','blueberry','черник','blackberry','ежев','cherry','вишн','cranberry','клюкв'],
    tropical: ['mango','манго','pineapple','ананас','banana','банан','coconut','кокос','guava','гуава','passion','маракуй','papaya','папай'],
    green: ['apple','яблок','pear','груш','green','трав','herb','herbal','mint'],
    juicy: ['watermelon','арбуз','melon','дын','peach','персик','juicy','сочн','grape','виноград','mango','манго','pear','груш'],
    candy: ['candy','леден','bubblegum','жвач','sweet','конфет'],
    tea: ['tea','чай','earl','бергамот','matcha','матча'],
    woody: ['wood','woody','древ','tobacco','табак','cigar','oak','дуб']
  },

  categoryKeywords: {
    fruit: ['apple','яблок','pear','груш','melon','дын','арбуз','watermelon','peach','персик','apricot','абрик','grape','виноград','слив','plum'],
    berry: ['berry','ягод','strawberry','клубник','raspberry','малин','blueberry','черник','cherry','вишн','cranberry','клюкв'],
    citrus: ['lemon','лимон','lime','лайм','orange','апельс','grapefruit','грейп','bergamot','бергамот','mandarin','мандарин'],
    tropical: ['mango','манго','pineapple','ананас','passion','маракуй','banana','банан','coconut','кокос','guava','гуава','papaya','папай'],
    dessert: ['dessert','десерт','cake','торт','cookie','печень','pie','пирог','donut','пончик','cheesecake','tiramisu','карамел','шоколад'],
    creamy: ['cream','слив','milk','молок','yogurt','йогурт','vanilla','ваниль','custard','крем'],
    floral: ['rose','роза','jasmine','жасмин','lavender','лаванда','floral','цвет'],
    spicy: ['spice','прян','cinnamon','кориц','ginger','имбир','cardamom','кардамон'],
    tea: ['tea','чай','earl','бергамот','matcha','матча'],
    cooling: ['mint','мята','ice','лед','menthol','cool','freeze','supernova'],
    beverage: ['cola','кола','coffee','кофе','latte','раф','tea','чай','wine','вин','mojito','лимонад'],
    woody: ['wood','woody','древ','tobacco','табак','cigar','oak','орех']
  },

  styleTargets: {
    universal: {freshness: 4, cooling: 1, sweetness: 5, acidity: 4, creaminess: 2, depth: 4, brightness: 5},
    fresh: {freshness: 7, cooling: 5, sweetness: 4, acidity: 5, creaminess: 1, depth: 2, brightness: 6},
    fruity: {freshness: 5, cooling: 1, sweetness: 5, acidity: 4, creaminess: 1, depth: 3, brightness: 5},
    berry: {freshness: 4, cooling: 1, sweetness: 5, acidity: 4, creaminess: 1, depth: 4, brightness: 6},
    citrus: {freshness: 5, cooling: 1, sweetness: 3, acidity: 7, creaminess: 1, depth: 2, brightness: 7},
    dessert: {freshness: 1, cooling: 0, sweetness: 7, acidity: 2, creaminess: 6, depth: 5, brightness: 2},
    tea: {freshness: 3, cooling: 0, sweetness: 3, acidity: 3, creaminess: 2, depth: 6, brightness: 4},
    spicy: {freshness: 1, cooling: 0, sweetness: 4, acidity: 2, creaminess: 3, depth: 7, brightness: 2},
    balanced: {freshness: 4, cooling: 1, sweetness: 5, acidity: 4, creaminess: 3, depth: 4, brightness: 4},
    authorial: {freshness: 3, cooling: 2, sweetness: 4, acidity: 4, creaminess: 3, depth: 6, brightness: 5}
  },

  roleLabels: {
    body: 'Тело / база',
    support: 'Поддержка',
    accent: 'Акцент',
    rounder: 'Округлитель',
    cooler: 'Охладитель'
  },

  ratioFamilies: {
    2: [
      {name:'60/40 Классика', roles:{body:60, support:40}},
      {name:'70/30 Доминирующая база', roles:{body:70, support:30}},
      {name:'50/50 Дуэт', roles:{body:50, support:50}},
      {name:'55/45 Коммерческий баланс', roles:{body:55, support:45}}
    ],
    3: [
      {name:'60/25/15 Чистая база', roles:{body:60, support:25, accent:15}},
      {name:'55/30/15 Коммерческий', roles:{body:55, support:30, accent:15}},
      {name:'50/30/20 Акцентный', roles:{body:50, support:30, accent:20}},
      {name:'40/40/20 Дуальный', roles:{body:40, support:40, accent:20}},
      {name:'70/20/10 Монопрофиль', roles:{body:70, support:20, accent:10}}
    ],
    4: [
      {name:'40/30/20/10 Слоистый', roles:{body:40, support:30, rounder:20, accent:10}},
      {name:'45/25/15/15 Контрастный', roles:{body:45, support:25, rounder:15, accent:15}},
      {name:'50/20/20/10 Тело + фон', roles:{body:50, support:20, rounder:20, accent:10}},
      {name:'35/35/20/10 Две опоры', roles:{body:35, support:35, rounder:20, accent:10}},
      {name:'45/25/20/10 Свежий контур', roles:{body:45, support:25, accent:20, cooler:10}}
    ],
    5: [
      {name:'35/25/15/15/10 Signature layered', roles:{body:35, support:25, support2:15, rounder:15, accent:10}},
      {name:'40/20/15/15/10 Signature commercial', roles:{body:40, support:20, support2:15, rounder:15, accent:10}},
      {name:'35/20/15/15/15 Contrast signature', roles:{body:35, support:20, rounder:15, accent:15, cooler:15}},
      {name:'45/20/15/10/10 Body first', roles:{body:45, support:20, support2:15, accent:10, cooler:10}},
      {name:'30/25/20/15/10 Multi-layer', roles:{body:30, support:25, support2:20, rounder:15, accent:10}}
    ]
  },

  init() {
    try {
      this.loadData();
      this.loadBundledBase();
      this.saveData();
      this.renderDatabase();
      this.updateStats();
      this.ensureInitialSlots();
      this.bindGlobalEvents();
    } catch (error) {
      console.error('init failed:', error);
      this.bindGlobalEvents();
      const results = document.getElementById('results-area');
      if (results) {
        results.innerHTML = '<div class="card" style="border-color:var(--danger);color:var(--danger)">Ошибка запуска интерфейса: ' + this.escapeHtml(error && error.message ? error.message : String(error)) + '</div>';
      }
    }
  },

  loadData() {
    try {
      const db = localStorage.getItem('mixology_db_v2');
      const fav = localStorage.getItem('mixology_favorites_v2');
      this.state.flavors = db ? JSON.parse(db) : [];
      this.state.favorites = fav ? JSON.parse(fav) : [];
      if (!Array.isArray(this.state.flavors)) this.state.flavors = [];
      if (!Array.isArray(this.state.favorites)) this.state.favorites = [];
    } catch (error) {
      console.warn('loadData fallback:', error);
      this.state.flavors = [];
      this.state.favorites = [];
    }
  },

  saveData() {
    try {
      localStorage.setItem('mixology_db_v2', JSON.stringify(this.state.flavors));
      localStorage.setItem('mixology_favorites_v2', JSON.stringify(this.state.favorites));
    } catch (error) {
      console.warn('saveData skipped:', error);
    }
    this.updateStats();
  },

  ensureInitialSlots() {
    const slots = document.getElementById('flavor-slots');
    if (!slots.children.length) {
      this.addFlavorSlot();
      this.addFlavorSlot();
      this.addFlavorSlot();
    }
    this.updateSlotsInfo();
  },

  slugify(s) {
    return String(s || '').toLowerCase().replace(/[^\wа-яё]+/gi, '_').replace(/^_+|_+$/g,'');
  },

  normalizeText(s) {
    return String(s || '').toLowerCase().trim();
  },

  inferCategory(flavor) {
    const text = this.normalizeText([flavor.brand, flavor.name, flavor.description, flavor.type].join(' '));
    for (const [cat, keys] of Object.entries(this.categoryKeywords)) {
      if (keys.some(k => text.includes(k))) return cat;
    }
    return 'fruit';
  },

  inferStrengthValue(strength) {
    const s = this.normalizeText(strength);
    if (s.includes('выс') || s.includes('strong')) return 7;
    if (s.includes('лег') || s.includes('light')) return 3;
    return 5;
  },

  analyzeFlavor(flavor) {
    const text = this.normalizeText([flavor.brand, flavor.name, flavor.description, flavor.type].join(' '));
    const traits = {
      sweetness: 2, acidity: 1, freshness: 1, cooling: 0, creaminess: 0, dryness: 0,
      brightness: 2, depth: 1, floral: 0, spicy: 0, citrus: 0, berry: 0, tropical: 0,
      green: 0, juicy: 1, candy: 0, tea: 0, woody: 0
    };
    for (const [trait, words] of Object.entries(this.traitKeywords)) {
      words.forEach(word => {
        if (text.includes(word)) traits[trait] += 2;
      });
    }
    Object.keys(traits).forEach(k => traits[k] = Math.max(0, Math.min(10, traits[k])));

    const category = this.inferCategory(flavor);
    const strengthValue = this.inferStrengthValue(flavor.strength);
    const sweetness = traits.sweetness;
    const acidity = traits.acidity;
    const tartness = Math.max(0, Math.min(10, Math.round(acidity * 0.8 + traits.citrus * 0.4)));
    const density = Math.max(0, Math.min(10, Math.round((traits.depth * 0.45) + (traits.creaminess * 0.25) + (sweetness * 0.20) + (traits.dryness * 0.10))));
    const dessertness = Math.max(0, Math.min(10, Math.round((traits.creaminess * 0.45) + (sweetness * 0.35) + (traits.candy * 0.20))));
    const naturalness = Math.max(0, Math.min(10, Math.round(7 - traits.candy * 0.45 - traits.floral * 0.12 + traits.green * 0.12 + traits.berry * 0.08)));
    const heaviness = Math.max(0, Math.min(10, Math.round((density * 0.45) + (dessertness * 0.30) + (traits.depth * 0.15) - (traits.freshness * 0.10))));

    const loudness = Math.max(1, Math.min(10, Math.round(
      0.24 * strengthValue +
      0.18 * traits.brightness +
      0.16 * traits.cooling +
      0.12 * traits.floral +
      0.12 * traits.spicy +
      0.10 * traits.candy +
      0.08 * traits.citrus
    )));

    const suppressionRisk = Math.max(1, Math.min(10, Math.round(
      0.25 * loudness +
      0.22 * traits.cooling +
      0.16 * traits.floral +
      0.12 * traits.spicy +
      0.10 * traits.citrus +
      0.08 * heaviness +
      0.07 * traits.candy
    )));

    const bodySuit = Math.max(0, Math.min(10, Math.round(
      0.24 * sweetness +
      0.18 * traits.juicy +
      0.16 * density +
      0.12 * traits.depth +
      0.10 * (10 - traits.cooling) +
      0.10 * (10 - traits.floral) +
      0.10 * (10 - traits.spicy)
    )));

    const supportSuit = Math.max(0, Math.min(10, Math.round(
      0.20 * traits.brightness +
      0.18 * traits.juicy +
      0.14 * traits.green +
      0.12 * acidity +
      0.12 * traits.depth +
      0.12 * sweetness +
      0.12 * (10 - traits.cooling)
    )));

    const accentSuit = Math.max(0, Math.min(10, Math.round(
      0.22 * traits.citrus +
      0.16 * traits.floral +
      0.16 * traits.spicy +
      0.14 * acidity +
      0.14 * traits.brightness +
      0.10 * loudness +
      0.08 * traits.berry
    )));

    const rounderSuit = Math.max(0, Math.min(10, Math.round(
      0.34 * traits.creaminess +
      0.20 * sweetness +
      0.12 * density +
      0.10 * traits.tropical +
      0.12 * (10 - acidity) +
      0.12 * (10 - traits.cooling)
    )));

    const coolerSuit = Math.max(0, Math.min(10, Math.round(
      0.68 * traits.cooling +
      0.18 * traits.freshness +
      0.14 * traits.brightness
    )));

    const versatility = Math.max(0, Math.min(10, Math.round((bodySuit + supportSuit + accentSuit + rounderSuit) / 4 - suppressionRisk * 0.15)));
    const conflictRisk = Math.max(0, Math.min(10, Math.round((traits.floral * 0.25) + (traits.spicy * 0.18) + (traits.cooling * 0.18) + (traits.candy * 0.16) + (traits.citrus * 0.10) + (heaviness * 0.13))));
    const heatResistance = Math.max(0, Math.min(10, Math.round(strengthValue * 0.45 + density * 0.30 + traits.depth * 0.25)));
    const revealSpeed = Math.max(0, Math.min(10, Math.round(traits.brightness * 0.45 + traits.cooling * 0.20 + acidity * 0.20 + (10 - density) * 0.15)));
    const persistence = Math.max(0, Math.min(10, Math.round(density * 0.35 + sweetness * 0.20 + traits.depth * 0.20 + heatResistance * 0.25)));
    const fadeRisk = Math.max(0, Math.min(10, Math.round((10 - loudness) * 0.35 + (10 - persistence) * 0.35 + acidity * 0.15 + traits.brightness * 0.15)));
    const dominance = Math.max(0, Math.min(10, Math.round((loudness * 0.45) + (suppressionRisk * 0.35) + (bodySuit * 0.20))));
    const backgroundability = Math.max(0, Math.min(10, Math.round((supportSuit * 0.45) + (rounderSuit * 0.25) + (10 - dominance) * 0.20 + (10 - conflictRisk) * 0.10)));

    return {
      category,
      traits,
      strengthValue,
      loudness,
      suppressionRisk,
      tartness,
      density,
      dessertness,
      naturalness,
      heaviness,
      versatility,
      conflictRisk,
      heatResistance,
      revealSpeed,
      persistence,
      fadeRisk,
      dominance,
      backgroundability,
      roleSuit: {
        body: bodySuit,
        support: supportSuit,
        accent: accentSuit,
        rounder: rounderSuit,
        cooler: coolerSuit
      }
    };
  },

  hydrateFlavor(flavor) {
    if (!flavor.analysis) flavor.analysis = this.analyzeFlavor(flavor);
    return flavor;
  },

  importRowToFlavor(cols) {
    const flavor = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      brand: cols[0] || 'Unknown',
      name: cols[1] || 'No Name',
      description: cols[2] || '',
      strength: cols[3] || 'Средняя',
      type: cols[4] || '',
      weight: cols[5] || ''
    };
    flavor.analysis = this.analyzeFlavor(flavor);
    return flavor;
  },

  processImport() {
    const raw = document.getElementById('import-text').value.trim();
    if (!raw) return alert('Вставь таблицу или CSV/TSV');
    const added = this.importRowsFromText(raw);
    document.getElementById('import-text').value = '';
    alert(`Добавлено вкусов: ${added}`);
    this.switchTab('database', document.querySelector('[data-tab="database"]'));
  },

  importRowsFromText(raw) {
    const lines = this.parseDelimitedText(raw);
    let added = 0;
    lines.forEach(cols => {
      if (cols.length >= 2) {
        const flavor = this.importRowToFlavor(cols);
        const exists = this.state.flavors.some(f =>
          this.normalizeText(f.brand) === this.normalizeText(flavor.brand) &&
          this.normalizeText(f.name) === this.normalizeText(flavor.name)
        );
        if (!exists) {
          this.state.flavors.push(flavor);
          added++;
        }
      }
    });
    this.saveData();
    this.renderDatabase();
    this.refreshAllFlavorSelects();
    return added;
  },

  parseDelimitedText(raw) {
    return raw.split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
        return line.split(sep).map(x => String(x).trim());
      })
      .filter(cols => cols.length >= 2)
      .filter(cols => !(this.normalizeText(cols[0]) === 'бренд' && this.normalizeText(cols[1]).includes('вкус')));
  },

  async importFile() {
    const input = document.getElementById('import-file');
    const file = input && input.files && input.files[0];
    if (!file) return alert('Сначала выбери файл Excel или CSV');

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    try {
      let rows = [];
      if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
        const text = await file.text();
        rows = this.parseDelimitedText(text);
      } else if (ext === 'xlsx' || ext === 'xls') {
        if (typeof XLSX === 'undefined') {
          await this.ensureExternalLib('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', 'XLSX');
        }
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })
          .map(row => row.map(cell => String(cell === null || cell === undefined ? '' : cell).trim()))
          .filter(row => row.length >= 2 && row.some(Boolean))
          .filter(row => !(this.normalizeText(row[0]) === 'бренд' && this.normalizeText(row[1]).includes('вкус')));
      } else {
        alert('Неподдерживаемый формат файла. Используй .xlsx, .xls, .csv, .tsv или .txt');
        return;
      }

      if (!rows.length) return alert('В файле не найдено подходящих строк для импорта.');

      let added = 0;
      rows.forEach(cols => {
        if (cols.length >= 2) {
          const flavor = this.importRowToFlavor(cols);
          const exists = this.state.flavors.some(f =>
            this.normalizeText(f.brand) === this.normalizeText(flavor.brand) &&
            this.normalizeText(f.name) === this.normalizeText(flavor.name)
          );
          if (!exists) {
            this.state.flavors.push(flavor);
            added++;
          }
        }
      });

      this.saveData();
      this.renderDatabase();
      this.refreshAllFlavorSelects();
      input.value = '';
      alert(`Импорт завершен. Добавлено вкусов: ${added}`);
      this.switchTab('database', document.querySelector('[data-tab="database"]'));
    } catch (error) {
      console.error('Import failed:', error);
      alert('Ошибка импорта: ' + (error && error.message ? error.message : String(error)));
    }
  },

  loadDemoData() {
    const demo = [
      ['Darkside','Supernova','Ледяной кулер','Средняя','Охлаждение','30'],
      ['Darkside','Bounty Hunter','Шоколад кокос сливки','Средняя','Десертный','30'],
      ['Darkside','Green Mist','Зеленое яблоко мята','Средняя','Фруктовый','30'],
      ['MustHave','Pinkman','Клубника киви цитрус','Средняя','Ягодный','25'],
      ['MustHave','Grape Core','Сочный белый виноград','Средняя','Фруктовый','25'],
      ['MustHave','Mango Sling','Манго с мягкой сладостью','Средняя','Тропический','25'],
      ['Tangiers','Cane Mint','Сильная мята','Высокая','Охлаждение','25'],
      ['Tangiers','Lemon-Lime','Яркий лимон и лайм','Высокая','Цитрусовый','25'],
      ['Tangiers','Kashmir Peach','Персик с пряностью','Высокая','Пряный','25'],
      ['Bonche','Blueberry Yogurt','Черника йогурт','Средняя','Десертный','30'],
      ['Bonche','Pear Candy','Груша конфетная мягкая','Легкая','Фруктовый','30'],
      ['Black Burn','Kiwi Ice','Киви лед','Средняя','Свежий','30'],
      ['Black Burn','Cherry Cola','Вишня кола','Средняя','Напитки','30'],
      ['Black Burn','Mango Yogurt','Манго йогурт','Средняя','Десертный','30'],
      ['Satyr','Green Apple','Зеленое яблоко','Средняя','Фруктовый','30'],
      ['Satyr','Tea Bergamot','Черный чай бергамот','Средняя','Чайный','30'],
      ['Satyr','Jasmine','Жасмин','Средняя','Цветочный','30'],
      ['Duft','Pear','Сочная груша','Легкая','Фруктовый','25'],
      ['Duft','Rose','Нежная роза','Средняя','Цветочный','25'],
      ['Duft','Lemon Candy','Лимонная конфета','Легкая','Цитрусовый','25'],
      ['Adalya','Love 66','Арбуз дыня маракуйя мята','Легкая','Тропический','50'],
      ['Afzal','Kashmiri Malai','Чай специи сливки','Высокая','Чайный','50'],
      ['Element','Berry Breeze','Ягоды с легким холодом','Средняя','Ягодный','25'],
      ['Element','Vanilla Sky','Ванильные сливки','Средняя','Сливочный','25'],
      ['Trofimoffs','Citrus Tonic','Цитрусовый тоник','Средняя','Напитки','25'],
      ['Trofimoffs','Coffee Cream','Кофе сливки','Средняя','Десертный','25'],
      ['Sebero','Pineapple Rings','Ананасовые кольца','Легкая','Тропический','25'],
      ['Sebero','Cranberry','Клюква','Легкая','Ягодный','25']
    ];
    let added = 0;
    demo.forEach(row => {
      const flavor = this.importRowToFlavor(row);
      const exists = this.state.flavors.some(f => this.normalizeText(f.brand) === this.normalizeText(flavor.brand) && this.normalizeText(f.name) === this.normalizeText(flavor.name));
      if (!exists) {
        this.state.flavors.push(flavor);
        added++;
      }
    });
    this.saveData();
    this.renderDatabase();
    this.refreshAllFlavorSelects();
    alert(`Демо-база загружена. Добавлено: ${added}`);
  },

  updateStats() {
    const brands = new Set(this.state.flavors.map(f => f.brand)).size;
    const cooling = this.state.flavors.filter(f => this.hydrateFlavor(f).analysis.category === 'cooling' || this.hydrateFlavor(f).analysis.traits.cooling >= 6).length;
    const dessert = this.state.flavors.filter(f => {
      const a = this.hydrateFlavor(f).analysis;
      return a.category === 'dessert' || a.category === 'creamy' || a.traits.creaminess >= 5;
    }).length;
    document.getElementById('stat-brands').textContent = brands;
    document.getElementById('stat-flavors').textContent = this.state.flavors.length;
    document.getElementById('stat-cooling').textContent = cooling;
    document.getElementById('stat-dessert').textContent = dessert;
  },

  renderDatabase() {
    const q = this.normalizeText(document.getElementById('db-search') ? document.getElementById('db-search').value : '');
    const typeFilter = document.getElementById('db-filter-type') ? document.getElementById('db-filter-type').value : '';
    const list = document.getElementById('db-list');
    const arr = this.state.flavors
      .map(f => this.hydrateFlavor(f))
      .filter(f => {
        const okSearch = !q || this.normalizeText(f.brand).includes(q) || this.normalizeText(f.name).includes(q) || this.normalizeText(f.description).includes(q);
        const okType = !typeFilter || f.analysis.category === typeFilter;
        return okSearch && okType;
      })
      .sort((a,b) => a.brand.localeCompare(b.brand, 'ru') || a.name.localeCompare(b.name, 'ru'));

    if (!arr.length) {
      list.innerHTML = '<div class="notice">База пуста. Загрузи демо или импортируй свои вкусы.</div>';
      this.updateStats();
      return;
    }

    list.innerHTML = arr.map(f => {
      const a = f.analysis;
      return `
      <div class="flavor-item">
        <div style="flex:1">
          <h4>${this.escapeHtml(f.brand)} <span style="color:var(--primary)">${this.escapeHtml(f.name)}</span></h4>
          <div class="flavor-meta">
            <span class="badge badge-primary">${this.labelCategory(a.category)}</span>
            <span class="badge badge-neutral">Крепость: ${this.escapeHtml(f.strength || 'Средняя')}</span>
            <span class="badge badge-neutral">Громкость: ${a.loudness}/10</span>
            <span class="badge badge-neutral">Риск подавления: ${a.suppressionRisk}/10</span>
          </div>
          ${f.description ? `<p class="text-sm" style="margin-top:8px">${this.escapeHtml(f.description)}</p>` : ''}
          <div class="small-tags">
            ${this.topTraitTags(a.traits).map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
        </div>
        <div class="flex" style="flex-direction:column">
          <button type="button" class="btn btn-sm btn-secondary" onclick="app.quickAddToGenerator(${f.id})">В генератор</button>
          <button type="button" class="btn btn-sm btn-danger" onclick="app.deleteFlavor(${f.id})">Удалить</button>
        </div>
      </div>`;
    }).join('');
    this.updateStats();
  },

  topTraitTags(traits) {
    const map = {
      sweetness:'сладость', acidity:'кислота', freshness:'свежесть', cooling:'холод', creaminess:'сливочность',
      brightness:'яркость', depth:'глубина', floral:'цветы', spicy:'пряность', citrus:'цитрус',
      berry:'ягоды', tropical:'тропики', green:'зеленый', juicy:'сочность', tea:'чай', woody:'сухость'
    };
    return Object.entries(traits).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v]) => `${map[k] || k}: ${v}/10`);
  },

  labelCategory(cat) {
    const map = {
      fruit:'Фруктовый', berry:'Ягодный', citrus:'Цитрусовый', tropical:'Тропический', dessert:'Десертный',
      creamy:'Сливочный', floral:'Цветочный', spicy:'Пряный', tea:'Чайный', cooling:'Охлаждение',
      beverage:'Напитки', woody:'Древесный / табачный'
    };
    return map[cat] || cat;
  },



  normalizeComparableText(s) {
    return this.normalizeText(s)
      .replace(/ё/g, 'е')
      .replace(/black\s*burn/g, 'blackburn')
      .replace(/blackbum/g, 'blackburn')
      .replace(/blac[kx]burn/g, 'blackburn')
      .replace(/[^a-zа-я0-9]+/gi, ' ')
      .replace(/mal1bu/g, 'malibu')
      .replace(/ma1ibu/g, 'malibu')
      .replace(/0/g, 'o')
      .replace(/l/g, 'l')
      .replace(/i/g, 'i')
      .replace(/([a-zа-я0-9]{1,2})/gi, ' $1 ')
      .replace(/simply/g, ' simply ')
      .replace(/mint/g, ' mint ')
      .replace(/mali bu/g, ' malibu ')
      .replace(/super nova/g, ' supernova ')
      .replace(/s+/, ' ')
      .trim();
  },

  compactComparableText(s) {
    return this.normalizeComparableText(s).replace(/\s+/g, '');
  },

  tokenizeComparableText(s) {
    return Array.from(new Set(this.normalizeComparableText(s).split(/\s+/).filter(token => token.length >= 2)));
  },

  bigramSimilarity(a, b) {
    const left = String(a || '');
    const right = String(b || '');
    if (!left || !right) return 0;
    if (left === right) return 1;
    const build = (str) => {
      const grams = [];
      for (let i = 0; i < str.length - 1; i++) grams.push(str.slice(i, i + 2));
      return grams.length ? grams : [str];
    };
    const aGrams = build(left);
    const bGrams = build(right);
    const counts = new Map();
    aGrams.forEach(g => counts.set(g, (counts.get(g) || 0) + 1));
    let intersection = 0;
    bGrams.forEach(g => {
      const count = counts.get(g) || 0;
      if (count > 0) {
        intersection += 1;
        counts.set(g, count - 1);
      }
    });
    return (2 * intersection) / (aGrams.length + bGrams.length);
  },


  levenshteinDistance(a, b) {
    const s = String(a || '');
    const t = String(b || '');
    const m = s.length;
    const n = t.length;
    if (!m) return n;
    if (!n) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  },

  similarityScore(a, b) {
    const left = this.compactComparableText(a);
    const right = this.compactComparableText(b);
    if (!left || !right) return 0;
    const bigram = this.bigramSimilarity(left, right);
    const distance = this.levenshteinDistance(left, right);
    const edit = 1 - (distance / Math.max(left.length, right.length, 1));
    let contain = 0;
    if (left.includes(right) || right.includes(left)) contain = 1;
    return Math.max(bigram * 0.58 + Math.max(0, edit) * 0.32 + contain * 0.10, contain ? 0.72 : 0);
  },

  preprocessPhotoToCanvas(img, mode = 'gray', cropPreset = 'full') {
    const srcW = img.naturalWidth || img.width || 1;
    const srcH = img.naturalHeight || img.height || 1;
    let sx = 0, sy = 0, sw = srcW, sh = srcH;
    if (cropPreset === 'center') {
      sx = srcW * 0.12; sy = srcH * 0.18; sw = srcW * 0.76; sh = srcH * 0.52;
    } else if (cropPreset === 'bottom') {
      sx = srcW * 0.08; sy = srcH * 0.35; sw = srcW * 0.84; sh = srcH * 0.50;
    }
    const scale = Math.min(2200 / Math.max(sw, sh), 2.2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(400, Math.round(sw * scale));
    canvas.height = Math.max(220, Math.round(sh * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      let value = gray;
      if (mode === 'gray') value = Math.min(255, Math.max(0, (gray - 118) * 2.2 + 128));
      else if (mode === 'bw') value = gray > 150 ? 255 : 0;
      else if (mode === 'invert') value = 255 - Math.min(255, Math.max(0, (gray - 118) * 2.1 + 128));
      else if (mode === 'edge') value = gray > 100 && gray < 220 ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = value;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  },

  renderPhotoPassPreviews(previews) {
    const grid = document.getElementById('photo-pass-grid');
    if (!grid) return;
    if (!previews || !previews.length) {
      grid.innerHTML = '';
      return;
    }
    grid.innerHTML = previews.map(item => `<div class="photo-pass-card"><img src="${item.dataUrl}" alt="${this.escapeHtml(item.label)}"><div class="meta">${this.escapeHtml(item.label)}</div></div>`).join('');
  },

  getPhotoSearchTexts(rawText) {
    const base = String(rawText || '');
    const normalized = this.normalizeComparableText(base);
    const compact = this.compactComparableText(base);
    const lines = base.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const normalizedLines = normalized.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const tokens = this.tokenizeComparableText(base);
    const phrases = [];
    lines.forEach(line => phrases.push(line));
    normalizedLines.forEach(line => phrases.push(line));
    if (tokens.length) {
      for (let i = 0; i < tokens.length; i++) {
        phrases.push(tokens[i]);
        if (tokens[i + 1]) phrases.push(tokens[i] + ' ' + tokens[i + 1]);
        if (tokens[i + 2]) phrases.push(tokens[i] + ' ' + tokens[i + 1] + ' ' + tokens[i + 2]);
      }
    }
    if (compact) phrases.push(compact);
    if (normalized) phrases.push(normalized);
    return Array.from(new Set(phrases.map(v => String(v || '').trim()).filter(v => v.length >= 2)));
  },

  applyPhotoCropPreset(preset) {
    this.state.photoCropPreset = preset || 'full';
    const preview = document.getElementById('photo-preview');
    if (preview && preview.src && !preview.classList.contains('hidden')) {
      const modes = [
        { key: 'gray', label: 'Контраст + серый' },
        { key: 'bw', label: 'Жесткий ч/б' },
        { key: 'invert', label: 'Инверсия для светлой печати' }
      ];
      const previews = modes.map(mode => ({
        label: mode.label,
        dataUrl: this.preprocessPhotoToCanvas(preview, mode.key, this.state.photoCropPreset).toDataURL('image/png')
      }));
      this.renderPhotoPassPreviews(previews);
      this.updatePhotoStatus('Режим кадрирования обновлен. Нажми «Распознать и найти» повторно.', 'info');
    }
  },

  normalizePhotoOCRText(rawText) {
    return this.normalizeComparableText(rawText)
      .replace(/[|!]/g, 'i')
      .replace(/(?<=\w)0(?=\w)/g, 'o')
      .replace(/(?<=\w)1(?=\w)/g, 'l')
      .replace(/(?<=\w)5(?=\w)/g, 's')
      .replace(/rn/g, 'm')
      .replace(/vv/g, 'w')
      .replace(/blak+\s*burn/g, 'blackburn')
      .replace(/bla[kx]+\s*burn/g, 'blackburn')
      .replace(/black\s*bun+n?/g, 'blackburn')
      .replace(/black\s*bur[nm]/g, 'blackburn')
      .replace(/black\s*burn/g, 'blackburn')
      .replace(/0verdose/g, 'overdose')
      .replace(/over\s*d0se/g, 'overdose')
      .replace(/over\s*dose/g, 'overdose')
      .replace(/0ver\s*dose/g, 'overdose')
      .replace(/must\s*h[ae]ve/g, 'must have')
      .replace(/musthave/g, 'must have')
      .replace(/dark\s*side/g, 'darkside')
      .replace(/deu5/g, 'deus')
      .replace(/elem?ent/g, 'element')
      .replace(/l[ei]monad[ea]/g, 'lemonade')
      .replace(/lem0nade/g, 'lemonade')
      .replace(/pearr/g, 'pear')
      .replace(/mal1bu/g, 'malibu')
      .replace(/\bblakburn\b/g, 'blackburn')
      .replace(/\bblack burn\b/g, 'blackburn')
      .replace(/\bover dose\b/g, 'overdose')
      .replace(/\boverd0se\b/g, 'overdose')
      .replace(/\s+/g, ' ')
      .trim();
  },

  getBrandCatalog() {
    const seen = new Map();
    this.state.flavors.forEach(flavor => {
      const brand = String(flavor.brand || '').trim();
      if (!brand) return;
      const norm = this.normalizePhotoOCRText(brand);
      if (!seen.has(norm)) {
        seen.set(norm, {
          brand,
          norm,
          compact: this.compactComparableText(norm),
          tokens: this.tokenizeComparableText(norm)
        });
      }
    });
    const aliases = {
      'blackburn': ['black burn','blakburn','black bun','black bum','black burm','black bumn','blak burn'],
      'overdose': ['0verdose','over dose','overd0se','overdo5e','0ver dose','overdosc'],
      'must have': ['musthave','must hve','must hane','musthawe'],
      'darkside': ['dark side','darkslde','darksl de'],
      'deus': ['deu5','devs'],
      'element': ['eiement','elernent','e1ement'],
      'satyr': ['satir','satiyr'],
      'sebero': ['5ebero'],
      'bonche': ['bonhe'],
      'duft': ['dufi']
    };
    seen.forEach(entry => {
      entry.aliases = aliases[entry.compact] || aliases[entry.norm] || [];
    });
    return Array.from(seen.values());
  },

  scoreBrandCandidate(entry, sourceText) {
    const textNorm = this.normalizePhotoOCRText(sourceText);
    const textCompact = this.compactComparableText(textNorm);
    const textTokens = this.tokenizeComparableText(textNorm);
    let score = 0;
    if (!textCompact) return 0;
    if (textCompact.includes(entry.compact)) score += 260;
    if (entry.compact.includes(textCompact) && textCompact.length >= 5) score += 120;
    (entry.aliases || []).forEach(alias => {
      const aliasCompact = this.compactComparableText(alias);
      if (aliasCompact && textCompact.includes(aliasCompact)) score += 210;
    });
    const tokenHits = (entry.tokens || []).filter(token => textTokens.includes(token)).length;
    score += tokenHits * 75;
    score += Math.round(this.similarityScore(textNorm, entry.norm) * 140);
    score += Math.round(this.similarityScore(textCompact, entry.compact) * 120);
    return score;
  },

  getLikelyBrands(sourceText, limit = 3) {
    const ranked = this.getBrandCatalog()
      .map(entry => ({ ...entry, score: this.scoreBrandCandidate(entry, sourceText) }))
      .filter(item => item.score >= 120)
      .sort((a, b) => b.score - a.score);
    return ranked.slice(0, limit);
  },

  getLockedBrand(sourceText) {
    const ranked = this.getLikelyBrands(sourceText, 3);
    if (!ranked.length) return null;
    const top = ranked[0];
    const second = ranked[1] || null;
    const gap = second ? top.score - second.score : top.score;
    const strongExact = this.compactComparableText(sourceText).includes(top.compact);
    if (top.score >= 300 || (top.score >= 240 && gap >= 80) || (strongExact && top.score >= 220)) {
      return { ...top, gap };
    }
    return null;
  },

  async extractPhotoTexts(imgEl) {
    if (typeof Tesseract === 'undefined') {
      await this.ensureExternalLib('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', 'Tesseract');
    }
    const tasks = [
      { key: 'gray', label: 'English-first OCR', crop: this.state.photoCropPreset || 'full', lang: 'eng' },
      { key: 'bw', label: 'Fallback OCR (eng+rus)', crop: 'center', lang: 'eng+rus' }
    ];
    const previews = [];
    const textBlocks = [];
    let bestConfidence = 0;
    for (let idx = 0; idx < tasks.length; idx++) {
      const task = tasks[idx];
      const canvas = this.preprocessPhotoToCanvas(imgEl, task.key, task.crop);
      previews.push({ label: task.label, dataUrl: canvas.toDataURL('image/png') });
      this.renderPhotoPassPreviews(previews);
      this.updatePhotoStatus(`OCR-проход ${idx + 1} из ${tasks.length}: ${task.label}…`, 'info');
      const result = await Tesseract.recognize(canvas, task.lang, {
        logger: (message) => {
          if (message.status === 'recognizing text') {
            const pct = Math.round((message.progress || 0) * 100);
            this.updatePhotoStatus(`OCR ${idx + 1}/${tasks.length}: ${task.label} — ${pct}%`, 'info');
          }
        }
      });
      const rawText = String(result && result.data && result.data.text ? result.data.text : '').trim();
      const confidence = Number(result && result.data && result.data.confidence ? result.data.confidence : 0) || 0;
      bestConfidence = Math.max(bestConfidence, confidence);
      const normalized = this.normalizePhotoOCRText(rawText);
      if (rawText) textBlocks.push(rawText);
      if (normalized && normalized !== rawText) textBlocks.push(normalized);

      const lock = this.getLockedBrand(normalized || rawText);
      const enoughTokens = this.tokenizeComparableText(normalized || rawText).length >= 2;
      if (lock && (confidence >= 45 || enoughTokens)) break;
      if (idx === 0 && confidence >= 70 && enoughTokens) break;
    }
    const merged = Array.from(new Set(textBlocks.join('\n').split(/\n+/).map(v => v.trim()).filter(Boolean))).join('\n');
    return { text: merged, previews, confidence: bestConfidence, lockedBrand: this.getLockedBrand(merged) };
  },

  scorePhotoFlavorMatch(flavor, sourceText, brandContext = null) {
    const sourceNorm = this.normalizePhotoOCRText(sourceText);
    const sourceCompact = this.compactComparableText(sourceNorm);
    const sourceTokens = this.tokenizeComparableText(sourceNorm);
    const searchTexts = this.getPhotoSearchTexts(sourceNorm);

    const brand = this.normalizePhotoOCRText(flavor.brand);
    const name = this.normalizePhotoOCRText(flavor.name);
    const label = `${brand} ${name}`.trim();
    const brandCompact = this.compactComparableText(brand);
    const nameCompact = this.compactComparableText(name);
    const labelCompact = this.compactComparableText(label);
    const nameTokens = this.tokenizeComparableText(name);
    const brandTokens = this.tokenizeComparableText(brand);

    let score = 0;
    const reasons = [];
    if (!sourceCompact) return { score: 0, reasons: [] };

    if (brandContext && this.compactComparableText(brandContext.brand) === brandCompact) {
      score += Math.round(brandContext.score * 0.9);
      reasons.push('совпал бренд');
    } else {
      const brandScore = this.scoreBrandCandidate({ brand: flavor.brand, norm: brand, compact: brandCompact, tokens: brandTokens, aliases: [] }, sourceNorm);
      score += Math.round(brandScore * 0.65);
      if (brandScore >= 150) reasons.push('бренд близок');
    }

    if (sourceCompact.includes(labelCompact) && labelCompact.length >= 5) {
      score += 420;
      reasons.push('полное название найдено в OCR');
    } else if (sourceCompact.includes(nameCompact) && nameCompact.length >= 4) {
      score += 220;
      reasons.push('название вкуса найдено напрямую');
    }

    let bestLabelSimilarity = 0;
    let bestNameSimilarity = 0;
    searchTexts.forEach(line => {
      bestLabelSimilarity = Math.max(bestLabelSimilarity, this.similarityScore(line, label));
      bestNameSimilarity = Math.max(bestNameSimilarity, this.similarityScore(line, name));
      bestNameSimilarity = Math.max(bestNameSimilarity, this.similarityScore(this.compactComparableText(line), nameCompact));
    });
    score += Math.round(bestLabelSimilarity * 180 + bestNameSimilarity * 160);
    if (bestNameSimilarity >= 0.82) reasons.push('вкус почти совпал по OCR');
    else if (bestNameSimilarity >= 0.65) reasons.push('вкус похож по OCR');

    const positions = nameTokens.map(token => sourceTokens.indexOf(token)).filter(pos => pos >= 0);
    const orderedNameHits = positions.filter((pos, idx) => idx === 0 || pos >= positions[idx - 1]).length;
    const nameHitCount = nameTokens.filter(token => sourceTokens.includes(token)).length;
    const brandHitCount = brandTokens.filter(token => sourceTokens.includes(token)).length;
    score += nameHitCount * 95 + orderedNameHits * 45 + brandHitCount * 70;
    if (nameHitCount) reasons.push(`совпало слов вкуса: ${nameHitCount}/${nameTokens.length}`);

    const leftoverTokens = sourceTokens.filter(token => !brandTokens.includes(token) && !nameTokens.includes(token));
    if (leftoverTokens.length >= 3 && nameHitCount === 0 && bestNameSimilarity < 0.55) score -= 60;

    return { score, reasons: Array.from(new Set(reasons)).slice(0, 4) };
  },

  findPhotoMatches(sourceText, limit = 10) {
    const cleaned = this.normalizePhotoOCRText(sourceText);
    if (!cleaned || cleaned.length < 2) return [];

    const lockedBrand = this.getLockedBrand(cleaned);
    const likelyBrands = lockedBrand ? [lockedBrand] : this.getLikelyBrands(cleaned, 3);

    let candidateFlavors = this.state.flavors.slice();
    if (lockedBrand) {
      const lockedCompact = this.compactComparableText(lockedBrand.brand);
      candidateFlavors = this.state.flavors.filter(flavor => this.compactComparableText(flavor.brand) === lockedCompact);
    } else if (likelyBrands.length) {
      const brandSet = new Set(likelyBrands.map(item => this.compactComparableText(item.brand)));
      candidateFlavors = this.state.flavors.filter(flavor => brandSet.has(this.compactComparableText(flavor.brand)));
      if (!candidateFlavors.length) candidateFlavors = this.state.flavors.slice();
    }

    return candidateFlavors
      .map(flavor => {
        const brandContext = likelyBrands.find(item => this.compactComparableText(item.brand) === this.compactComparableText(flavor.brand)) || null;
        const match = this.scorePhotoFlavorMatch(flavor, cleaned, brandContext);
        if (lockedBrand && this.compactComparableText(flavor.brand) !== this.compactComparableText(lockedBrand.brand)) {
          match.score -= 600;
          match.reasons = ['чужой бренд отфильтрован'];
        }
        return {
          flavor,
          score: match.score,
          reasons: match.reasons,
          confidence: this.clampInt(Math.min(99, Math.max(12, Math.round(match.score / 8.5))), 0, 99),
          lockedBrand
        };
      })
      .filter(item => item.score >= (lockedBrand ? 95 : 125))
      .sort((a, b) => b.score - a.score || this.getFlavorLabel(a.flavor).localeCompare(this.getFlavorLabel(b.flavor), 'ru'))
      .slice(0, limit);
  },

  handlePhotoFileChange(input) {
    const file = input.files && input.files[0];
    const preview = document.getElementById('photo-preview');
    const placeholder = document.getElementById('photo-placeholder');
    this.state.photoCropPreset = 'full';
    if (!file) {
      preview.src = '';
      preview.classList.add('hidden');
      placeholder.classList.remove('hidden');
      this.renderPhotoPassPreviews([]);
      this.updatePhotoStatus('Файл не выбран.', 'info');
      return;
    }
    const url = URL.createObjectURL(file);
    preview.onload = () => this.applyPhotoCropPreset('full');
    preview.src = url;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
    this.updatePhotoStatus(`Фото загружено: ${file.name}. Для лучшего OCR можно переключить режим кадрирования и нажать «Распознать и найти».`, 'info');
  },

  updatePhotoStatus(message, type = 'info') {
    const el = document.getElementById('photo-status');
    if (!el) return;
    el.className = 'photo-status ' + type;
    el.textContent = message;
  },

  refreshPhotoResultsSummary(count = null) {
    const summary = document.getElementById('photo-results-summary');
    if (!summary) return;
    const cards = document.querySelectorAll('#photo-results .photo-match-card').length;
    const total = count === null ? cards : count;
    summary.textContent = total ? `Найдено совпадений: ${total}` : 'Пока нет результатов';
  },

  renderPhotoMatches(matches, sourceText) {
    const container = document.getElementById('photo-results');
    if (!container) return;
    if (!matches.length) {
      container.innerHTML = '<div class="photo-empty">Совпадений не найдено. Попробуй режим «Центр этикетки», сделай фото ближе или вручную подправь текст OCR.</div>';
      this.refreshPhotoResultsSummary(0);
      return;
    }
    const queryText = this.escapeHtml(sourceText || '');
    const lockedBrand = matches[0] && matches[0].lockedBrand ? matches[0].lockedBrand : null;
    const brandHint = lockedBrand ? `<div class="notice" style="margin-bottom:12px">Определён бренд: <strong>${this.escapeHtml(lockedBrand.brand)}</strong> · поиск ограничен вкусами этого бренда</div>` : '';
    container.innerHTML = brandHint + matches.map((item, index) => `
      <div class="photo-match-card ${index === 0 ? 'best' : ''}">
        <div class="photo-match-top">
          <div>
            <div class="mix-title" style="font-size:1.02rem;line-height:1.3">${this.escapeHtml(item.flavor.brand)} ${this.escapeHtml(item.flavor.name)}</div>
            <p class="text-sm" style="margin-top:6px">${this.escapeHtml(item.flavor.description || 'Без дополнительного описания')}</p>
          </div>
          <div class="text-right">
            <div class="photo-match-score">${item.confidence}%</div>
            <div class="text-xs muted">уверенность поиска</div>
          </div>
        </div>
        <div class="photo-match-reasons">
          ${item.reasons.map(reason => `<span class="badge badge-neutral">${this.escapeHtml(reason)}</span>`).join('')}
          ${item.flavor.type ? `<span class="badge badge-primary">${this.escapeHtml(item.flavor.type)}</span>` : ''}
          ${item.flavor.strength ? `<span class="badge badge-warning">${this.escapeHtml(item.flavor.strength)}</span>` : ''}
        </div>
        <div class="footer-note" style="margin-top:10px">OCR-текст: ${queryText}</div>
        <div class="photo-actions" style="margin-top:12px">
          <button type="button" class="btn btn-primary btn-sm" onclick="app.addFlavorToFirstEmptySlot(String(item.flavor.id));app.switchTab('selector', document.querySelector(&quot;.nav-btn[data-tab='selector']&quot;))">Это он — добавить в выбор вкусов</button>
        </div>
      </div>
    `).join('');
    this.refreshPhotoResultsSummary(matches.length);
  },

  runPhotoTextSearch() {
    if (!this.state.flavors.length) {
      this.updatePhotoStatus('Сначала загрузи базу вкусов, иначе искать будет не по чему.', 'error');
      return;
    }
    const text = (document.getElementById('photo-ocr-text') || {}).value || '';
    const matches = this.findPhotoMatches(text, 6);
    this.renderPhotoMatches(matches, text);
    if (matches.length) {
      this.updatePhotoStatus(`Поиск выполнен. Лучшее совпадение: ${matches[0].flavor.brand} ${matches[0].flavor.name}.`, 'success');
    } else {
      this.updatePhotoStatus('По OCR-тексту совпадения не найдены. Переключи режим кадрирования, сделай фото крупнее или поправь текст вручную.', 'error');
    }
  },

  async analyzePhotoSearch() {
    if (!this.state.flavors.length) {
      this.updatePhotoStatus('Сначала загрузи базу вкусов.', 'error');
      return;
    }
    const input = document.getElementById('photo-file');
    const file = input && input.files && input.files[0];
    const preview = document.getElementById('photo-preview');
    const textArea = document.getElementById('photo-ocr-text');
    if (!file || !preview || preview.classList.contains('hidden')) {
      this.updatePhotoStatus('Сначала выбери или сфотографируй изображение.', 'error');
      return;
    }
    try {
      this.updatePhotoStatus('Запускаю English-first OCR: сначала ищу бренд, потом вкус…', 'info');
      const extraction = await this.extractPhotoTexts(preview);
      this.renderPhotoPassPreviews(extraction.previews);
      textArea.value = extraction.text;
      const matches = this.findPhotoMatches(extraction.text, 6);
      this.renderPhotoMatches(matches, extraction.text);
      if (matches.length) {
        const top = matches[0];
        const brandMsg = extraction.lockedBrand ? ` Бренд: ${extraction.lockedBrand.brand}.` : '';
        this.updatePhotoStatus(`Готово.${brandMsg} Лучшее совпадение: ${top.flavor.brand} ${top.flavor.name}.`, 'success');
      } else {
        this.updatePhotoStatus('OCR отработал, но уверенных совпадений нет. Попробуй режим «Центр этикетки» или вручную подправь текст.', 'error');
      }
    } catch (error) {
      console.error('Photo OCR failed:', error);
      this.updatePhotoStatus('Ошибка OCR: ' + (error && error.message ? error.message : String(error)), 'error');
    }
  },

  clearPhotoSearch() {
    const fileInput = document.getElementById('photo-file');
    const preview = document.getElementById('photo-preview');
    const placeholder = document.getElementById('photo-placeholder');
    const textArea = document.getElementById('photo-ocr-text');
    if (fileInput) fileInput.value = '';
    if (preview) {
      preview.src = '';
      preview.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (textArea) textArea.value = '';
    const container = document.getElementById('photo-results');
    if (container) container.innerHTML = '<div class="photo-empty">После распознавания здесь появятся лучшие совпадения из базы.</div>';
    this.refreshPhotoResultsSummary(0);
    this.updatePhotoStatus('Поле очищено. Можно загрузить новое фото.', 'info');
  },

  addFlavorToFirstEmptySlot(id) {
    const slots = document.querySelectorAll('.flavor-slot');
    let target = Array.from(slots).find(row => !row.querySelector('.flavor-select').value);
    if (!target) {
      if (slots.length >= 5) {
        alert('Свободных слотов нет. Удали один из слотов и попробуй снова.');
        return;
      }
      this.addFlavorSlot();
      const refreshed = document.querySelectorAll('.flavor-slot');
      target = refreshed[refreshed.length - 1];
    }
    const hidden = target.querySelector('.flavor-select');
    hidden.value = String(id);
    this.syncFlavorSlotUI(target);
    this.closeAllFlavorSearch();
    this.updateSlotsInfo();
  },
  addPhotoMatchToGenerator(id) {
    this.addFlavorToFirstEmptySlot(id);
    this.switchTab('flavors', document.querySelector('.nav-btn[data-tab="flavors"]'));
  },
  bindStaticEvents() {
    return;
  },
  bindGlobalEvents() {
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.search-select')) this.closeAllFlavorSearch();
    }, { passive: true });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.closeAllFlavorSearch();
    });
  },


  async ensureExternalLib(url, globalName, timeout = 15000) {
    if (!this._externalLibPromises) this._externalLibPromises = {};
    if (globalName && window[globalName]) return true;
    if (this._externalLibPromises[url]) return this._externalLibPromises[url];

    this._externalLibPromises[url] = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-external-lib="' + url + '"]');
      if (existing) {
        const started = Date.now();
        const wait = () => {
          if (!globalName || window[globalName]) return resolve(true);
          if (Date.now() - started > timeout) return reject(new Error('Не удалось загрузить библиотеку: ' + url));
          setTimeout(wait, 200);
        };
        wait();
        return;
      }

      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.defer = true;
      script.setAttribute('data-external-lib', url);
      script.onload = () => {
        if (!globalName || window[globalName]) resolve(true);
        else reject(new Error('Библиотека загружена, но объект ' + globalName + ' недоступен'));
      };
      script.onerror = () => reject(new Error('Ошибка загрузки библиотеки: ' + url));
      document.head.appendChild(script);

      setTimeout(() => {
        if (globalName && !window[globalName]) reject(new Error('Таймаут загрузки библиотеки: ' + globalName));
      }, timeout);
    });

    return this._externalLibPromises[url];
  },

  getFlavorLabel(flavor) {
    return `${flavor.brand || 'Unknown'} — ${flavor.name || 'Без названия'}`;
  },

  getFlavorMeta(flavor) {
    const parts = [];
    if (flavor.type) parts.push(flavor.type);
    if (flavor.strength) parts.push('Крепость: ' + flavor.strength);
    return parts.join(' • ');
  },

  buildSearchOptions(query = '', limit = 40) {
    const q = this.normalizeText(query);
    const scored = this.state.flavors.map(flavor => {
      const brand = this.normalizeText(flavor.brand);
      const name = this.normalizeText(flavor.name);
      const type = this.normalizeText(flavor.type);
      const desc = this.normalizeText(flavor.description);
      let score = 0;
      if (!q) score = 10;
      if (name === q) score += 300;
      if (brand === q) score += 200;
      if (name.startsWith(q)) score += 150;
      if (brand.startsWith(q)) score += 120;
      if (name.includes(q)) score += 90;
      if (brand.includes(q)) score += 70;
      if (type.includes(q)) score += 35;
      if (desc.includes(q)) score += 20;
      score += Math.max(0, 20 - Math.min(name.length, 20));
      return { flavor, score };
    })
    .filter(item => !q || item.score > 0)
    .sort((a, b) => b.score - a.score || this.getFlavorLabel(a.flavor).localeCompare(this.getFlavorLabel(b.flavor), 'ru'))
    .slice(0, limit);

    return scored.map(item => item.flavor);
  },

  renderFlavorSearchResults(row, query = '') {
    const panel = row.querySelector('.search-results');
    const results = this.buildSearchOptions(query);
    if (!results.length) {
      panel.innerHTML = '<div class="search-option"><span class="search-option-title">Ничего не найдено</span><span class="search-option-meta">Попробуй другой бренд или вкус</span></div>';
      panel.classList.remove('hidden');
      return;
    }
    panel.innerHTML = results.map(flavor => `
      <button type="button" class="search-option" onclick='app.selectFlavorOption(this, ${JSON.stringify(String(flavor.id))})'>
        <span class="search-option-title">${this.escapeHtml(this.getFlavorLabel(flavor))}</span>
        <span class="search-option-meta">${this.escapeHtml(this.getFlavorMeta(flavor) || 'Без доп. описания')}</span>
      </button>
    `).join('');
    panel.classList.remove('hidden');
  },

  openFlavorSearch(input) {
    const row = input.closest('.flavor-slot');
    this.closeAllFlavorSearch(row);
    this.renderFlavorSearchResults(row, input.value);
  },

  filterFlavorSearch(input) {
    const row = input.closest('.flavor-slot');
    const hidden = row.querySelector('.flavor-select');
    if (!input.value.trim()) hidden.value = '';
    this.renderFlavorSearchResults(row, input.value);
    this.updateSlotsInfo();
  },

  selectFlavorOption(button, id) {
    const row = button.closest('.flavor-slot');
    const hidden = row.querySelector('.flavor-select');
    const input = row.querySelector('.flavor-search');
    const flavor = this.state.flavors.find(f => String(f.id) === String(id));
    hidden.value = String(id);
    input.value = flavor ? this.getFlavorLabel(flavor) : '';
    row.querySelector('.search-results').classList.add('hidden');
    this.updateSlotsInfo();
  },

  clearFlavorSelection(button) {
    const row = button.closest('.flavor-slot');
    row.querySelector('.flavor-select').value = '';
    const input = row.querySelector('.flavor-search');
    input.value = '';
    input.focus();
    this.renderFlavorSearchResults(row, '');
    this.updateSlotsInfo();
  },

  closeAllFlavorSearch(exceptRow = null) {
    document.querySelectorAll('.flavor-slot').forEach(row => {
      if (exceptRow && row === exceptRow) return;
      const panel = row.querySelector('.search-results');
      if (panel) panel.classList.add('hidden');
    });
  },

  syncFlavorSlotUI(row) {
    const hidden = row.querySelector('.flavor-select');
    const input = row.querySelector('.flavor-search');
    const flavor = this.state.flavors.find(f => String(f.id) === String(hidden.value));
    input.value = flavor ? this.getFlavorLabel(flavor) : '';
  },

  addFlavorSlot(selectedId = '') {
    const slots = document.getElementById('flavor-slots');
    if (slots.children.length >= 5) return alert('Максимум 5 слотов');
    const row = document.createElement('div');
    row.className = 'flavor-slot';
    row.innerHTML = `
      <div class="flavor-main">
        <div class="search-select">
          <input type="hidden" class="flavor-select" value="${this.escapeHtml(String(selectedId || ''))}">
          <input type="text" class="flavor-search" placeholder="Начни вводить бренд или вкус..." autocomplete="off" autocapitalize="off" spellcheck="false" onfocus="app.openFlavorSearch(this)" oninput="app.filterFlavorSearch(this)">
          <button type="button" class="flavor-search-clear" onclick="app.clearFlavorSelection(this)" aria-label="Очистить выбор">✕</button>
          <div class="search-results hidden"></div>
        </div>
        <div class="slot-hint">Поиск идет по бренду, вкусу, описанию и категории. Подходит для мобильного ввода.</div>
      </div>
      <select class="flavor-lock">
        <option value="normal">Обычный</option>
        <option value="must">Обязательно оставить</option>
        <option value="prefer_body">Желательно базой</option>
        <option value="prefer_accent">Желательно акцентом</option>
      </select>
      <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove();app.updateSlotsInfo()" aria-label="Удалить слот">✕</button>
    `;
    slots.appendChild(row);
    this.syncFlavorSlotUI(row);
    this.updateSlotsInfo();
  },

  clearFlavorSlots() {
    document.getElementById('flavor-slots').innerHTML = '';
    this.ensureInitialSlots();
  },

  refreshAllFlavorSelects() {
    document.querySelectorAll('.flavor-slot').forEach(row => {
      const hidden = row.querySelector('.flavor-select');
      const exists = this.state.flavors.some(f => String(f.id) === String(hidden.value));
      if (!exists) hidden.value = '';
      this.syncFlavorSlotUI(row);
    });
  },

  updateSlotsInfo() {
    const rows = document.querySelectorAll('.flavor-slot').length;
    const chosen = Array.from(document.querySelectorAll('.flavor-select')).filter(x => x.value).length;
    document.getElementById('slots-info').textContent = `Слотов: ${rows}. Выбрано вкусов: ${chosen}. Для лучшего результата используй 2–4 вкуса. Поиск работает по всей базе.`;
  },

  collectSelectedFlavors() {
    return Array.from(document.querySelectorAll('.flavor-slot'))
      .map(row => {
        const id = row.querySelector('.flavor-select').value;
        const lock = row.querySelector('.flavor-lock').value;
        if (!id) return null;
        const flavor = this.state.flavors.find(f => String(f.id) === String(id));
        if (!flavor) return null;
        return { ...this.hydrateFlavor({...flavor}), lock };
      })
      .filter(Boolean);
  },

  quickAddToGenerator(id) {
    const empty = Array.from(document.querySelectorAll('.flavor-slot .flavor-select')).find(x => !x.value);
    if (empty) {
      empty.value = String(id);
      const row = empty.closest('.flavor-slot');
      this.syncFlavorSlotUI(row);
    } else {
      this.addFlavorSlot(id);
    }
    this.updateSlotsInfo();
    this.switchTab('flavors', document.querySelector('[data-tab="flavors"]'));
  },

  deleteFlavor(id) {
    if (!confirm('Удалить этот вкус из базы?')) return;
    this.state.flavors = this.state.flavors.filter(f => String(f.id) !== String(id));
    this.saveData();
    this.renderDatabase();
    this.refreshAllFlavorSelects();
  },

  clearDatabase() {
    if (!confirm('Полностью очистить базу вкусов?')) return;
    this.state.flavors = [];
    this.saveData();
    this.renderDatabase();
    this.refreshAllFlavorSelects();
  },

  exportData() {
    const data = JSON.stringify(this.state.flavors, null, 2);
    const href = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
    const a = document.createElement('a');
    a.href = href;
    a.download = 'hookah_mixology_database.json';
    a.click();
  },

  switchTab(tab, btn) {
    const target = document.getElementById('tab-' + tab);
    if (!target) return;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    target.classList.remove('hidden');
    if (btn) btn.classList.add('active');
    if (tab === 'database') this.renderDatabase();
    if (tab === 'favorites') this.renderFavorites();
    if (tab === 'photo') this.refreshPhotoResultsSummary();
  },

  toggleJsonMode() {
    this.state.jsonMode = !this.state.jsonMode;
    alert(this.state.jsonMode ? 'JSON-preview включен' : 'JSON-preview выключен');
  },

  generate() {
    const resultsArea = document.getElementById('results-area');
    if (!this.state.flavors.length) {
      resultsArea.innerHTML = '<div class="card notice">Сначала загрузи базу вкусов.</div>';
      return;
    }

    const mode = document.getElementById('gen-mode').value;
    const requestedCount = parseInt(document.getElementById('gen-count').value, 10);
    const style = document.getElementById('gen-style').value;
    const coolingLevel = document.getElementById('cooling-level').value;
    const resultCount = parseInt(document.getElementById('result-count').value, 10);
    const fixedComposition = document.getElementById('fixed-composition').value === 'yes';
    const selected = this.collectSelectedFlavors();

    resultsArea.innerHTML = '<div class="card text-center">⏳ Анализирую роли, тело микса, проценты и совместимость…</div>';

    setTimeout(() => {
      try {
        let results = [];
        if (mode === 'manual' && selected.length >= 2) {
          const targetCount = Math.max(2, Math.min(requestedCount, selected.length));
          results = this.buildManualResults(selected, style, coolingLevel, fixedComposition, false, targetCount, resultCount);
        } else {
          results = this.buildAutomaticResults(requestedCount, style, coolingLevel, resultCount);
        }
        if (!results.length) {
          resultsArea.innerHTML = '<div class="card notice">Не удалось собрать хорошие варианты. Попробуй другой стиль, меньше вкусов или загрузи больше базы.</div>';
          return;
        }
        this.renderResults(results.slice(0, resultCount), { mode, style, coolingLevel });
        this.switchTab('results', document.querySelector('.nav-btn[data-tab="results"]'));
      } catch (error) {
        console.error('Generation failed:', error);
        resultsArea.innerHTML = '<div class="card" style="border-color:var(--danger);color:var(--danger)">Ошибка генерации: ' + this.escapeHtml(error && error.message ? error.message : String(error)) + '</div>';
        this.switchTab('results', document.querySelector('.nav-btn[data-tab="results"]'));
      }
    }, 50);
  },

  generateAlternatives() {
    const selected = this.collectSelectedFlavors();
    if (selected.length < 2) return alert('Для альтернатив выбери минимум 2 вкуса');
    const style = document.getElementById('gen-style').value;
    const coolingLevel = document.getElementById('cooling-level').value;
    const fixedComposition = document.getElementById('fixed-composition').value === 'yes';
    const requestedCount = parseInt(document.getElementById('gen-count').value, 10);
    const resultCount = parseInt(document.getElementById('result-count').value, 10);
    try {
      const targetCount = Math.max(2, Math.min(requestedCount, selected.length));
      const results = this.buildManualResults(selected, style, coolingLevel, fixedComposition, true, targetCount, Math.max(resultCount, 6));
      this.renderResults(results, { mode:'manual', style, coolingLevel });
      this.switchTab('results', document.querySelector('.nav-btn[data-tab="results"]'));
    } catch (error) {
      console.error('Alternative generation failed:', error);
      document.getElementById('results-area').innerHTML = '<div class="card" style="border-color:var(--danger);color:var(--danger)">Ошибка генерации альтернатив: ' + this.escapeHtml(error && error.message ? error.message : String(error)) + '</div>';
      this.switchTab('results', document.querySelector('.nav-btn[data-tab="results"]'));
    }
  },

  buildManualResults(selected, style, coolingLevel, fixedComposition, forceAlternatives = false, targetCount = null, resultCount = 3) {
    const desiredCount = Math.max(2, Math.min(targetCount || selected.length, selected.length));
    let workingFlavors = [...selected];
    if (!fixedComposition && workingFlavors.length > Math.max(4, desiredCount)) {
      workingFlavors = this.pruneWeakestFlavor(workingFlavors, style).slice(0, Math.max(4, desiredCount));
    }

    const groups = this.buildManualFlavorGroups(workingFlavors, style, coolingLevel, desiredCount, fixedComposition);
    let variants = [];
    groups.forEach(group => {
      const candidateVariants = this.generateCandidateVariants(group, style, coolingLevel, forceAlternatives ? 12 : 10, desiredCount);
      candidateVariants.forEach(variant => {
        variant.sourceSelectionSize = group.length;
        variant.selectedPoolSize = selected.length;
        variants.push(variant);
      });
    });

    const unique = [];
    const seen = new Set();
    variants
      .sort((a,b) => b.compatibilityScore - a.compatibilityScore)
      .forEach(variant => {
        const key = variant.items.map(x => x.brand + ':' + x.name + ':' + x.role + ':' + x.percent).sort().join('|') + '|' + (variant.mixConcept || variant.styleVariant || '');
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(variant);
        }
      });

    const diversified = this.diversifyVariantSelection(unique, Math.max(resultCount * 4, forceAlternatives ? 10 : 8));
    if (forceAlternatives) return diversified;
    return this.rotateManualVariants(diversified, selected, desiredCount, style, coolingLevel, resultCount);
  },

  buildManualFlavorGroups(flavors, style, coolingLevel, targetCount, fixedComposition) {
    if (flavors.length <= targetCount) return [flavors];
    const combos = this.getCombinations(flavors, targetCount);
    const scored = combos.map(group => ({
      group,
      score: this.scoreManualGroup(group, style, coolingLevel, fixedComposition)
    })).sort((a,b) => b.score - a.score);
    return scored.slice(0, 12).map(x => x.group);
  },

  scoreManualGroup(group, style, coolingLevel, fixedComposition) {
    const target = this.styleTargets[style] || this.styleTargets.universal;
    const vector = this.mixVector(group.map(item => ({ ...item, percent: Math.round(100 / group.length) })));
    let score = 0;
    score += 14 - Math.abs(vector.freshness - target.freshness);
    score += 14 - Math.abs(vector.sweetness - target.sweetness);
    score += 14 - Math.abs(vector.acidity - target.acidity);
    score += 10 - Math.abs(vector.creaminess - target.creaminess);
    score += 10 - Math.abs(vector.depth - target.depth);
    score += 10 - Math.abs(vector.brightness - target.brightness);

    const pairwise = [];
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) pairwise.push(this.scorePair(group[i], group[j]));
    }
    score += pairwise.reduce((s, p) => s + p.score, 0) * 2.2;
    score -= pairwise.filter(p => p.conflict >= 3).length * 6;
    score -= group.filter(f => f.analysis.suppressionRisk >= 8).length * 3;
    if (coolingLevel === 'none') score -= group.filter(f => f.analysis.traits.cooling >= 6).length * 5;
    if (coolingLevel === 'strong') score += group.filter(f => f.analysis.traits.cooling >= 5).length * 3;
    if (!fixedComposition) score += group.filter(f => f.analysis.roleSuit.body >= 5).length * 2;
    return score;
  },

  getCombinations(items, choose) {
    const result = [];
    const walk = (start, acc) => {
      if (acc.length === choose) {
        result.push(acc.slice());
        return;
      }
      for (let i = start; i <= items.length - (choose - acc.length); i++) {
        acc.push(items[i]);
        walk(i + 1, acc);
        acc.pop();
      }
    };
    walk(0, []);
    return result;
  },

  rotateManualVariants(variants, selected, targetCount, style, coolingLevel, resultCount) {
    if (!variants.length) return [];
    const signature = this.buildGenerationSignature(selected, targetCount, style, coolingLevel);
    const selectedKeys = selected.map(f => this.normalizeText(f.brand + '|' + f.name));
    const history = this.state.generationHistory[signature] || { cursor: 0, flavorUsage: {}, bodyUsage: {}, seenVariants: {} };
    const flavorUsage = history.flavorUsage || {};
    const bodyUsage = history.bodyUsage || {};
    const seenVariants = history.seenVariants || {};
    const ranked = variants.map((variant, idx) => {
      const variantKeys = variant.items.map(i => this.normalizeText(i.brand + '|' + i.name));
      const unusedBoost = variantKeys.reduce((sum, key) => sum + (flavorUsage[key] ? 0 : 10), 0);
      const lowUseBoost = variantKeys.reduce((sum, key) => sum + Math.max(0, 6 - Math.min(6, flavorUsage[key] || 0)), 0);
      const bodyKey = this.normalizeText((variant.items.find(i => i.role === 'body') || variant.items[0]).brand + '|' + (variant.items.find(i => i.role === 'body') || variant.items[0]).name);
      const bodyPenalty = Math.max(0, (bodyUsage[bodyKey] || 0) - 1) * 10;
      const repeatPenalty = Math.max(0, (seenVariants[variant.items.map(i => this.normalizeText(i.brand + '|' + i.name + '|' + i.role)).sort().join('::')] || 0)) * 18;
      const coveragePenalty = selectedKeys.filter(key => !variantKeys.includes(key) && !(flavorUsage[key] >= 1)).length * 8;
      return { variant, idx, adjusted: variant.compatibilityScore + unusedBoost + lowUseBoost - bodyPenalty - repeatPenalty - coveragePenalty };
    }).sort((a,b) => b.adjusted - a.adjusted || a.idx - b.idx);

    const take = Math.min(resultCount, ranked.length);
    const chosen = ranked.slice(0, take).map(x => x.variant);
    chosen.forEach(variant => {
      const sig = variant.items.map(i => this.normalizeText(i.brand + '|' + i.name + '|' + i.role)).sort().join('::');
      seenVariants[sig] = (seenVariants[sig] || 0) + 1;
      variant.items.forEach(item => {
        const key = this.normalizeText(item.brand + '|' + item.name);
        flavorUsage[key] = (flavorUsage[key] || 0) + 1;
      });
      const body = variant.items.find(i => i.role === 'body') || variant.items[0];
      const bodyKey = this.normalizeText(body.brand + '|' + body.name);
      bodyUsage[bodyKey] = (bodyUsage[bodyKey] || 0) + 1;
    });
    this.state.generationHistory[signature] = {
      cursor: (history.cursor || 0) + take,
      flavorUsage,
      bodyUsage,
      seenVariants
    };
    return chosen;
  },

  buildGenerationSignature(selected, targetCount, style, coolingLevel) {
    return [
      targetCount,
      style,
      coolingLevel,
      selected.map(f => this.normalizeText(f.brand + ':' + f.name)).sort().join('|')
    ].join('::');
  },

  pruneWeakestFlavor(flavors, style) {
    const scored = flavors.map(f => {
      const a = f.analysis;
      const target = this.styleTargets[style] || this.styleTargets.universal;
      let fit = 0;
      fit += 10 - Math.abs(a.traits.freshness - target.freshness);
      fit += 10 - Math.abs(a.traits.sweetness - target.sweetness);
      fit += 10 - Math.abs(a.traits.acidity - target.acidity);
      fit += 10 - Math.abs(a.traits.depth - target.depth);
      fit += a.roleSuit.body + a.roleSuit.support;
      if (f.lock === 'must') fit += 999;
      return { flavor: f, fit };
    }).sort((a,b) => b.fit - a.fit);
    return scored.slice(0, 4).map(x => x.flavor);
  },

  scoreFlavorAgainstTarget(flavor, styleTarget, coolingLevel, targetRole = 'support', bodyFlavor = null) {
    const a = flavor.analysis;
    let fit = 0;

    fit += 12 - Math.abs(a.traits.freshness - styleTarget.freshness);
    fit += 12 - Math.abs(a.traits.sweetness - styleTarget.sweetness);
    fit += 12 - Math.abs(a.traits.acidity - styleTarget.acidity);
    fit += 10 - Math.abs(a.traits.creaminess - styleTarget.creaminess);
    fit += 10 - Math.abs(a.traits.depth - styleTarget.depth);
    fit += 10 - Math.abs(a.traits.brightness - styleTarget.brightness);

    if (coolingLevel === 'none' && a.traits.cooling >= 6) fit -= 22;
    if (coolingLevel === 'light' && a.traits.cooling >= 8) fit -= 8;
    if (coolingLevel === 'medium' && a.traits.cooling >= 5 && a.traits.cooling <= 8) fit += 6;
    if (coolingLevel === 'strong' && a.traits.cooling >= 6) fit += 12;
    if (coolingLevel === 'strong' && a.category === 'cooling') fit += 8;

    if (targetRole === 'body') fit += a.roleSuit.body * 3.4;
    if (targetRole === 'support') fit += a.roleSuit.support * 3.0;
    if (targetRole === 'accent') fit += a.roleSuit.accent * 3.0;
    if (targetRole === 'rounder') fit += a.roleSuit.rounder * 3.2;
    if (targetRole === 'cooler') fit += a.roleSuit.cooler * 3.4;

    if (targetRole !== 'body' && a.suppressionRisk >= 8) fit -= 8;
    if (targetRole === 'accent' && a.suppressionRisk >= 8) fit -= 4;
    if (targetRole === 'body' && (a.traits.cooling >= 7 || a.traits.floral >= 7)) fit -= 12;
    if (targetRole === 'body' && a.roleSuit.body < 5) fit -= 10;
    if (targetRole === 'rounder' && a.roleSuit.rounder < 4) fit -= 8;
    if (targetRole === 'cooler' && a.roleSuit.cooler < 4) fit -= 10;

    if (bodyFlavor) {
      const pair = this.scorePair(bodyFlavor, flavor);
      fit += pair.score * 2.8;
      if (bodyFlavor.analysis.category === flavor.analysis.category) fit += 2;
      if (targetRole === 'support' && pair.conflict > 0) fit -= 6;
      if (targetRole === 'accent' && pair.conflict > 2) fit -= 8;
      if (targetRole === 'rounder' && (flavor.analysis.traits.creaminess >= 5 || flavor.analysis.category === 'creamy' || flavor.analysis.category === 'dessert')) fit += 5;
    }

    return fit;
  },

  weightedPick(candidates) {
    if (!candidates.length) return null;
    const positive = candidates.map(c => ({ ...c, weight: Math.max(1, c.fit - candidates[candidates.length - 1].fit + 1) }));
    const total = positive.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * total;
    for (const item of positive) {
      r -= item.weight;
      if (r <= 0) return item.flavor;
    }
    return positive[0].flavor;
  },

  autoRolePlan(count, style, coolingLevel) {
    if (count === 2) return ['body', 'support'];
    if (count === 3) {
      if (style === 'dessert') return ['body', 'support', 'rounder'];
      if (style === 'fresh') return coolingLevel === 'none' ? ['body', 'support', 'accent'] : ['body', 'support', 'cooler'];
      if (style === 'tea') return ['body', 'support', 'accent'];
      return ['body', 'support', 'accent'];
    }
    if (count === 4) {
      if (style === 'dessert') return ['body', 'support', 'rounder', 'accent'];
      if (style === 'fresh') return coolingLevel === 'none' ? ['body', 'support', 'accent', 'rounder'] : ['body', 'support', 'accent', 'cooler'];
      return ['body', 'support', 'rounder', 'accent'];
    }
    if (style === 'fresh' && coolingLevel !== 'none') return ['body', 'support', 'support', 'accent', 'cooler'];
    return ['body', 'support', 'support', 'rounder', 'accent'];
  },

  pickFlavorForRole(pool, picked, role, styleTarget, coolingLevel, bodyFlavor, usedCategories) {
    const pickedIds = new Set(picked.map(f => String(f.id)));
    let candidates = pool
      .filter(f => !pickedIds.has(String(f.id)))
      .map(flavor => {
        let fit = this.scoreFlavorAgainstTarget(flavor, styleTarget, coolingLevel, role, bodyFlavor);
        if (!bodyFlavor && role === 'body') fit += (10 - flavor.analysis.suppressionRisk);
        if (usedCategories.has(flavor.analysis.category) && role !== 'support') fit -= 4;
        if (!usedCategories.has(flavor.analysis.category) && role !== 'body') fit += 2;
        return { flavor, fit };
      })
      .sort((a, b) => b.fit - a.fit);

    if (role === 'cooler') {
      candidates = candidates.filter(c => c.flavor.analysis.roleSuit.cooler >= 4 || c.flavor.analysis.traits.cooling >= 4);
    }
    if (role === 'rounder') {
      candidates = candidates.filter(c => c.flavor.analysis.roleSuit.rounder >= 4 || c.flavor.analysis.traits.creaminess >= 4 || c.flavor.analysis.category === 'creamy' || c.flavor.analysis.category === 'dessert');
    }
    if (role === 'accent') {
      candidates = candidates.filter(c => c.flavor.analysis.roleSuit.accent >= 4 || c.flavor.analysis.traits.citrus >= 4 || c.flavor.analysis.traits.berry >= 4 || c.flavor.analysis.traits.spicy >= 4 || c.flavor.analysis.traits.floral >= 4);
    }
    if (role === 'support') {
      candidates = candidates.filter(c => c.flavor.analysis.roleSuit.support >= 4 || c.flavor.analysis.roleSuit.body >= 5);
    }
    if (role === 'body') {
      candidates = candidates.filter(c => c.flavor.analysis.roleSuit.body >= 4);
    }

    const topWindow = Math.max(10, Math.min(40, Math.floor(pool.length * 0.12)));
    const shortlist = candidates.slice(0, topWindow);
    return this.weightedPick(shortlist);
  },

  diversifyVariantSelection(variants, resultCount) {
    const ranked = [...variants].sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    const selected = [];
    const usage = new Map();

    while (ranked.length && selected.length < resultCount) {
      let bestIndex = 0;
      let bestScore = -Infinity;

      ranked.forEach((variant, idx) => {
        const overlapPenalty = variant.items.reduce((sum, item) => sum + ((usage.get(item.brand + '|' + item.name) || 0) * 6), 0) + ((usage.get('concept|' + (variant.mixConcept || variant.styleVariant)) || 0) * 4);
        const adjusted = variant.compatibilityScore - overlapPenalty;
        if (adjusted > bestScore) {
          bestScore = adjusted;
          bestIndex = idx;
        }
      });

      const chosen = ranked.splice(bestIndex, 1)[0];
      selected.push(chosen);
      chosen.items.forEach(item => {
        const key = item.brand + '|' + item.name;
        usage.set(key, (usage.get(key) || 0) + 1);
      });
      const conceptKey = 'concept|' + (chosen.mixConcept || chosen.styleVariant);
      usage.set(conceptKey, (usage.get(conceptKey) || 0) + 1);
    }

    return selected;
  },

  buildAutomaticResults(count, style, coolingLevel, resultCount) {
    const pool = this.state.flavors.map(f => this.hydrateFlavor({...f}));
    if (pool.length < count) return [];
    const styleTarget = this.styleTargets[style] || this.styleTargets.universal;

    const uniquePool = [];
    const poolKeys = new Set();
    pool.forEach(flavor => {
      const key = this.normalizeText(flavor.brand + '|' + flavor.name);
      if (!poolKeys.has(key)) {
        poolKeys.add(key);
        uniquePool.push(flavor);
      }
    });

    const scoredBodies = uniquePool
      .map(flavor => ({ flavor, fit: this.scoreFlavorAgainstTarget(flavor, styleTarget, coolingLevel, 'body', null) }))
      .sort((a, b) => b.fit - a.fit);

    const bodyPoolSize = Math.min(uniquePool.length, Math.max(24, Math.round(Math.sqrt(uniquePool.length) * 5)));
    const bodyPool = scoredBodies.slice(0, bodyPoolSize).map(x => x.flavor);

    const attempts = Math.min(2200, Math.max(700, uniquePool.length * 4));
    const variants = [];
    const seenSets = new Set();
    const rolePlan = this.autoRolePlan(count, style, coolingLevel);

    for (let i = 0; i < attempts; i++) {
      const picked = [];
      const usedCategories = new Set();

      const randomizedBodyPool = bodyPool.slice(0, Math.min(bodyPool.length, 50)).map((flavor, idx) => ({
        flavor,
        fit: (scoredBodies[idx] ? scoredBodies[idx].fit : this.scoreFlavorAgainstTarget(flavor, styleTarget, coolingLevel, 'body')) + Math.random() * 8
      }));
      const bodyFlavor = this.weightedPick(randomizedBodyPool) || bodyPool[Math.floor(Math.random() * bodyPool.length)] || uniquePool[0];
      if (!bodyFlavor) continue;

      picked.push(bodyFlavor);
      usedCategories.add(bodyFlavor.analysis.category);

      for (let roleIndex = 1; roleIndex < rolePlan.length; roleIndex++) {
        const role = rolePlan[roleIndex];
        const nextFlavor = this.pickFlavorForRole(uniquePool, picked, role, styleTarget, coolingLevel, bodyFlavor, usedCategories);
        if (!nextFlavor) break;
        picked.push(nextFlavor);
        usedCategories.add(nextFlavor.analysis.category);
      }

      if (picked.length !== count) continue;

      const signature = picked.map(f => this.normalizeText(f.brand + ':' + f.name)).sort().join('|');
      if (seenSets.has(signature)) continue;
      seenSets.add(signature);

      const candidateVariants = this.generateCandidateVariants(picked, style, coolingLevel, 3);
      candidateVariants.forEach(variant => variants.push(variant));
    }

    const uniqueVariants = [];
    const seenVariantKeys = new Set();
    variants
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .forEach(variant => {
        const key = variant.items.map(x => x.brand + ':' + x.name + ':' + x.role + ':' + x.percent).sort().join('|');
        if (!seenVariantKeys.has(key)) {
          seenVariantKeys.add(key);
          uniqueVariants.push(variant);
        }
      });

    return this.diversifyVariantSelection(uniqueVariants, resultCount);
  },

generateCandidateVariants(flavors, style, coolingLevel, limit = 4, forcedCount = null) {
  const hydrated = flavors.map(f => this.hydrateFlavor({...f}));
  const count = forcedCount || hydrated.length;
  const target = this.styleTargets[style] || this.styleTargets.universal;
  const conceptOrder = this.getConceptPriority(style, count, coolingLevel);
  const bodyCandidates = [...hydrated].sort((a,b) => {
    const aScore = (a.lock === 'prefer_body' ? 999 : 0) + a.analysis.roleSuit.body * 3.0 + a.analysis.density * 0.8 + a.analysis.versatility * 0.55 - a.analysis.conflictRisk * 0.9 - a.analysis.traits.cooling * 0.9 - a.analysis.traits.floral * 0.35;
    const bScore = (b.lock === 'prefer_body' ? 999 : 0) + b.analysis.roleSuit.body * 3.0 + b.analysis.density * 0.8 + b.analysis.versatility * 0.55 - b.analysis.conflictRisk * 0.9 - b.analysis.traits.cooling * 0.9 - b.analysis.traits.floral * 0.35;
    return bScore - aScore;
  }).slice(0, Math.min(Math.max(3, count), hydrated.length));

  const candidates = [];
  bodyCandidates.forEach(bodyFlavor => {
    conceptOrder.forEach(conceptMode => {
      const roleMap = this.assignRoles(hydrated, bodyFlavor, style, coolingLevel, conceptMode);
      const conceptFamilies = this.buildConceptFamilies(roleMap, count, style, coolingLevel, conceptMode);
      conceptFamilies.forEach(family => {
        const variant = this.buildVariant(hydrated, roleMap, family, style, coolingLevel, family.mode || conceptMode || 'base');
        if (variant) {
          variant.bodyCandidate = bodyFlavor.name;
          variant.conceptMode = conceptMode;
          candidates.push(variant);
        }
      });
    });
  });

  const unique = [];
  const keys = new Set();
  candidates
    .sort((a,b) => b.compatibilityScore - a.compatibilityScore)
    .forEach(c => {
      const key = c.items.map(i => `${i.name}:${i.role}:${i.percent}`).join('|') + '|' + c.mixConcept + '|' + (c.conceptMode || '');
      if (!keys.has(key)) {
        keys.add(key);
        unique.push(c);
      }
    });

  return this.diversifyVariantSelection(unique, Math.max(limit, 12)).slice(0, limit);
},

assignRoles(flavors, bodyFlavor, style, coolingLevel, conceptMode = 'base') {
  const roleMap = new Map();
  roleMap.set(bodyFlavor.id, 'body');

  const others = flavors.filter(f => f.id !== bodyFlavor.id);
  const bodyCategory = bodyFlavor.analysis.category;
  const needsRounder = ['citrus','berry','tea','cooling','floral','spicy'].includes(bodyCategory) || bodyFlavor.analysis.traits.acidity >= 6 || bodyFlavor.analysis.conflictRisk >= 6;
  const coolingAllowed = coolingLevel !== 'none';
  const wantsFresh = ['fresh','fresh_arch','contrast','signature_contrast','sour_focus','cool_bloom'].includes(conceptMode);
  const wantsCommercial = ['commercial','signature_commercial','commercial_clean','clear_body'].includes(conceptMode);
  const wantsSoft = ['soft_bridge','smooth_signature','dessert_round','soft_creamy'].includes(conceptMode);

  let coolerAssigned = false;
  let rounderAssigned = false;
  let accentAssigned = false;

  const sorted = [...others].sort((a,b) => {
    const pairA = this.scorePair(bodyFlavor, a);
    const pairB = this.scorePair(bodyFlavor, b);
    const scoreA = Math.max(a.analysis.roleSuit.support, a.analysis.roleSuit.rounder, a.analysis.roleSuit.accent, a.analysis.roleSuit.cooler)
      + a.analysis.versatility * 0.6
      + pairA.score * 1.3
      - a.analysis.conflictRisk * 0.25
      - (wantsCommercial && a.analysis.suppressionRisk >= 8 ? 4 : 0)
      + (wantsSoft && a.analysis.roleSuit.rounder >= 6 ? 2 : 0)
      + (wantsFresh && a.analysis.traits.freshness >= 5 ? 2 : 0);
    const scoreB = Math.max(b.analysis.roleSuit.support, b.analysis.roleSuit.rounder, b.analysis.roleSuit.accent, b.analysis.roleSuit.cooler)
      + b.analysis.versatility * 0.6
      + pairB.score * 1.3
      - b.analysis.conflictRisk * 0.25
      - (wantsCommercial && b.analysis.suppressionRisk >= 8 ? 4 : 0)
      + (wantsSoft && b.analysis.roleSuit.rounder >= 6 ? 2 : 0)
      + (wantsFresh && b.analysis.traits.freshness >= 5 ? 2 : 0);
    return scoreB - scoreA;
  });

  sorted.forEach((flavor) => {
    if (flavor.lock === 'prefer_accent') {
      roleMap.set(flavor.id, 'accent');
      accentAssigned = true;
      return;
    }

    const pair = this.scorePair(bodyFlavor, flavor);

    if (coolingAllowed && !coolerAssigned && (wantsFresh || coolingLevel === 'strong') && (flavor.analysis.roleSuit.cooler >= 6 || flavor.analysis.traits.cooling >= 6)) {
      roleMap.set(flavor.id, 'cooler');
      coolerAssigned = true;
      return;
    }

    if (!rounderAssigned && (needsRounder || wantsSoft) && (flavor.analysis.roleSuit.rounder >= 6 || flavor.analysis.density >= 6 || flavor.analysis.category === 'dessert' || flavor.analysis.category === 'creamy')) {
      roleMap.set(flavor.id, 'rounder');
      rounderAssigned = true;
      return;
    }

    if (!accentAssigned && (
      flavor.analysis.roleSuit.accent >= (wantsCommercial ? 8 : 7) ||
      pair.shared < 0.8 ||
      flavor.analysis.traits.citrus >= 5 ||
      flavor.analysis.traits.berry >= 5 ||
      flavor.analysis.traits.spicy >= 5 ||
      (wantsFresh && flavor.analysis.traits.freshness >= 6)
    )) {
      roleMap.set(flavor.id, 'accent');
      accentAssigned = true;
      return;
    }

    if (flavor.analysis.roleSuit.support >= 4 || pair.score >= 1 || (wantsCommercial && flavor.analysis.backgroundability >= 6)) {
      roleMap.set(flavor.id, 'support');
    } else if (!accentAssigned) {
      roleMap.set(flavor.id, 'accent');
      accentAssigned = true;
    } else {
      roleMap.set(flavor.id, rounderAssigned ? 'support' : 'rounder');
      rounderAssigned = rounderAssigned || !rounderAssigned;
    }
  });

  if (![...roleMap.values()].includes('support')) {
    const promotable = [...roleMap.entries()].find(([, role]) => role === 'accent' || role === 'rounder');
    if (promotable) roleMap.set(promotable[0], 'support');
  }

  return roleMap;
},

buildConceptFamilies(roleMap, count, style, coolingLevel, conceptMode = 'base') {
  const availableRoles = new Set([...roleMap.values()]);
  const baseFamilies = (this.ratioFamilies[count] || this.ratioFamilies[3]).map(f => ({...f, mode:'base', conceptType:'core'}));
  const extra = [];

  const pushIfValid = (name, mode, roles, conceptType='alternate') => {
    const family = this.resolveFamilyForRoles({ name, mode, conceptType, roles: { ...roles } }, availableRoles, count, coolingLevel);
    if (family) extra.push(family);
  };

  if (count === 2) {
    pushIfValid('Контрастный дуэт', 'contrast', { body: 65, support: 35 }, 'contrast');
    pushIfValid('Равноправный дуэт', 'duo_balance', { body: 50, support: 50 }, 'balanced');
    pushIfValid('Коммерческий дуэт', 'commercial', { body: 58, support: 42 }, 'commercial');
    pushIfValid('Чистый коммерческий', 'commercial_clean', { body: 62, support: 38 }, 'commercial');
  }

  if (count === 3) {
    pushIfValid('70/20/10 Ясный лидер', 'body_forward', { body: 70, support: 20, accent: 10 }, 'body');
    pushIfValid('40/40/20 Двойная база', 'dual_body', { body: 40, support: 40, accent: 20 }, 'dual');
    pushIfValid('55/20/25 Яркий верх', 'accent_forward', { body: 55, support: 20, accent: 25 }, 'accent');
    pushIfValid('50/35/15 Мягкий баланс', 'soft_bridge', { body: 50, support: 35, rounder: 15 }, 'soft');
    pushIfValid('60/15/25 Контраст', 'contrast', { body: 60, support: 15, accent: 25 }, 'contrast');
    pushIfValid('55/25/20 Коммерческий clean', 'commercial_clean', { body: 55, support: 25, accent: 20 }, 'commercial');
    pushIfValid('45/35/20 Кислая дуга', 'sour_focus', { body: 45, support: 35, accent: 20 }, 'effect');
  }

  if (count === 4) {
    pushIfValid('45/25/20/10 Слоистый', 'layered', { body: 45, support: 25, rounder: 20, accent: 10 }, 'layered');
    pushIfValid('40/30/15/15 Авторский', 'authorial', { body: 40, support: 30, accent: 15, rounder: 15 }, 'authorial');
    pushIfValid('50/20/15/15 Тело + хвост', 'body_tail', { body: 50, support: 20, rounder: 15, accent: 15 }, 'body');
    pushIfValid('35/35/20/10 Две опоры', 'dual_support', { body: 35, support: 35, rounder: 20, accent: 10 }, 'dual');
    pushIfValid('50/25/15/10 Коммерческий clean', 'commercial_clean', { body: 50, support: 25, rounder: 15, accent: 10 }, 'commercial');
    pushIfValid('40/25/20/15 Фреш-архитектура', 'fresh_arch', { body: 40, support: 25, accent: 20, cooler: 15 }, 'fresh');
    pushIfValid('45/30/15/10 Десертный округлитель', 'dessert_round', { body: 45, support: 30, rounder: 15, accent: 10 }, 'soft');
    pushIfValid('35/30/20/15 Контрастный хвост', 'contrast_tail', { body: 35, support: 30, accent: 20, cooler: 15 }, 'contrast');
  }

  if (count === 5) {
    pushIfValid('35/20/15/15/15 Signature contrast', 'signature_contrast', { body: 35, support: 20, support2: 15, accent: 15, cooler: 15 }, 'signature');
    pushIfValid('40/20/15/15/10 Signature commercial', 'signature_commercial', { body: 40, support: 20, support2: 15, rounder: 15, accent: 10 }, 'commercial');
    pushIfValid('30/25/20/15/10 Multi-layer', 'multi_layer', { body: 30, support: 25, support2: 20, rounder: 15, accent: 10 }, 'layered');
    pushIfValid('45/20/15/10/10 Body first', 'body_first', { body: 45, support: 20, support2: 15, accent: 10, cooler: 10 }, 'body');
    pushIfValid('35/25/15/15/10 Smooth signature', 'smooth_signature', { body: 35, support: 25, support2: 15, rounder: 15, accent: 10 }, 'soft');
    pushIfValid('42/18/15/15/10 Commercial prime', 'commercial_clean', { body: 42, support: 18, support2: 15, rounder: 15, accent: 10 }, 'commercial');
    pushIfValid('33/22/15/15/15 Cool bloom', 'cool_bloom', { body: 33, support: 22, support2: 15, accent: 15, cooler: 15 }, 'fresh');
  }

  if (conceptMode === 'commercial' || conceptMode === 'commercial_clean') {
    pushIfValid('Коммерческая читаемость', 'commercial_clean', count === 5 ? { body: 42, support: 18, support2: 15, rounder: 15, accent: 10 } : count === 4 ? { body: 50, support: 25, rounder: 15, accent: 10 } : count === 3 ? { body: 55, support: 25, accent: 20 } : { body: 62, support: 38 }, 'commercial');
  }
  if (conceptMode === 'soft_bridge' || conceptMode === 'smooth_signature') {
    pushIfValid('Мягкая посадка', 'soft_creamy', count === 5 ? { body: 36, support: 24, support2: 15, rounder: 15, accent: 10 } : count === 4 ? { body: 46, support: 29, rounder: 15, accent: 10 } : { body: 52, support: 33, rounder: 15 }, 'soft');
  }
  if (conceptMode === 'fresh_arch' || conceptMode === 'contrast' || conceptMode === 'cool_bloom') {
    if (coolingLevel !== 'none' || availableRoles.has('cooler')) {
      pushIfValid('Воздушный фреш', 'fresh_arch', count === 5 ? { body: 33, support: 22, support2: 15, accent: 15, cooler: 15 } : count === 4 ? { body: 40, support: 25, accent: 20, cooler: 15 } : { body: 45, support: 35, cooler: 20 }, 'fresh');
    }
  }

  const families = [...baseFamilies, ...extra].map(f => this.resolveFamilyForRoles(f, availableRoles, count, coolingLevel)).filter(Boolean);
  const uniq = [];
  const seen = new Set();
  families.forEach(f => {
    const key = JSON.stringify(f.roles) + '|' + f.mode;
    if (!seen.has(key)) {
      seen.add(key);
      uniq.push(f);
    }
  });
  return uniq;
},

  resolveFamilyForRoles(family, availableRoles, count, coolingLevel) {
    const cloned = JSON.parse(JSON.stringify(family));
    const rolePriority = ['body','support','support2','rounder','accent','cooler'];

    Object.keys(cloned.roles).forEach(role => {
      if ((role === 'rounder' || role === 'cooler' || role === 'support2') && !availableRoles.has(role === 'support2' ? 'support' : role)) {
        const percent = cloned.roles[role];
        delete cloned.roles[role];
        if (role === 'cooler') cloned.roles.accent = (cloned.roles.accent || 0) + percent;
        else if (role === 'rounder') cloned.roles.support = (cloned.roles.support || 0) + percent;
        else cloned.roles.support = (cloned.roles.support || 0) + percent;
      }
    });

    if (coolingLevel === 'none' && cloned.roles.cooler != null) {
      cloned.roles.accent = (cloned.roles.accent || 0) + cloned.roles.cooler;
      delete cloned.roles.cooler;
    }

    if (!cloned.roles.body) cloned.roles.body = 50;
    if (!cloned.roles.support && count >= 2) cloned.roles.support = Math.max(20, 100 - cloned.roles.body - (cloned.roles.accent || 0) - (cloned.roles.rounder || 0) - (cloned.roles.cooler || 0));

    const total = Object.values(cloned.roles).reduce((s,v)=>s+v,0);
    if (total <= 0) return null;
    const normalized = {};
    let acc = 0;
    const keys = Object.keys(cloned.roles).filter(k => cloned.roles[k] > 0).sort((a,b) => rolePriority.indexOf(a) - rolePriority.indexOf(b));
    keys.forEach((key, idx) => {
      let val = idx === keys.length - 1 ? 100 - acc : Math.max(0, Math.round(cloned.roles[key] / total * 100));
      acc += val;
      normalized[key] = val;
    });
    cloned.roles = normalized;
    return cloned;
  },

  buildAlternativeFamily(roleMap, count, mode, coolingLevel) {
    const families = this.buildConceptFamilies(roleMap, count, 'balanced', coolingLevel);
    return families.find(f => f.mode === mode) || families[0] || { name:'base', roles:{body:60, support:25, accent:15}, mode:'base' };
  },

buildVariant(flavors, roleMap, family, style, coolingLevel, variantMode='base') {
  const byRole = {};
  flavors.forEach(f => {
    const role = roleMap.get(f.id) || 'accent';
    if (!byRole[role]) byRole[role] = [];
    byRole[role].push(f);
  });

  const items = [];
  const rolesOrder = ['body','support','support2','rounder','accent','cooler'];
  rolesOrder.forEach(role => {
    const group = byRole[role];
    if (!group || !group.length) return;
    let totalPercent = family.roles[role] != null ? family.roles[role] : role === 'support2' ? 0 : null;
    if (totalPercent == null) {
      if (role === 'accent') totalPercent = 15;
      else if (role === 'rounder') totalPercent = 15;
      else if (role === 'cooler') totalPercent = coolingLevel === 'strong' ? 12 : 8;
      else if (role === 'support') totalPercent = 25;
      else totalPercent = 50;
    }

    if (group.length === 1) {
      items.push({ ...group[0], role: role === 'support2' ? 'support' : role, percent: totalPercent });
      return;
    }

    const weights = group.map(f => {
      if (role === 'support' || role === 'support2') return Math.max(1, f.analysis.roleSuit.support + f.analysis.backgroundability * 0.25 + f.analysis.versatility * 0.15);
      if (role === 'accent') return Math.max(1, f.analysis.roleSuit.accent + f.analysis.brightness * 0.20 + f.analysis.loudness * 0.10);
      if (role === 'rounder') return Math.max(1, f.analysis.roleSuit.rounder + f.analysis.density * 0.25 + f.analysis.creaminess * 0.12);
      if (role === 'cooler') return Math.max(1, f.analysis.roleSuit.cooler + f.analysis.traits.cooling * 0.25 + f.analysis.traits.freshness * 0.12);
      return Math.max(1, f.analysis.roleSuit.body + f.analysis.density * 0.25 + f.analysis.persistence * 0.12);
    });
    const sum = weights.reduce((a,b)=>a+b,0);
    let allocated = 0;
    group.forEach((f, idx) => {
      const pct = idx === group.length - 1 ? totalPercent - allocated : Math.max(1, Math.round(totalPercent * (weights[idx] / sum)));
      allocated += pct;
      items.push({ ...f, role: role === 'support2' ? 'support' : role, percent: pct });
    });
  });

  if (!items.length) return null;
  const biasedItems = this.applyConceptBias(items, variantMode, style, coolingLevel);
  const total = biasedItems.reduce((s,i)=>s+i.percent,0);
  if (total !== 100) biasedItems[0].percent += 100 - total;

  const evaluated = this.evaluateMix(biasedItems, style, variantMode, coolingLevel);
  evaluated.mixConcept = family.name || evaluated.styleVariant || 'Вариант';
  evaluated.ratioName = family.name || '';
  evaluated.familyRoles = family.roles || {};
  return evaluated;
},



getConceptPriority(style, count, coolingLevel) {
  const base = ['base','commercial_clean','body_forward','layered','contrast','soft_bridge'];
  const byStyle = {
    fresh:['fresh_arch','contrast','cool_bloom','body_forward','base'],
    fruity:['commercial_clean','body_forward','layered','contrast','base'],
    berry:['accent_forward','contrast','commercial_clean','base'],
    citrus:['sour_focus','contrast','fresh_arch','body_forward','base'],
    dessert:['dessert_round','soft_creamy','commercial_clean','body_first','base'],
    tea:['contrast','commercial_clean','soft_bridge','base'],
    spicy:['contrast_tail','body_first','soft_bridge','base'],
    balanced:['commercial_clean','layered','body_forward','soft_bridge','base'],
    authorial:['authorial','multi_layer','signature_contrast','smooth_signature','base']
  };
  const list = byStyle[style] || base;
  const out = [...list];
  if (count >= 4 && !out.includes('layered')) out.push('layered');
  if (count >= 5 && !out.includes('multi_layer')) out.push('multi_layer');
  if (coolingLevel !== 'none' && !out.includes('fresh_arch')) out.push('fresh_arch');
  if (!out.includes('commercial_clean')) out.push('commercial_clean');
  if (!out.includes('base')) out.push('base');
  return Array.from(new Set(out));
},

applyConceptBias(items, variantMode, style, coolingLevel) {
  const biasMap = {
    body_forward:{ body: 8, support: -3, accent: -3, rounder: -1, cooler: -1 },
    commercial_clean:{ body: 5, support: 1, accent: -2, rounder: 0, cooler: -2 },
    accent_forward:{ body: -4, support: -1, accent: 6, rounder: -1, cooler: 0 },
    soft_bridge:{ body: -1, support: 2, accent: -3, rounder: 4, cooler: -2 },
    soft_creamy:{ body: 0, support: 1, accent: -3, rounder: 5, cooler: -3 },
    dessert_round:{ body: 1, support: 1, accent: -2, rounder: 4, cooler: -4 },
    contrast:{ body: -1, support: -1, accent: 4, rounder: -1, cooler: 0 },
    contrast_tail:{ body: -2, support: 0, accent: 4, rounder: -2, cooler: 0 },
    fresh_arch:{ body: -2, support: 0, accent: 2, rounder: -2, cooler: 4 },
    cool_bloom:{ body: -3, support: -1, accent: 2, rounder: -2, cooler: 5 },
    multi_layer:{ body: -3, support: 1, accent: 1, rounder: 1, cooler: 0 },
    signature_contrast:{ body: -2, support: 0, accent: 3, rounder: -1, cooler: 1 },
    signature_commercial:{ body: 2, support: 1, accent: -1, rounder: 1, cooler: -1 },
    smooth_signature:{ body: 0, support: 1, accent: -2, rounder: 3, cooler: -1 },
    sour_focus:{ body: -1, support: 1, accent: 3, rounder: -3, cooler: 0 },
    base:{}
  };
  const roleBias = biasMap[variantMode] || {};
  const cloned = items.map(item => ({ ...item, percent: item.percent + (roleBias[item.role] || 0) }));

  if (style === 'dessert' && coolingLevel === 'none') {
    cloned.forEach(item => { if (item.role === 'cooler') item.percent = Math.max(0, item.percent - 4); });
  }
  if ((style === 'fresh' || style === 'citrus') && coolingLevel !== 'none') {
    cloned.forEach(item => {
      if (item.role === 'cooler') item.percent += 1;
      if (item.role === 'rounder') item.percent -= 1;
    });
  }

  cloned.forEach(item => item.percent = Math.max(1, item.percent));
  const total = cloned.reduce((s, i) => s + i.percent, 0);
  let acc = 0;
  cloned.forEach((item, idx) => {
    item.percent = idx === cloned.length - 1 ? 100 - acc : Math.max(1, Math.round(item.percent / total * 100));
    acc += item.percent;
  });
  if (acc !== 100) cloned[0].percent += 100 - acc;
  return cloned;
},

calcTargetFit(vector, style, variantMode) {
  const target = this.styleTargets[style] || this.styleTargets.universal;
  let fit = 10;
  fit -= Math.abs(vector.freshness - target.freshness) * 0.8;
  fit -= Math.abs(vector.sweetness - target.sweetness) * 0.7;
  fit -= Math.abs(vector.acidity - target.acidity) * 0.7;
  fit -= Math.abs(vector.creaminess - target.creaminess) * 0.6;
  fit -= Math.abs(vector.depth - target.depth) * 0.5;
  fit -= Math.abs(vector.brightness - target.brightness) * 0.5;
  if (variantMode === 'commercial_clean' && vector.cooling > 5) fit -= 1.5;
  if (variantMode === 'sour_focus' && vector.acidity < 4.5) fit -= 2;
  if ((variantMode === 'dessert_round' || variantMode === 'soft_creamy') && vector.creaminess < 3.5) fit -= 2;
  return this.clampInt(Math.round(fit), 0, 10);
},

calcCommercialClarity(items, body, vector) {
  let score = 5;
  if (items.length >= 5) score -= 1;
  if (items.filter(i => i.analysis.loudness >= 8).length >= 3) score -= 1;
  if (body && body.percent < 38) score -= 1;
  if (vector.floral > 5 && vector.woody > 4) score -= 1;
  if (vector.cooling > 6 && vector.creaminess > 4) score -= 1;
  return this.clampInt(score, 0, 5);
},

auditMixErrors(items, body, vector, pairwise) {
  const issues = [];
  const dominants = items.filter(i => i.analysis.loudness >= 8 && i.percent >= 18);
  if (dominants.length >= 3) issues.push({ level:'high', penalty:6, text:'Слишком много доминирующих вкусов в заметной доле.' });
  if (items.filter(i => i.role === 'accent' && i.percent >= 18).length >= 2) issues.push({ level:'high', penalty:5, text:'Слишком много активных акцентов: микс может стать грязным.' });
  if (body && body.analysis.roleSuit.body < 5) issues.push({ level:'high', penalty:5, text:'Тело выбрано неудачно: базовый вкус слаб для роли центра.' });
  if (!body) issues.push({ level:'high', penalty:7, text:'Нет внятной базы: микс собран без читаемого центра.' });
  if (vector.cooling > 6.3) issues.push({ level:'medium', penalty:3, text:'Слишком много холода: он может разрушить композицию.' });
  if (vector.creaminess > 5.5 && vector.acidity > 6.2) issues.push({ level:'medium', penalty:3, text:'Конфликт резкой кислотности и плотной сливочности.' });
  if (vector.candy > 5 && vector.woody > 5) issues.push({ level:'medium', penalty:3, text:'Конфетный и древесно-табачный профиль могут спорить.' });
  if (pairwise.filter(p => p.conflict >= 3).length >= 2) issues.push({ level:'high', penalty:5, text:'Внутри микса сразу несколько конфликтных пар.' });
  if (items.length >= 5 && pairwise.filter(p => p.score < 0).length >= 3) issues.push({ level:'medium', penalty:3, text:'Перегруженный многокомпонентный микс теряет читаемость.' });
  if (items.filter(i => i.analysis.heaviness >= 7).length >= 3) issues.push({ level:'medium', penalty:2, text:'Слишком много тяжелых вкусов: возможна липкая плотность и усталость профиля.' });
  return issues;
},

inferSmokingScenario(items, style, vector) {
  if (style === 'dessert' || vector.creaminess >= 5.5) return 'Лучше работает как вечерний, спокойный и более мягкий сценарий курения.';
  if (style === 'fresh' || vector.freshness >= 5 || vector.cooling >= 4.5) return 'Лучше раскрывается как бодрый, дневной и освежающий сценарий курения.';
  if (style === 'authorial' || items.length >= 5) return 'Это вариант для более опытного курильщика: требует аккуратного жара и спокойного прогрева.';
  return 'Это универсальный сценарий курения: понятный профиль и предсказуемое раскрытие.';
},
  pairCategoryScore(catA, catB) {
    const pair = [catA, catB].sort().join('|');
    const map = {
      'berry|fruit': 8,
      'berry|citrus': 7,
      'citrus|fruit': 7,
      'creamy|dessert': 9,
      'creamy|fruit': 6,
      'dessert|spicy': 7,
      'dessert|fruit': 6,
      'cooling|fruit': 5,
      'cooling|berry': 6,
      'tea|citrus': 7,
      'tea|berry': 6,
      'tea|fruit': 5,
      'beverage|berry': 5,
      'beverage|citrus': 5,
      'spicy|fruit': 4,
      'floral|berry': 4,
      'floral|fruit': 3,
      'woody|spicy': 5,
      'woody|dessert': 4
    };
    const bad = {
      'cooling|dessert': -2,
      'citrus|dessert': -2,
      'floral|woody': -5,
      'floral|dessert': -2,
      'floral|cooling': -4,
      'spicy|cooling': -4,
      'woody|citrus': -3
    };
    return (map[pair] || 0) + (bad[pair] || 0);
  },

evaluateMix(items, style, variantMode, coolingLevel = 'none') {
  const body = items.find(x => x.role === 'body') || [...items].sort((a,b)=>b.percent-a.percent)[0];
  const supports = items.filter(x => x.role === 'support');
  const accents = items.filter(x => x.role === 'accent');
  const rounders = items.filter(x => x.role === 'rounder');
  const coolers = items.filter(x => x.role === 'cooler');

  const vector = this.mixVector(items);
  const pairwise = [];
  for (let i=0;i<items.length;i++) {
    for (let j=i+1;j<items.length;j++) {
      pairwise.push(this.scorePair(items[i], items[j]));
    }
  }

  const sensoryCompatibility = this.calcSensoryCompatibility(items, pairwise);
  const roleLogic = this.calcRoleLogic(items, body, supports, accents, rounders, coolers);
  const bodyQuality = this.calcBodyQuality(body, vector, items);
  const percentageBalance = this.calcPercentageBalance(items);
  const suppressionRiskControl = this.calcSuppressionRisk(items);
  const cohesionAndReadability = this.calcCohesion(items, pairwise, vector);
  let practicalUsability = this.calcPracticalUsability(items, body, style, vector);

  const targetFit = this.calcTargetFit(vector, style, variantMode);
  const commercialClarity = this.calcCommercialClarity(items, body, vector);
  practicalUsability = this.clampInt(practicalUsability + Math.round(targetFit * 0.3) + Math.round(commercialClarity * 0.2), 0, 5);

  const antiErrorAudit = this.auditMixErrors(items, body, vector, pairwise);
  const antiErrorPenalty = antiErrorAudit.reduce((sum, issue) => sum + issue.penalty, 0);

  let compatibilityScore = sensoryCompatibility + roleLogic + bodyQuality + percentageBalance + suppressionRiskControl + cohesionAndReadability + practicalUsability;
  compatibilityScore = this.clampInt(compatibilityScore - antiErrorPenalty, 0, 100);

  const risks = this.detectRisks(items, body, vector).concat(
    antiErrorAudit.filter(issue => issue.level !== 'low').map(issue => ({ level: issue.level, text: issue.text }))
  );
  const dedupRisks = [];
  const seenRiskText = new Set();
  risks.forEach(r => {
    if (!seenRiskText.has(r.text)) {
      seenRiskText.add(r.text);
      dedupRisks.push(r);
    }
  });

  const actions = this.buildImprovementActions(items, body, vector, dedupRisks);
  const label = this.compatibilityLabel(compatibilityScore);

  const whyWorks = this.buildWhyWorks(items, body, vector, dedupRisks, variantMode);
  const shortVerdict = this.buildShortVerdict(compatibilityScore, body, dedupRisks, style);
  const styleLabelMap = {
    base:'Базовая версия',
    fresher:'Более свежий',
    sweeter:'Более сладкий',
    softer:'Более мягкий',
    fuller:'Более объемный',
    body_forward:'Четкое тело',
    dual_body:'Двойная база',
    accent_forward:'Яркий акцент',
    soft_bridge:'С мягкой связкой',
    contrast:'Контрастный',
    layered:'Слоистый',
    authorial:'Авторский',
    body_tail:'Тело + хвост',
    dual_support:'Две опоры',
    fresh_arch:'Свежая архитектура',
    clear_body:'Ясная база',
    accent_arc:'Акцент сверху',
    signature_contrast:'Сигнатурный контраст',
    signature_commercial:'Сигнатурный коммерческий',
    multi_layer:'Многослойный',
    deep_layer:'Глубокий многоуровневый',
    commercial_lead:'Коммерческий лидер',
    body_first:'Тело впереди',
    smooth_signature:'Мягкий signature',
    commercial:'Коммерческий',
    duo_balance:'Равновесный дуэт',
    commercial_clean:'Чистый коммерческий',
    sour_focus:'Кислая дуга',
    dessert_round:'Десертное округление',
    contrast_tail:'Контрастный хвост',
    cool_bloom:'Холодный bloom',
    soft_creamy:'Мягкая посадка'
  };

  return {
    id: Date.now() + Math.floor(Math.random()*100000),
    title: this.buildMixName(items, style, variantMode),
    styleVariant: styleLabelMap[variantMode] || 'Вариант',
    items,
    bodyName: body.name,
    profileText: this.profileText(vector),
    conceptComment: this.describeConcept(items, variantMode) + ' ' + this.inferSmokingScenario(items, style, vector),
    overallVerdict: shortVerdict,
    whyWorks,
    compatibilityScore,
    compatibilityLabel: label,
    scoreBreakdown: {
      sensoryCompatibility,
      roleLogic,
      bodyQuality,
      percentageBalance,
      suppressionRiskControl,
      cohesionAndReadability,
      practicalUsability,
      total: compatibilityScore
    },
    architecture: {
      hasClearBody: !!body,
      suggestedBody: body.name,
      bodyIsCorrect: body.analysis.roleSuit.body >= 5 && body.role === 'body',
      mainSupport: supports.map(x => x.name),
      accents: accents.map(x => x.name),
      rounders: rounders.map(x => x.name),
      coolers: coolers.map(x => x.name),
      roleConflicts: this.detectRoleConflicts(items, body),
      antiErrorAudit
    },
    coolingRecommendation: this.buildCoolingRecommendation(items, coolingLevel, style, vector),
    sensoryBalance: {
      sweetness: this.bucket(vector.sweetness),
      acidity: this.bucket(vector.acidity),
      freshness: this.bucket(vector.freshness),
      cooling: this.bucket(vector.cooling, true),
      density: this.bucket((vector.depth + vector.creaminess + vector.sweetness)/3),
      creaminess: this.bucket(vector.creaminess),
      dryness: this.bucket(vector.dryness),
      brightness: this.bucket(vector.brightness),
      depth: this.bucket(vector.depth)
    },
    risks: dedupRisks,
    actions,
    json: this.toJsonLike(items, body, vector, compatibilityScore, label, shortVerdict, dedupRisks, actions, style)
  };
},

  mixVector(items) {
    const v = {
      sweetness:0, acidity:0, freshness:0, cooling:0, creaminess:0, dryness:0, brightness:0, depth:0,
      floral:0, spicy:0, citrus:0, berry:0, tropical:0, green:0, juicy:0, candy:0, tea:0, woody:0
    };
    items.forEach(item => {
      const w = item.percent / 100;
      const t = item.analysis.traits;
      Object.keys(v).forEach(k => {
        v[k] += (t[k] || 0) * w;
      });
    });
    return v;
  },

  bucket(v, cooling=false) {
    if (cooling) {
      if (v < 1.2) return 'нет';
      if (v < 3.2) return 'легкий';
      if (v < 5.8) return 'средний';
      return 'сильный';
    }
    if (v < 3) return 'низкий';
    if (v < 6) return 'средний';
    return 'высокий';
  },

  scorePair(a, b) {
    const catScore = this.pairCategoryScore(a.analysis.category, b.analysis.category);
    const tA = a.analysis.traits;
    const tB = b.analysis.traits;

    const shared = ['berry','citrus','tropical','green','tea','woody'].reduce((s, key) => s + Math.min(tA[key]||0, tB[key]||0), 0) / 10;
    const contrastGood =
      (Math.abs(tA.acidity - tB.sweetness) < 4 ? 1 : 0) +
      (Math.abs(tA.creaminess - tB.acidity) > 3 ? 1 : 0) +
      (Math.abs(tA.depth - tB.brightness) > 2 ? 1 : 0);
    const conflict =
      ((tA.cooling >= 7 && tB.spicy >= 6) || (tB.cooling >= 7 && tA.spicy >= 6) ? 3 : 0) +
      ((tA.floral >= 7 && tB.woody >= 6) || (tB.floral >= 7 && tA.woody >= 6) ? 3 : 0) +
      ((tA.cooling >= 7 && tB.creaminess >= 7) || (tB.cooling >= 7 && tA.creaminess >= 7) ? 1 : 0);

    return { score: catScore + shared + contrastGood - conflict, shared, conflict };
  },

  calcSensoryCompatibility(items, pairwise) {
    let score = 12;
    score += pairwise.reduce((s,p)=>s+p.score,0) / Math.max(1, pairwise.length);
    const loudHigh = items.filter(i => i.analysis.loudness >= 8).length;
    if (loudHigh >= 3) score -= 3;
    if (items.length >= 5) score -= 2;
    return this.clampInt(score, 0, 25);
  },

  calcRoleLogic(items, body, supports, accents, rounders, coolers) {
    let score = 0;
    if (body) score += 7;
    if (body && body.analysis.roleSuit.body >= 6) score += 4;
    if (supports.length) score += 4;
    if (accents.length <= 1 || items.length <= 3) score += 2;
    if (rounders.length <= 1) score += 1;
    if (coolers.length <= 1) score += 1;
    const conflictingDominants = items.filter(i => i.percent >= 25 && i.analysis.roleSuit.body <= 4 && (i.analysis.roleSuit.accent >= 7 || i.analysis.roleSuit.cooler >= 7)).length;
    score -= conflictingDominants * 2;
    return this.clampInt(score, 0, 20);
  },

  calcBodyQuality(body, vector, items) {
    let score = 0;
    if (!body) return 0;
    score += body.analysis.roleSuit.body >= 7 ? 7 : body.analysis.roleSuit.body >= 5 ? 5 : 2;
    if (body.percent >= 40 && body.percent <= 65) score += 4;
    else if (body.percent >= 35) score += 2;
    if (vector.depth + vector.creaminess + vector.juicy >= 10) score += 2;
    if (body.analysis.traits.cooling >= 7 || body.analysis.traits.floral >= 7 || body.analysis.traits.spicy >= 7) score -= 3;
    if (items.length === 2 && body.percent >= 55) score += 2;
    return this.clampInt(score, 0, 15);
  },

  calcPercentageBalance(items) {
    let score = 15;
    items.forEach(item => {
      if (item.role === 'body' && (item.percent < 35 || item.percent > 70)) score -= 3;
      if (item.role === 'support' && (item.percent < 15 || item.percent > 40)) score -= 2;
      if (item.role === 'accent' && item.percent > 20) score -= 3;
      if (item.role === 'cooler' && item.percent > 15) score -= 4;
      if (item.analysis.loudness >= 8 && item.percent > 25 && item.role !== 'body') score -= 2;
      if (item.analysis.suppressionRisk >= 8 && item.percent > 20 && item.role !== 'body') score -= 2;
    });
    return this.clampInt(score, 0, 15);
  },

  calcSuppressionRisk(items) {
    let score = 10;
    const risky = items.filter(i => i.analysis.suppressionRisk >= 7 && i.percent >= 15).length;
    const ultra = items.filter(i => i.analysis.suppressionRisk >= 8 && i.percent >= 20).length;
    score -= risky * 2;
    score -= ultra * 2;
    return this.clampInt(score, 0, 10);
  },

  calcCohesion(items, pairwise, vector) {
    let score = 5;
    const positivePairs = pairwise.filter(p => p.score > 3).length;
    const badPairs = pairwise.filter(p => p.score < -1).length;
    score += Math.min(4, positivePairs);
    score -= Math.min(4, badPairs);
    const hasBridge = items.some(i => i.role === 'rounder' || i.role === 'support');
    if (hasBridge) score += 1;
    if (vector.citrus >= 5 && vector.creaminess >= 5 && !items.some(i => i.role === 'rounder')) score -= 1;
    return this.clampInt(score, 0, 10);
  },

  calcPracticalUsability(items, body, style, vector) {
    let score = 3;
    if (items.length <= 4) score += 1;
    if (body && body.percent >= 40) score += 1;
    if (style === 'dessert' && vector.cooling > 4) score -= 1;
    if (style === 'fresh' && vector.cooling < 1 && vector.freshness < 4) score -= 1;
    return this.clampInt(score, 0, 5);
  },

  detectRoleConflicts(items, body) {
    const conflicts = [];
    const strongNonBody = items.filter(i => i !== body && i.percent >= 25 && (i.analysis.roleSuit.accent >= 7 || i.analysis.roleSuit.cooler >= 7));
    if (strongNonBody.length) conflicts.push('Есть вкус, который слишком громкий для второстепенной роли');
    const multipleBodies = items.filter(i => i.analysis.roleSuit.body >= 7 && i !== body).length;
    if (multipleBodies >= 1) conflicts.push('Есть второй сильный кандидат на тело микса');
    return conflicts;
  },

  detectRisks(items, body, vector) {
    const risks = [];
    const cooler = items.filter(i => i.role === 'cooler');
    const desserts = items.filter(i => i.analysis.category === 'dessert' || i.analysis.category === 'creamy' || i.analysis.traits.creaminess >= 6);
    const florals = items.filter(i => i.analysis.traits.floral >= 7);
    const loud = items.filter(i => i.analysis.loudness >= 8);
    const badBody = body && (body.analysis.traits.cooling >= 7 || body.analysis.traits.floral >= 7);

    if (items.length >= 5) risks.push({ level:'medium', text:'Микс перегружен количеством вкусов. Риск потери читаемости.' });
    if (cooler.some(c => c.percent > 12) || vector.cooling > 5.5) risks.push({ level:'high', text:'Перегруз холодом: свежесть может разрушить тело микса.' });
    if (desserts.length >= 3 || (vector.creaminess > 6 && vector.depth > 5)) risks.push({ level:'medium', text:'Перегруз десертностью: микс может стать тяжелым и липким.' });
    if (badBody) risks.push({ level:'high', text:'В тело микса попал вкус, который больше подходит для акцента или холода.' });
    if (loud.length >= 3) risks.push({ level:'medium', text:'Слишком много громких вкусов — вероятна грязь и взаимное подавление.' });
    if (florals.length && items.some(i => i.analysis.category === 'woody' || i.analysis.traits.woody >= 6)) risks.push({ level:'high', text:'Цветочный и древесный/табачный профиль могут конфликтовать.' });
    if (body && body.percent < 35) risks.push({ level:'medium', text:'Слабое тело микса: база может не читаться достаточно ясно.' });
    if (vector.acidity > 6 && vector.creaminess < 1 && vector.sweetness < 4) risks.push({ level:'medium', text:'Профиль может быть слишком резким и сухим.' });
    if (!risks.length) risks.push({ level:'low', text:'Критичных рисков не обнаружено. Нужен только контроль прогрева и забивки.' });
    return risks;
  },

  buildImprovementActions(items, body, vector, risks) {
    const actions = [];
    if (risks.some(r => r.text.includes('Перегруз холодом'))) actions.push('Снизить охладитель до 5–10% и вернуть телу больше пространства.');
    if (risks.some(r => r.text.includes('Слабое тело'))) actions.push('Поднять базовый вкус до 45–60% или выбрать более плотную базу.');
    if (risks.some(r => r.text.includes('десертностью'))) actions.push('Убрать одну тяжелую десертную ноту или добавить более сухую / ягодную поддержку.');
    if (risks.some(r => r.text.includes('громких вкусов'))) actions.push('Оставить один явный центр, второй громкий вкус перевести в акцент 10–15%.');
    if (risks.some(r => r.text.includes('Цветочный'))) actions.push('Нужен связующий элемент: мягкий фрукт, чай или сливочный буфер.');
    if (vector.acidity > 6 && vector.creaminess < 2) actions.push('Для смягчения резкости добавить округлитель: груша, ваниль, сливочность, йогурт.');
    if (!actions.length) actions.push('Оставить структуру как есть, контролируя жар и плотность забивки.');
    return actions;
  },

  buildWhyWorks(items, body, vector, risks, variantMode = 'base') {
    const supports = items.filter(i => i.role === 'support').map(i => i.name);
    const accents = items.filter(i => i.role === 'accent').map(i => i.name);
    const rounders = items.filter(i => i.role === 'rounder').map(i => i.name);
    const coolers = items.filter(i => i.role === 'cooler').map(i => i.name);

    let text = `Центр микса — "${body.name}". `;
    if (supports.length) text += `Поддержка (${supports.join(', ')}) расширяет тело и помогает вкусу читаться объемнее. `;
    if (accents.length) text += `Акцент (${accents.join(', ')}) добавляет верхнюю ноту и делает профиль живее. `;
    if (rounders.length) text += `Округлитель (${rounders.join(', ')}) сглаживает резкость и делает вкус цельнее. `;
    if (coolers.length) text += `Охладитель (${coolers.join(', ')}) добавляет свежесть, но не должен выходить вперед. `;
    text += `Итоговый профиль: ${this.profileText(vector)}. `;
    text += this.describeConcept(items, variantMode) + ' ';
    if (risks.some(r => r.level === 'high')) text += 'Есть риски, поэтому этот вариант требует аккуратной процентовки.';
    return text.trim();
  },

  buildShortVerdict(score, body, risks, style) {
    const high = risks.filter(r => r.level === 'high').length;
    if (score >= 95) return `Почти эталонный микс: тело "${body.name}" выбрано очень удачно, структура чистая и профессиональная.`;
    if (score >= 90) return `Очень сильный микс: база "${body.name}" читабельна, роли распределены грамотно.`;
    if (score >= 80) return `Хороший рабочий микс: идея понятная, тело "${body.name}" держит композицию.`;
    if (score >= 70) return `Условно хороший микс: логика есть, но нужна точная процентовка и контроль сильных нот.`;
    if (score >= 60) return `Спорный микс: часть логики работает, но есть заметные слабые места в теле или ролях.`;
    return `Проблемный микс: высокий риск конфликта профилей, слабой базы или перегруза акцентами.`;
  },

  compatibilityLabel(score) {
    if (score >= 95) return 'super_compatible';
    if (score >= 90) return 'very_strong';
    if (score >= 80) return 'strong';
    if (score >= 70) return 'decent';
    if (score >= 60) return 'weak_to_moderate';
    if (score >= 40) return 'problematic';
    if (score >= 20) return 'poor';
    return 'incompatible';
  },

  labelToRu(label) {
    const map = {
      super_compatible:'Супер совместимо',
      very_strong:'Очень сильно',
      strong:'Хорошо',
      decent:'Условно хорошо',
      weak_to_moderate:'Слабо / спорно',
      problematic:'Проблемно',
      poor:'Плохо',
      incompatible:'Несовместимо'
    };
    return map[label] || label;
  },

  scoreClass(score) {
    if (score >= 90) return 'score-excellent';
    if (score >= 80) return 'score-good';
    if (score >= 65) return 'score-mid';
    return 'score-bad';
  },

  profileText(vector) {
    const labels = {
      sweetness:'сладкий', acidity:'кислый', freshness:'свежий', cooling:'холодный', creaminess:'сливочный',
      dryness:'сухой', brightness:'яркий', depth:'глубокий', floral:'цветочный', spicy:'пряный',
      citrus:'цитрусовый', berry:'ягодный', tropical:'тропический', green:'зеленый', juicy:'сочный',
      tea:'чайный', woody:'табачно-древесный'
    };
    return Object.entries(vector).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k]) => labels[k]).join(', ');
  },

  buildMixName(items, style, mode) {
    const body = items.find(i => i.role === 'body') || items[0];
    const styleAdjectives = {
      universal:['Собранный','Гармоничный','Чистый'],
      fresh:['Ледяной','Свежий','Бодрящий'],
      fruity:['Сочный','Фруктовый','Яркий'],
      berry:['Ягодный','Сочный','Взрывной'],
      citrus:['Цитрусовый','Звонкий','Кисло-свежий'],
      dessert:['Мягкий','Десертный','Сливочный'],
      tea:['Чайный','Сухой','Элегантный'],
      spicy:['Теплый','Пряный','Глубокий'],
      balanced:['Сбалансированный','Ровный','Точный'],
      authorial:['Авторский','Сложный','Многослойный']
    };
    const modeWord = {
      fresher:'Фреш',
      sweeter:'Свич',
      softer:'Soft',
      fuller:'Full',
      base:'Core',
      body_forward:'Body',
      dual_body:'Dual',
      accent_forward:'Accent',
      soft_bridge:'Bridge',
      contrast:'Contrast',
      layered:'Layered',
      authorial:'Auteur',
      body_tail:'Body+Tail',
      dual_support:'DualFlow',
      fresh_arch:'Fresh',
      signature_contrast:'Signature',
      signature_commercial:'Prime',
      multi_layer:'Multi',
      body_first:'PrimeBody',
      smooth_signature:'Smooth',
      commercial:'Classic',
      duo_balance:'Duo',
      commercial_clean:'Clean',
      sour_focus:'SourArc',
      dessert_round:'Velvet',
      contrast_tail:'Tail',
      cool_bloom:'Bloom',
      soft_creamy:'Creamy'
    };
    const adjectiveArr = styleAdjectives[style] || ['Авторский'];
    const adjective = adjectiveArr[(body.name.length + items.length) % adjectiveArr.length];
    return `${adjective} ${body.name} ${modeWord[mode] || 'Mix'}`;
  },

  describeConcept(items, mode) {
    const map = {
      base:'Базовая логика: один центр, понятная поддержка и контролируемый акцент.',
      fresher:'Та же корзина вкусов, но с большей свежестью и более легким послевкусием.',
      sweeter:'Та же корзина вкусов, но с большей сладостью и округлением.',
      softer:'Версия со смягчением резких нот и более цельным профилем.',
      fuller:'Более плотная и объемная версия тех же вкусов.',
      body_forward:'Та же тройка/четверка вкусов, но тело выведено вперед, а все остальное обслуживает базу.',
      dual_body:'Два вкуса работают как почти равные центры, из-за чего профиль ощущается сложнее.',
      accent_forward:'Те же вкусы, но акцент поднят выше и заметнее влияет на итоговый образ.',
      soft_bridge:'Один из вкусов специально переведен в связку, чтобы сгладить углы и собрать микс.',
      contrast:'Концепция строится на контролируемом контрасте, а не на похожести вкусов.',
      layered:'Слоистая версия: тело, поддержка, связка и верхняя нота читаются по слоям.',
      authorial:'Авторская версия: больше нюансов, выше требования к точной забивке и жару.',
      body_tail:'Сильная база плюс заметный хвост/послевкусие на фоне.',
      dual_support:'Профиль держится не на одном, а на двух опорных вкусах.',
      fresh_arch:'Тот же набор, но архитектура смещена в сторону свежести и воздуха.',
      signature_contrast:'Сигнатурная версия со сложной многослойной логикой и контрастным хвостом.',
      signature_commercial:'Сигнатурная, но коммерчески понятная версия без лишней хаотичности.',
      multi_layer:'Максимально многослойная версия на том же наборе вкусов.',
      body_first:'Вся композиция построена вокруг максимально читаемого тела.',
      smooth_signature:'Сложная, но мягкая версия без резких углов.',
      commercial:'Коммерческий вариант: максимально понятный и читаемый для большинства.',
      duo_balance:'Дуэт, где оба вкуса имеют почти равный вес.',
      commercial_clean:'Чистый коммерческий вариант: один центр, минимум шумных столкновений, понятный вкус.',
      sour_focus:'В этом варианте кислотность и яркость поднимаются выше, но база не должна исчезать.',
      dessert_round:'Концепция строится на мягком округлении и снижении острых углов.',
      contrast_tail:'Контраст удерживается в хвосте и послевкусии, а не только на старте.',
      cool_bloom:'Свежий холодный верх раскрывается сверху, не разрушая тело полностью.',
      soft_creamy:'Мягкая посадка делает тот же набор вкусов комфортнее и коммерчески понятнее.'
    };
    return map[mode] || 'Этот вариант отличается от остальных распределением ролей и процентовок на том же наборе вкусов.';
  },

  toJsonLike(items, body, vector, score, label, verdict, risks, actions, style) {
    return {
      mode: 'local_rule_engine',
      input_summary: {
        target_profile: style,
        requested_flavor_count: items.length
      },
      overall_verdict: {
        short_verdict: verdict,
        is_workable: score >= 60,
        compatibility_score: score,
        compatibility_label: label
      },
      concept: {
        body: body.name,
        profile: this.profileText(vector)
      },
      flavor_analysis: items.map(item => ({
        name: item.name,
        brand: item.brand,
        role: item.role,
        percentage: item.percent,
        category: item.analysis.category,
        loudness: item.analysis.loudness,
        suppression_risk: item.analysis.suppressionRisk,
        density: item.analysis.density,
        heaviness: item.analysis.heaviness,
        naturalness: item.analysis.naturalness,
        versatility: item.analysis.versatility,
        conflict_risk: item.analysis.conflictRisk
      })),
      architecture_analysis: {
        has_clear_body: true,
        suggested_body: body.name,
        body_is_correct: body.role === 'body'
      },
      sensory_balance: {
        sweetness: this.bucket(vector.sweetness),
        acidity: this.bucket(vector.acidity),
        freshness: this.bucket(vector.freshness),
        cooling: this.bucket(vector.cooling, true),
        creaminess: this.bucket(vector.creaminess),
        brightness: this.bucket(vector.brightness),
        depth: this.bucket(vector.depth)
      },
      main_risks: risks.map(r => ({ level: r.level, text: r.text })),
      improvement_actions: actions
    };
  },


  buildCoolingRecommendation(items, coolingLevel, style, vector) {
    const directCooler = items.filter(item => item.role === 'cooler' || item.analysis.category === 'cooling' || item.analysis.traits.cooling >= 6)
      .sort((a,b) => b.percent - a.percent)[0] || null;
    const presets = {
      light: { percent: 5, range: '3–6%', level: 'Легкий холод' },
      medium: { percent: 8, range: '6–10%', level: 'Средний холод' },
      strong: { percent: 12, range: '10–15%', level: 'Яркий холод' }
    };
    if ((!coolingLevel || coolingLevel === 'none') && !directCooler) return null;
    const preset = presets[coolingLevel] || { percent: directCooler ? Math.max(3, Math.min(15, directCooler.percent)) : 6, range: '3–8%', level: 'Холод по вкусу' };
    const examples = [
      { brand:'Must Have', name:'Ice Mint', kind:'mint' },
      { brand:'DarkSide', name:'Supernova', kind:'cooler' },
      { brand:'Sebero', name:'Arctic Mix', kind:'cooler' },
      { brand:'BlackBurn', name:'Ice Baby', kind:'cooler' }
    ];
    let type = 'Чистый холод';
    if (style === 'dessert') type = 'Мягкий холод / мятный штрих';
    if (style === 'fresh' || vector.freshness >= 5) type = 'Освежающий холод';
    if (directCooler && /mint|мят/i.test(directCooler.name)) type = 'Мятное охлаждение';
    const primary = directCooler ? { brand: directCooler.brand, name: directCooler.name } : (style === 'dessert' ? examples[0] : examples[1]);
    const alt = examples.find(x => (x.brand + x.name) !== (primary.brand + primary.name)) || examples[0];
    return {
      enabled: true,
      level: preset.level,
      percent: directCooler ? Math.max(3, Math.min(15, directCooler.percent)) : preset.percent,
      range: preset.range,
      type,
      primaryLabel: primary.brand + ' ' + primary.name,
      alternativeLabel: alt.brand + ' ' + alt.name,
      note: directCooler ? 'Охлаждение уже встроено в итоговый рецепт и показано в составе.' : 'Если в выбранном пуле нет готового кулера, можно добавить внешний охладитель отдельным слоем.'
    };
  },
  renderResults(results, meta) {
    const container = document.getElementById('results-area');
    const summary = `<div class="card">
      <div class="results-toolbar">
        <div>
          <h2>Результаты</h2>
          <p class="muted text-sm">Стиль: <strong>${this.escapeHtml(meta.style)}</strong> • Режим: <strong>${meta.mode === 'manual' ? 'ручной анализ' : 'автогенерация'}</strong> • Холод: <strong>${this.escapeHtml(meta.coolingLevel)}</strong></p>
        </div>
        <div class="badge badge-info">${results.length} результат(а)</div>
      </div>
      <div class="notice">Шкала совместимости: 100% — почти эталон, 0% — практически несовместимо. Шаг оценки — 1%.</div>
    </div>`;

    container.innerHTML = summary + results.map((res, idx) => this.renderResultCard(res, idx)).join('');
  },

  renderResultCard(res, idx) {
    const colorClass = this.scoreClass(res.compatibilityScore);
    const riskHtml = res.risks.map(r => `<div class="risk-item risk-${r.level}">${this.escapeHtml(r.text)}</div>`).join('');
    const actionHtml = res.actions.map(a => `<div class="action-item">${this.escapeHtml(a)}</div>`).join('');
    const bodyColorIndex = (idx * 4) % 8;
    const segColors = ['#6366f1','#ec4899','#10b981','#f59e0b','#0ea5e9','#8b5cf6','#ef4444','#14b8a6'];

    return `
    <div class="card mix-card">
      <div class="mix-topline">
        <div style="flex:1">
          <div class="flex flex-wrap" style="margin-bottom:8px">
            <span class="badge ${res.compatibilityScore>=90 ? 'badge-success' : res.compatibilityScore>=80 ? 'badge-info' : res.compatibilityScore>=70 ? 'badge-warning' : 'badge-danger'}">${this.labelToRu(res.compatibilityLabel)}</span>
            <span class="badge badge-neutral">${res.styleVariant}</span>
            <span class="badge badge-info">${this.escapeHtml(res.mixConcept || 'Концепт')}</span>
            <span class="badge badge-primary">Тело: ${this.escapeHtml(res.bodyName)}</span>
          </div>
          <div class="mix-title">${this.escapeHtml(res.title)}</div>
          <p class="text-sm" style="margin-top:6px">${this.escapeHtml(res.overallVerdict)}</p>
        </div>
        <div class="score-circle ${colorClass}">${res.compatibilityScore}%</div>
      </div>

      <div class="flavor-bar">
        ${res.items.map((item, i) => `<div class="flavor-segment" style="width:${item.percent}%;background:${segColors[(bodyColorIndex+i)%segColors.length]}" title="${this.escapeHtml(item.name)} ${item.percent}%"></div>`).join('')}
      </div>

      <div class="grid grid-2">
        <div class="card" style="padding:14px;margin:0">
          <div class="section-title">Состав и роли</div>
          <div class="flavor-role-list">
            ${res.items.map(item => `
              <div class="flavor-role-card">
                <div class="flex justify-between items-start">
                  <div>
                    <strong>${item.percent}% — ${this.escapeHtml(item.brand)} ${this.escapeHtml(item.name)}</strong>
                    <div class="small-tags">
                      <span class="tag">${this.roleLabels[item.role] || item.role}</span>
                      <span class="tag">${this.labelCategory(item.analysis.category)}</span>
                      <span class="tag">Громкость ${item.analysis.loudness}/10</span>
                      <span class="tag">Подавление ${item.analysis.suppressionRisk}/10</span>
                    </div>
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <div class="card" style="padding:14px;margin:0">
          <div class="section-title">Архитектура микса</div>
          <div class="kv">
            <div class="kv-row"><div>Тело микса</div><div><strong>${this.escapeHtml(res.architecture.suggestedBody)}</strong> ${res.architecture.bodyIsCorrect ? '— выбрано корректно' : '— спорное тело'}</div></div>
            <div class="kv-row"><div>Поддержка</div><div>${res.architecture.mainSupport.length ? this.escapeHtml(res.architecture.mainSupport.join(', ')) : 'нет выраженной поддержки'}</div></div>
            <div class="kv-row"><div>Акцент</div><div>${res.architecture.accents.length ? this.escapeHtml(res.architecture.accents.join(', ')) : 'нет яркого акцента'}</div></div>
            <div class="kv-row"><div>Округлитель</div><div>${res.architecture.rounders.length ? this.escapeHtml(res.architecture.rounders.join(', ')) : 'не нужен / отсутствует'}</div></div>
            <div class="kv-row"><div>Охладитель</div><div>${res.coolingRecommendation ? this.escapeHtml((res.architecture.coolers.length ? res.architecture.coolers.join(', ') : res.coolingRecommendation.primaryLabel) + ' — ' + res.coolingRecommendation.percent + '%') : 'нет'}</div></div>
            <div class="kv-row"><div>Профиль</div><div>${this.escapeHtml(res.profileText)}</div></div>
          </div>
        </div>
      </div>

      ${res.coolingRecommendation ? `
      <div class="card" style="padding:14px;margin-top:14px">
        <div class="section-title">Охлаждение / рекомендация по холоду</div>
        <div class="kv">
          <div class="kv-row"><div>Уровень</div><div><strong>${this.escapeHtml(res.coolingRecommendation.level)}</strong> — ${this.escapeHtml(res.coolingRecommendation.type)}</div></div>
          <div class="kv-row"><div>Сколько добавить</div><div><strong>${res.coolingRecommendation.percent}%</strong> <span class="muted">(рабочий диапазон ${this.escapeHtml(res.coolingRecommendation.range)})</span></div></div>
          <div class="kv-row"><div>Основной вариант</div><div>${this.escapeHtml(res.coolingRecommendation.primaryLabel)}</div></div>
          <div class="kv-row"><div>Альтернатива</div><div>${this.escapeHtml(res.coolingRecommendation.alternativeLabel)}</div></div>
        </div>
        <div class="notice" style="margin-top:10px">${this.escapeHtml(res.coolingRecommendation.note)}</div>
      </div>` : ''}

      <div class="grid grid-2" style="margin-top:14px">
        <div class="card" style="padding:14px;margin:0">
          <div class="section-title">Сенсорный баланс</div>
          <div class="score-breakdown">
            <div class="score-line"><span>Сладость</span><strong>${res.sensoryBalance.sweetness}</strong></div>
            <div class="score-line"><span>Кислотность</span><strong>${res.sensoryBalance.acidity}</strong></div>
            <div class="score-line"><span>Свежесть</span><strong>${res.sensoryBalance.freshness}</strong></div>
            <div class="score-line"><span>Холод</span><strong>${res.sensoryBalance.cooling}</strong></div>
            <div class="score-line"><span>Плотность</span><strong>${res.sensoryBalance.density}</strong></div>
            <div class="score-line"><span>Сливочность</span><strong>${res.sensoryBalance.creaminess}</strong></div>
            <div class="score-line"><span>Сухость</span><strong>${res.sensoryBalance.dryness}</strong></div>
            <div class="score-line"><span>Яркость</span><strong>${res.sensoryBalance.brightness}</strong></div>
            <div class="score-line"><span>Глубина</span><strong>${res.sensoryBalance.depth}</strong></div>
          </div>
        </div>

        <div class="card" style="padding:14px;margin:0">
          <div class="section-title">Оценка по критериям</div>
          <div class="score-breakdown">
            <div class="score-line"><span>Сенсорная совместимость</span><strong>${res.scoreBreakdown.sensoryCompatibility}/25</strong></div>
            <div class="score-line"><span>Логика ролей</span><strong>${res.scoreBreakdown.roleLogic}/20</strong></div>
            <div class="score-line"><span>Качество тела</span><strong>${res.scoreBreakdown.bodyQuality}/15</strong></div>
            <div class="score-line"><span>Баланс процентов</span><strong>${res.scoreBreakdown.percentageBalance}/15</strong></div>
            <div class="score-line"><span>Контроль подавления</span><strong>${res.scoreBreakdown.suppressionRiskControl}/10</strong></div>
            <div class="score-line"><span>Цельность и читаемость</span><strong>${res.scoreBreakdown.cohesionAndReadability}/10</strong></div>
            <div class="score-line"><span>Практическая применимость</span><strong>${res.scoreBreakdown.practicalUsability}/5</strong></div>
            <div class="score-line"><span>Итог</span><strong>${res.scoreBreakdown.total}/100</strong></div>
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px">
        <div class="card" style="padding:14px;margin:0">
          <div class="section-title">Почему этот микс работает / не работает</div>
          <p class="text-sm">${this.escapeHtml(res.whyWorks)}</p>
          <div class="notice" style="margin-top:10px">${this.escapeHtml(res.conceptComment || '')}</div>
        </div>
        <div class="card" style="padding:14px;margin:0">
          <div class="section-title">Основные риски</div>
          <div class="risk-list">${riskHtml}</div>
        </div>
      </div>

      <div class="card" style="padding:14px;margin-top:14px">
        <div class="section-title">Что исправить / рекомендации</div>
        <div class="action-list">${actionHtml}</div>
      </div>

      <div class="flex flex-wrap no-print" style="margin-top:14px">
        <button type="button" class="btn btn-sm btn-secondary" onclick='app.copyMix(${JSON.stringify(res.items.map(i => `${i.percent}% ${i.brand} ${i.name} (${this.roleLabels[i.role] || i.role})`).join("; ")).replace(/"/g,'&quot;')})'>📋 Копировать состав</button>
        <button type="button" class="btn btn-sm btn-success" onclick='app.saveFavoriteById(${JSON.stringify(res).replace(/"/g,'&quot;')})'>⭐ В избранное</button>
      </div>

      ${this.state.jsonMode ? `<div class="card" style="padding:14px;margin-top:14px"><div class="section-title">JSON preview</div><pre class="json-preview">${this.escapeHtml(JSON.stringify(res.json, null, 2))}</pre></div>` : ''}
    </div>`;
  },

  saveFavoriteById(result) {
    this.state.favorites.unshift(result);
    this.state.favorites = this.state.favorites.slice(0, 100);
    this.saveData();
    alert('Микс сохранен в избранное');
  },

  renderFavorites() {
    const list = document.getElementById('favorites-list');
    if (!list) return;
    if (!this.state.favorites.length) {
      list.innerHTML = '<div class="notice">Избранное пока пусто.</div>';
      return;
    }
    list.innerHTML = this.state.favorites.map((res, idx) => `
      <div class="card" style="margin-bottom:12px">
        <div class="flex justify-between" style="margin-bottom:10px;flex-wrap:wrap">
          <div>
            <strong>${this.escapeHtml(res.title)}</strong>
            <div class="footer-note">${this.labelToRu(res.compatibilityLabel)} • ${res.compatibilityScore}%</div>
          </div>
          <div class="flex">
            <button type="button" class="btn btn-sm btn-secondary" onclick='app.copyMix(${JSON.stringify(res.items.map(i => `${i.percent}% ${i.brand} ${i.name}`).join("; ")).replace(/"/g,'&quot;')})'>Копировать</button>
            <button type="button" class="btn btn-sm btn-danger" onclick="app.removeFavorite(${idx})">Удалить</button>
          </div>
        </div>
        <p class="text-sm">${this.escapeHtml(res.overallVerdict)}</p>
        <div class="small-tags" style="margin-top:10px">
          ${res.items.map(i => `<span class="tag">${i.percent}% ${this.escapeHtml(i.name)}</span>`).join('')}
        </div>
      </div>
    `).join('');
  },

  removeFavorite(idx) {
    this.state.favorites.splice(idx, 1);
    this.saveData();
    this.renderFavorites();
  },

  clearFavorites() {
    if (!confirm('Очистить избранное?')) return;
    this.state.favorites = [];
    this.saveData();
    this.renderFavorites();
  },

  async copyMix(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      alert('Скопировано');
    } catch (error) {
      alert('Не удалось скопировать автоматически. Выдели текст вручную.');
    }
  },

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },

  clampInt(value, min, max) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }
};

window.app = app;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.app.init());
} else {
  window.app.init();
}
