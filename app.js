// ===== البيانات =====
let shops = [];
let orders = [];
let reps = [
  { id: 1, name: 'مؤيد', phone: '', area: '' },
  { id: 2, name: 'بكر', phone: '', area: '' }
];
let currentItems = [];
let editIndex = -1;
let editShopId = -1;
let editRepId = -1;
let editOrderId = -1;
let editProductType = ''; // 'juice' or 'cake'
let editProductName = '';
let juiceTypes = [
  { name: 'برتقال', icon: '🍊', cost: 3250, price: 4000 },
  { name: 'خوخ', icon: '🍑', cost: 3250, price: 4000 },
  { name: 'أناناس', icon: '🍍', cost: 3250, price: 4000 },
  { name: 'عنب', icon: '🍇', cost: 3250, price: 4000 },
  { name: 'رمان', icon: '🫐', cost: 3250, price: 4000 },
  { name: 'فواكه', icon: '🥭', cost: 3250, price: 4000 }
];
let cakeTypes = [
  { name: 'توت', icon: '🫐', cost: 4125, price: 4750 },
  { name: 'فراولة', icon: '🍓', cost: 4125, price: 4750 },
  { name: 'مشمش', icon: '🍑', cost: 4125, price: 4750 },
  { name: 'نوتيلا', icon: '🍫', cost: 4125, price: 4750 },
  { name: 'نوتيلا بالبندق', icon: '🌰', cost: 4125, price: 4750 }
];
let otherTypes = [];
const JUICE_COST = 3250, CAKE_COST = 4125;

// ===== Firebase =====
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

function saveShops() { db.ref('shops').set(shops); }
function saveOrders() { db.ref('orders').set(orders); }
function saveReps() { db.ref('reps').set(reps); }

function attachSync(key, defaultValue, onData) {
  const ref = db.ref(key);
  ref.once('value').then(snap => {
    if(!snap.exists()) ref.set(defaultValue);
  });
  ref.on('value', snap => {
    const val = snap.val();
    onData(Array.isArray(val) ? val : (val ? Object.values(val) : defaultValue));
  });
}

function initFirebaseSync() {
  attachSync('shops', [], data => { shops = data; updateShopSelect(); updateInvoiceShopSelect(); renderShops(); });
  attachSync('orders', [], data => { orders = data; updateStats(); renderOrders(); renderHistory(); renderReturns(); });
  attachSync('reps', reps, data => { reps = data; updateRepSelect(); renderReps(); });
  attachSync('juiceTypes', juiceTypes, data => { juiceTypes = data; updateJuiceTypeSelect(); renderProducts(); });
  attachSync('cakeTypes', cakeTypes, data => { cakeTypes = data; updateCakeTypeSelect(); renderProducts(); });
  attachSync('otherTypes', otherTypes, data => { otherTypes = data; updateOtherTypeSelect(); renderProducts(); });
  db.ref('invoiceNumbers').on('value', snap => { invoiceNumbers = snap.val() || {}; });
}

// ===== ترقيم الفواتير (تسلسلي، مشترك عبر كل الأجهزة) =====
let invoiceNumbers = {}; // key: shopId_date -> رقم تسلسلي ثابت لهذه الفاتورة

function getInvoiceNumber(shopId, dateVal) {
  const key = shopId + '_' + (dateVal || 'all');
  if(invoiceNumbers[key]) return invoiceNumbers[key];
  // ما فيه رقم مخصص لهذه الفاتورة بعد → خذ رقم جديد من العداد المشترك بطريقة آمنة (transaction)
  db.ref('invoiceCounter').transaction(current => (current || 0) + 1).then(result => {
    const num = result.snapshot.val();
    invoiceNumbers[key] = num;
    db.ref('invoiceNumbers/' + key).set(num);
    previewInvoice(); // أعد الرسم الآن بعد ما توفر الرقم
  });
  return null;
}

// ===== تسجيل الدخول =====
const APP_USER = 'Adam';
const APP_PASS = 'Haider';
function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errorEl = document.getElementById('loginError');
  if(user === APP_USER && pass === APP_PASS) {
    localStorage.setItem('loggedIn', 'true');
    errorEl.style.display = 'none';
    document.getElementById('loginScreen').style.display = 'none';
    document.body.classList.remove('locked');
    initFirebaseSync();
  } else {
    errorEl.style.display = 'block';
  }
}
function doLogout() {
  if(!confirm('تسجيل الخروج؟')) return;
  localStorage.removeItem('loggedIn');
  location.reload();
}
function checkLoginState() {
  if(localStorage.getItem('loggedIn') === 'true') {
    document.getElementById('loginScreen').style.display = 'none';
    document.body.classList.remove('locked');
    initFirebaseSync();
  } else {
    document.getElementById('loginScreen').style.display = 'flex';
    document.body.classList.add('locked');
  }
}

function getTodayString() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function getNowString() {
  const d = new Date();
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  const btn = document.querySelector('.tab[data-tab="' + tabId + '"]');
  if(btn) btn.classList.add('active');
  if(tabId === 'orders') renderOrders();
  if(tabId === 'history') renderHistory();
  if(tabId === 'returns') renderReturns();
  if(tabId === 'shops') renderShops();
  if(tabId === 'invoice') updateInvoiceShopSelect();
  if(tabId === 'reps') renderReps();
  if(tabId === 'products') renderProducts();
  if(tabId === 'newOrder') { updateJuiceTypeSelect(); updateCakeTypeSelect(); updateOtherTypeSelect(); }
}

// ===== المندوبين =====
function addRep() {
  const name = document.getElementById('repName').value.trim();
  const phone = document.getElementById('repPhone').value.trim();
  const area = document.getElementById('repArea').value.trim();
  if(!name) { alert('أدخل اسم المندوب'); return; }
  reps.push({ id: Date.now(), name: name, phone: phone, area: area });
  saveReps();
  document.getElementById('repName').value = '';
  document.getElementById('repPhone').value = '';
  document.getElementById('repArea').value = '';
  alert('✅ تم إضافة المندوب!');
  updateRepSelect(); renderReps();
}
function renderReps() {
  const list = document.getElementById('repsList');
  if(reps.length === 0) { list.innerHTML = '<div class="empty-state">لا يوجد مندوبين.</div>'; return; }
  let html = '<table><tr><th>الاسم</th><th>الهاتف</th><th>المنطقة</th><th>تعديل</th><th>حذف</th></tr>';
  reps.forEach(r => {
    html += '<tr><td><strong>' + r.name + '</strong></td><td>' + (r.phone || '-') + '</td><td>' + (r.area || '-') + '</td><td><button class="btn-warning" onclick="openRepEditModal(' + r.id + ')">✏️</button></td><td><button class="btn-danger" onclick="deleteRep(' + r.id + ')">🗑️</button></td></tr>';
  });
  html += '</table>';
  list.innerHTML = html;
}
function deleteRep(id) {
  if(!confirm('حذف المندوب؟')) return;
  reps = reps.filter(r => r.id !== id);
  saveReps();
  updateRepSelect(); renderReps();
}
function openRepEditModal(id) {
  const rep = reps.find(r => r.id === id);
  if(!rep) return;
  editRepId = id;
  document.getElementById('repEditModalContent').innerHTML = 
    '<div class="form-group"><label>اسم المندوب</label><input type="text" id="editRepName" value="' + rep.name + '"></div>' +
    '<div class="form-group"><label>رقم الهاتف</label><input type="text" id="editRepPhone" value="' + (rep.phone || '') + '"></div>' +
    '<div class="form-group"><label>المنطقة</label><input type="text" id="editRepArea" value="' + (rep.area || '') + '"></div>' +
    '<button class="btn" onclick="saveRepEdit()">💾 حفظ</button>';
  document.getElementById('repEditModal').classList.add('active');
}
function closeRepEditModal() { document.getElementById('repEditModal').classList.remove('active'); editRepId = -1; }
function saveRepEdit() {
  if(editRepId < 0) return;
  const rep = reps.find(r => r.id === editRepId);
  if(!rep) return;
  rep.name = document.getElementById('editRepName').value.trim() || rep.name;
  rep.phone = document.getElementById('editRepPhone').value.trim();
  rep.area = document.getElementById('editRepArea').value.trim();
  saveReps();
  closeRepEditModal(); updateRepSelect(); renderReps();
}
function updateRepSelect() {
  const sel = document.getElementById('repSelect');
  sel.innerHTML = '<option value="">-- اختر المندوب --</option>';
  reps.forEach(r => sel.innerHTML += '<option value="' + r.name + '">' + r.name + '</option>');
}

// ===== المحلات =====
function addShop() {
  const name = document.getElementById('shopName').value.trim();
  const area = document.getElementById('shopArea').value.trim();
  const phone = document.getElementById('shopPhone').value.trim();
  const owner = document.getElementById('shopOwner').value.trim();
  const location = document.getElementById('shopLocation').value.trim();
  if(!name) { alert('أدخل اسم المحل'); return; }
  shops.push({ id: Date.now(), name: name, area: area, phone: phone, owner: owner, location: location });
  saveShops();
  ['shopName','shopArea','shopPhone','shopOwner','shopLocation'].forEach(id => document.getElementById(id).value = '');
  alert('✅ تم الإضافة!');
  updateShopSelect(); updateInvoiceShopSelect(); renderShops();
}
function renderShops() {
  const list = document.getElementById('shopsList');
  const term = document.getElementById('searchShops').value.trim().toLowerCase();
  let filtered = term ? shops.filter(s => s.name.toLowerCase().includes(term) || (s.area && s.area.toLowerCase().includes(term))) : shops;
  if(filtered.length === 0) { list.innerHTML = '<div class="empty-state">لا توجد محلات.</div>'; return; }
  let html = '<table><tr><th>المحل</th><th>المنطقة</th><th>الهاتف</th><th>الخريطة</th><th>تعديل</th><th>حذف</th></tr>';
  filtered.forEach(s => {
    html += '<tr><td><strong>' + s.name + '</strong>' + (s.owner ? '<br><small>' + s.owner + '</small>' : '') + '</td><td>' + (s.area || '-') + '</td><td>' + (s.phone || '-') + '</td><td>' + (s.location ? '<a href="' + s.location + '" target="_blank"><button class="btn-small" style="background:#27ae60;">🗺️</button></a>' : '-') + '</td><td><button class="btn-warning" onclick="openShopEditModal(' + s.id + ')">✏️</button></td><td><button class="btn-danger" onclick="deleteShop(' + s.id + ')">🗑️</button></td></tr>';
  });
  html += '</table>';
  list.innerHTML = html;
}
function deleteShop(id) { if(!confirm('حذف؟')) return; shops = shops.filter(s => s.id !== id); saveShops(); updateShopSelect(); updateInvoiceShopSelect(); renderShops(); }
function openMapPicker() { window.open('https://www.google.com/maps', '_blank'); }

function openShopEditModal(id) {
  const shop = shops.find(s => s.id === id);
  if(!shop) return;
  editShopId = id;
  document.getElementById('shopEditModalContent').innerHTML = 
    '<div class="form-group"><label>اسم المحل</label><input type="text" id="editShopName" value="' + shop.name + '"></div>' +
    '<div class="two-col"><div class="form-group"><label>المنطقة</label><input type="text" id="editShopArea" value="' + (shop.area || '') + '"></div>' +
    '<div class="form-group"><label>الهاتف</label><input type="text" id="editShopPhone" value="' + (shop.phone || '') + '"></div></div>' +
    '<div class="form-group"><label>صاحب المحل</label><input type="text" id="editShopOwner" value="' + (shop.owner || '') + '"></div>' +
    '<div class="form-group"><label>📍 موقع Google Maps</label><input type="text" id="editShopLocation" value="' + (shop.location || '') + '"></div>' +
    '<button class="btn" onclick="saveShopEdit()">💾 حفظ</button>';
  document.getElementById('shopEditModal').classList.add('active');
}
function closeShopEditModal() { document.getElementById('shopEditModal').classList.remove('active'); editShopId = -1; }
function saveShopEdit() {
  if(editShopId < 0) return;
  const shop = shops.find(s => s.id === editShopId);
  if(!shop) return;
  shop.name = document.getElementById('editShopName').value.trim() || shop.name;
  shop.area = document.getElementById('editShopArea').value.trim();
  shop.phone = document.getElementById('editShopPhone').value.trim();
  shop.owner = document.getElementById('editShopOwner').value.trim();
  shop.location = document.getElementById('editShopLocation').value.trim();
  saveShops();
  closeShopEditModal(); updateShopSelect(); updateInvoiceShopSelect(); renderShops();
  orders.forEach(o => { if(o.shopId === editShopId) o.shopName = shop.name; });
  saveOrders();
  updateStats(); renderOrders(); renderHistory();
}
function updateShopSelect() {
  const sel = document.getElementById('shopSelect');
  sel.innerHTML = '<option value="">-- اختر المحل --</option>';
  shops.forEach(s => sel.innerHTML += '<option value="' + s.id + '">' + s.name + '</option>');
}
function updateInvoiceShopSelect() {
  const sel = document.getElementById('invoiceShop');
  sel.innerHTML = '<option value="">-- اختر المحل --</option>';
  shops.forEach(s => sel.innerHTML += '<option value="' + s.id + '">' + s.name + '</option>');
}

// ===== إدارة أنواع المنتجات (عصائر / كب كيك) =====
function saveProductTypes() {
  db.ref('juiceTypes').set(juiceTypes);
  db.ref('cakeTypes').set(cakeTypes);
  db.ref('otherTypes').set(otherTypes);
}
function addJuiceType() {
  const name = document.getElementById('newJuiceName').value.trim();
  const cost = parseInt(document.getElementById('newJuiceCost').value) || 0;
  const price = parseInt(document.getElementById('newJuicePrice').value) || 0;
  if(!name) { alert('أدخل اسم النوع'); return; }
  if(juiceTypes.find(t => t.name === name)) { alert('هذا النوع موجود مسبقاً'); return; }
  juiceTypes.push({ name: name, icon: '🧃', cost: cost, price: price });
  saveProductTypes();
  document.getElementById('newJuiceName').value = '';
  document.getElementById('newJuiceCost').value = 3250;
  document.getElementById('newJuicePrice').value = 4000;
  renderProducts(); updateJuiceTypeSelect();
  alert('✅ تمت الإضافة!');
}
function addCakeType() {
  const name = document.getElementById('newCakeName').value.trim();
  const cost = parseInt(document.getElementById('newCakeCost').value) || 0;
  const price = parseInt(document.getElementById('newCakePrice').value) || 0;
  if(!name) { alert('أدخل اسم النوع'); return; }
  if(cakeTypes.find(t => t.name === name)) { alert('هذا النوع موجود مسبقاً'); return; }
  cakeTypes.push({ name: name, icon: '🧁', cost: cost, price: price });
  saveProductTypes();
  document.getElementById('newCakeName').value = '';
  document.getElementById('newCakeCost').value = 4125;
  document.getElementById('newCakePrice').value = 4750;
  renderProducts(); updateCakeTypeSelect();
  alert('✅ تمت الإضافة!');
}
function addOtherType() {
  const name = document.getElementById('newOtherName').value.trim();
  const cost = parseInt(document.getElementById('newOtherCost').value) || 0;
  const price = parseInt(document.getElementById('newOtherPrice').value) || 0;
  const packetsPerCarton = parseInt(document.getElementById('newOtherPackets').value) || 0;
  const piecesPerPacket = parseInt(document.getElementById('newOtherPieces').value) || 0;
  if(!name) { alert('أدخل اسم المنتج'); return; }
  if(otherTypes.find(t => t.name === name)) { alert('هذا المنتج موجود مسبقاً'); return; }
  otherTypes.push({ name: name, icon: '📦', cost: cost, price: price, packetsPerCarton: packetsPerCarton, piecesPerPacket: piecesPerPacket });
  saveProductTypes();
  document.getElementById('newOtherName').value = '';
  document.getElementById('newOtherCost').value = 0;
  document.getElementById('newOtherPrice').value = 0;
  document.getElementById('newOtherPackets').value = '';
  document.getElementById('newOtherPieces').value = '';
  renderProducts(); updateOtherTypeSelect();
  alert('✅ تمت الإضافة!');
}
function deleteOtherType(name) {
  if(!confirm('حذف هذا المنتج؟')) return;
  otherTypes = otherTypes.filter(t => t.name !== name);
  saveProductTypes(); renderProducts(); updateOtherTypeSelect();
}
function deleteJuiceType(name) {
  if(!confirm('حذف هذا النوع؟')) return;
  juiceTypes = juiceTypes.filter(t => t.name !== name);
  saveProductTypes(); renderProducts(); updateJuiceTypeSelect();
}
function deleteCakeType(name) {
  if(!confirm('حذف هذا النوع؟')) return;
  cakeTypes = cakeTypes.filter(t => t.name !== name);
  saveProductTypes(); renderProducts(); updateCakeTypeSelect();
}
function renderProducts() {
  const juiceList = document.getElementById('juiceTypesList');
  const cakeList = document.getElementById('cakeTypesList');
  if(juiceTypes.length === 0) { juiceList.innerHTML = '<div class="empty-state">لا توجد أنواع.</div>'; }
  else {
    let html = '<table><tr><th>النوع</th><th>سعر التكلفة</th><th>سعر البيع</th><th>تعديل</th><th>حذف</th></tr>';
    juiceTypes.forEach(t => {
      html += '<tr><td>' + t.icon + ' ' + t.name + '</td><td>' + t.cost.toLocaleString() + '</td><td>' + t.price.toLocaleString() + '</td>' +
        '<td><button class="btn-warning" onclick="openProductEditModal(\'juice\',\'' + t.name.replace(/'/g,"\\'") + '\')">✏️</button></td>' +
        '<td><button class="btn-danger" onclick="deleteJuiceType(\'' + t.name.replace(/'/g,"\\'") + '\')">🗑️</button></td></tr>';
    });
    html += '</table>';
    juiceList.innerHTML = html;
  }
  if(cakeTypes.length === 0) { cakeList.innerHTML = '<div class="empty-state">لا توجد أنواع.</div>'; }
  else {
    let html = '<table><tr><th>النوع</th><th>سعر التكلفة</th><th>سعر البيع</th><th>تعديل</th><th>حذف</th></tr>';
    cakeTypes.forEach(t => {
      html += '<tr><td>' + t.icon + ' ' + t.name + '</td><td>' + t.cost.toLocaleString() + '</td><td>' + t.price.toLocaleString() + '</td>' +
        '<td><button class="btn-warning" onclick="openProductEditModal(\'cake\',\'' + t.name.replace(/'/g,"\\'") + '\')">✏️</button></td>' +
        '<td><button class="btn-danger" onclick="deleteCakeType(\'' + t.name.replace(/'/g,"\\'") + '\')">🗑️</button></td></tr>';
    });
    html += '</table>';
    cakeList.innerHTML = html;
  }
  const otherList = document.getElementById('otherTypesList');
  if(otherList) {
    if(otherTypes.length === 0) { otherList.innerHTML = '<div class="empty-state">لا توجد منتجات.</div>'; }
    else {
      let html = '<table><tr><th>المنتج</th><th>سعر التكلفة</th><th>سعر البيع</th><th>التعبئة</th><th>تعديل</th><th>حذف</th></tr>';
      otherTypes.forEach(t => {
        const hasCarton = t.packetsPerCarton > 0 && t.piecesPerPacket > 0;
        const packInfo = hasCarton ? (t.packetsPerCarton + ' باكيت × ' + t.piecesPerPacket + ' قطعة = ' + (t.packetsPerCarton * t.piecesPerPacket) + ' قطعة/كرتون') : 'بالقطعة';
        const unitTag = hasCarton ? '/كرتون' : '/قطعة';
        html += '<tr><td>' + t.icon + ' ' + t.name + '</td><td>' + t.cost.toLocaleString() + ' ' + unitTag + '</td><td>' + t.price.toLocaleString() + ' ' + unitTag + '</td><td style="font-size:0.75rem;">' + packInfo + '</td>' +
          '<td><button class="btn-warning" onclick="openProductEditModal(\'other\',\'' + t.name.replace(/'/g,"\\'") + '\')">✏️</button></td>' +
          '<td><button class="btn-danger" onclick="deleteOtherType(\'' + t.name.replace(/'/g,"\\'") + '\')">🗑️</button></td></tr>';
      });
      html += '</table>';
      otherList.innerHTML = html;
    }
  }
}
function openProductEditModal(kind, name) {
  const list = kind === 'juice' ? juiceTypes : kind === 'cake' ? cakeTypes : otherTypes;
  const prod = list.find(t => t.name === name);
  if(!prod) return;
  editProductType = kind; editProductName = name;
  const packagingHtml = kind === 'other'
    ? '<div class="two-col"><div class="form-group"><label>باكيتات بالكرتون</label><input type="number" id="editProdPackets" value="' + (prod.packetsPerCarton || '') + '" min="0" placeholder="اختياري"></div>' +
      '<div class="form-group"><label>قطع بالباكيت</label><input type="number" id="editProdPieces" value="' + (prod.piecesPerPacket || '') + '" min="0" placeholder="اختياري"></div></div>' +
      '<p style="font-size:0.72rem;color:#888;margin:0 0 6px;">إذا فيه تعبئة: السعرين أعلاه للكرتون الكامل. إذا فاضين: السعرين للقطعة.</p>'
    : '';
  document.getElementById('productEditModalContent').innerHTML =
    '<div class="form-group"><label>اسم النوع</label><input type="text" id="editProdName" value="' + prod.name + '"></div>' +
    '<div class="two-col"><div class="form-group"><label>سعر التكلفة</label><input type="number" id="editProdCost" value="' + prod.cost + '" min="0"></div>' +
    '<div class="form-group"><label>سعر البيع</label><input type="number" id="editProdPrice" value="' + prod.price + '" min="0"></div></div>' +
    packagingHtml +
    '<button class="btn" onclick="saveProductEdit()">💾 حفظ</button>';
  document.getElementById('productEditModal').classList.add('active');
}
function closeProductEditModal() { document.getElementById('productEditModal').classList.remove('active'); editProductType = ''; editProductName = ''; }
function saveProductEdit() {
  if(!editProductType || !editProductName) return;
  const list = editProductType === 'juice' ? juiceTypes : editProductType === 'cake' ? cakeTypes : otherTypes;
  const prod = list.find(t => t.name === editProductName);
  if(!prod) return;
  prod.name = document.getElementById('editProdName').value.trim() || prod.name;
  prod.cost = parseInt(document.getElementById('editProdCost').value) || 0;
  prod.price = parseInt(document.getElementById('editProdPrice').value) || 0;
  if(editProductType === 'other') {
    const packetsEl = document.getElementById('editProdPackets');
    const piecesEl = document.getElementById('editProdPieces');
    prod.packetsPerCarton = packetsEl ? (parseInt(packetsEl.value) || 0) : 0;
    prod.piecesPerPacket = piecesEl ? (parseInt(piecesEl.value) || 0) : 0;
  }
  saveProductTypes();
  closeProductEditModal(); renderProducts();
  updateJuiceTypeSelect(); updateCakeTypeSelect(); updateOtherTypeSelect();
}
function updateJuiceTypeSelect() {
  const sel = document.getElementById('juiceType');
  const giftSel = document.getElementById('juiceGiftType');
  if(!sel) return;
  const prevVal = sel.value;
  sel.innerHTML = juiceTypes.map(t => '<option value="' + t.name + '">' + t.icon + ' ' + t.name + '</option>').join('');
  if(giftSel) giftSel.innerHTML = sel.innerHTML;
  if(juiceTypes.find(t => t.name === prevVal)) sel.value = prevVal;
  fillJuiceDefaults();
}
function updateCakeTypeSelect() {
  const sel = document.getElementById('cakeType');
  const giftSel = document.getElementById('cakeGiftType');
  if(!sel) return;
  const prevVal = sel.value;
  sel.innerHTML = cakeTypes.map(t => '<option value="' + t.name + '">' + t.icon + ' ' + t.name + '</option>').join('');
  if(giftSel) giftSel.innerHTML = sel.innerHTML;
  if(cakeTypes.find(t => t.name === prevVal)) sel.value = prevVal;
  fillCakeDefaults();
}
function otherCartonPieces(prod) {
  if(!prod) return 0;
  return (prod.packetsPerCarton || 0) * (prod.piecesPerPacket || 0);
}
// يبني تسمية الكمية بالكرتون: "كرتون" أو "نصف كرتون" + عدد الباكيتات بين قوسين خفيفة إذا كان معرّفاً
function formatCartonQtyLabel(cartonQty, packetsPerCarton) {
  let text;
  if(Math.abs(cartonQty - 1) < 1e-9) text = 'كرتون';
  else if(Math.abs(cartonQty - 0.5) < 1e-9) text = 'نصف كرتون';
  else text = cartonQty + ' كرتون';
  let packetsPart = '';
  if(packetsPerCarton > 0) {
    const packets = Math.round(cartonQty * packetsPerCarton);
    packetsPart = '(' + packets + ')';
  }
  const html = text + (packetsPart ? ' <span class="qty-sub">' + packetsPart + '</span>' : '');
  const plain = text + (packetsPart ? ' ' + packetsPart : '');
  return { text: plain, html: html };
}
function updateOtherPriceFields() {
  const typeSel = document.getElementById('otherType');
  if(!typeSel) return;
  const prod = otherTypes.find(t => t.name === typeSel.value);
  if(!prod) return;
  document.getElementById('otherSellPrice').value = prod.price || 0;
  document.getElementById('otherCostPrice').value = prod.cost || 0;
}
function updateOtherCalcPreview() {
  const preview = document.getElementById('otherCalcPreview');
  const qtyEl = document.getElementById('otherQty');
  const typeSel = document.getElementById('otherType');
  if(!preview || !qtyEl) return;
  const enteredQty = parseFloat(qtyEl.value) || 0;
  const unitSellPrice = parseInt(document.getElementById('otherSellPrice').value) || 0;
  const unitCostPrice = parseInt(document.getElementById('otherCostPrice').value) || 0;
  if(enteredQty <= 0) { preview.innerHTML = ''; return; }
  const totalCost = enteredQty * unitCostPrice;
  const totalRevenue = enteredQty * unitSellPrice;
  const totalProfit = totalRevenue - totalCost;
  const prod = typeSel ? otherTypes.find(t => t.name === typeSel.value) : null;
  const qtyLabel = formatCartonQtyLabel(enteredQty, prod ? (prod.packetsPerCarton || 0) : 0);
  preview.innerHTML = '💰 لـ ' + qtyLabel.html + ':&nbsp; التكلفة ' + totalCost.toLocaleString() + ' | الإيراد ' + totalRevenue.toLocaleString() + ' | <strong>الربح ' + totalProfit.toLocaleString() + '</strong>';
}
function updateOtherTypeSelect() {
  const sel = document.getElementById('otherType');
  const giftSel = document.getElementById('otherGiftType');
  if(!sel) return;
  const prevVal = sel.value;
  sel.innerHTML = otherTypes.map(t => '<option value="' + t.name + '">' + t.icon + ' ' + t.name + '</option>').join('');
  if(giftSel) giftSel.innerHTML = sel.innerHTML;
  if(otherTypes.find(t => t.name === prevVal)) sel.value = prevVal;
  fillOtherDefaults();
}
function fillOtherDefaults() {
  updateOtherPriceFields();
  updateOtherCalcPreview();
}
function fillJuiceDefaults() {
  const sel = document.getElementById('juiceType');
  if(!sel || !sel.value) return;
  const prod = juiceTypes.find(t => t.name === sel.value);
  if(!prod) return;
  document.getElementById('juicePrice').value = prod.price;
  document.getElementById('juiceCostPrice').value = prod.cost;
}
function fillCakeDefaults() {
  const sel = document.getElementById('cakeType');
  if(!sel || !sel.value) return;
  const prod = cakeTypes.find(t => t.name === sel.value);
  if(!prod) return;
  document.getElementById('cakePrice').value = prod.price;
  document.getElementById('cakeCostPrice').value = prod.cost;
}

// ===== تقرير احتياجات الشراء =====
function generateNeedsReport() {
  const date = document.getElementById('needsDate').value;
  const div = document.getElementById('needsReport');
  if(!date) { div.innerHTML = '<div class="empty-state">اختر تاريخاً لعرض الاحتياجات.</div>'; return; }
  const dayOrders = orders.filter(o => o.date === date && o.status !== 'returned');
  if(dayOrders.length === 0) { div.innerHTML = '<div class="empty-state">لا توجد طلبات بهذا التاريخ.</div>'; return; }
  const needs = {}; // key: category|type -> qty
  dayOrders.forEach(o => {
    o.items.forEach(item => {
      const key = item.category + '|' + item.type;
      needs[key] = (needs[key] || 0) + item.qty;
      if(item.hasGift && item.giftQty > 0) {
        const giftKey = item.category + '|' + item.giftType + ' (هدية)';
        needs[giftKey] = (needs[giftKey] || 0) + item.giftQty;
      }
    });
  });
  const entries = Object.entries(needs).sort((a,b) => b[1] - a[1]);
  let html = '<table><tr><th>الصنف</th><th>النوع</th><th>الكمية المطلوبة</th></tr>';
  entries.forEach(([key, qty]) => {
    const [category, type] = key.split('|');
    let icon = category === 'عصير' ? '🧃' : category === 'كب كيك' ? '🧁' : '📦';
    html += '<tr><td>' + icon + ' ' + category + '</td><td>' + type + '</td><td><strong>' + qty + '</strong></td></tr>';
  });
  html += '</table>';
  div.innerHTML = html;
}

// ===== الهدايا =====
function toggleGiftInput(rowId) {
  const row = document.getElementById(rowId);
  row.style.display = row.style.display === 'none' ? 'block' : 'none';
}

// ===== عناصر الطلب =====
function addJuiceItem() {
  const type = document.getElementById('juiceType').value;
  const qty = parseInt(document.getElementById('juiceQty').value) || 0;
  const price = parseInt(document.getElementById('juicePrice').value) || 4000;
  const costPrice = parseInt(document.getElementById('juiceCostPrice').value) || JUICE_COST;
  const hasGift = document.getElementById('juiceHasGift').checked;
  const giftQty = hasGift ? (parseInt(document.getElementById('juiceGiftQty').value) || 0) : 0;
  const giftType = hasGift ? document.getElementById('juiceGiftType').value : '';
  if(qty <= 0) return;
  currentItems.push({ 
    category: 'عصير', type: type, qty: qty, costPrice: costPrice, sellPrice: price, 
    cost: qty * costPrice, revenue: qty * price, profit: qty * (price - costPrice),
    hasGift: hasGift && giftQty > 0, giftQty: giftQty, giftType: giftType,
    giftCost: hasGift && giftQty > 0 ? giftQty * costPrice : 0
  });
  document.getElementById('juiceQty').value = 0;
  document.getElementById('juiceHasGift').checked = false;
  document.getElementById('juiceGiftQty').value = 0;
  document.getElementById('juiceGiftRow').style.display = 'none';
  fillJuiceDefaults();
  renderItemsList();
}
function addCakeItem() {
  const type = document.getElementById('cakeType').value;
  const qty = parseInt(document.getElementById('cakeQty').value) || 0;
  const price = parseInt(document.getElementById('cakePrice').value) || 4750;
  const costPrice = parseInt(document.getElementById('cakeCostPrice').value) || CAKE_COST;
  const hasGift = document.getElementById('cakeHasGift').checked;
  const giftQty = hasGift ? (parseInt(document.getElementById('cakeGiftQty').value) || 0) : 0;
  const giftType = hasGift ? document.getElementById('cakeGiftType').value : '';
  if(qty <= 0) return;
  currentItems.push({ 
    category: 'كب كيك', type: type, qty: qty, costPrice: costPrice, sellPrice: price, 
    cost: qty * costPrice, revenue: qty * price, profit: qty * (price - costPrice),
    hasGift: hasGift && giftQty > 0, giftQty: giftQty, giftType: giftType,
    giftCost: hasGift && giftQty > 0 ? giftQty * costPrice : 0
  });
  document.getElementById('cakeQty').value = 0;
  document.getElementById('cakeHasGift').checked = false;
  document.getElementById('cakeGiftQty').value = 0;
  document.getElementById('cakeGiftRow').style.display = 'none';
  fillCakeDefaults();
  renderItemsList();
}
function addOtherItem() {
  const type = document.getElementById('otherType').value;
  const enteredQty = parseFloat(document.getElementById('otherQty').value) || 0;
  const unitSellPrice = parseInt(document.getElementById('otherSellPrice').value) || 0;
  const unitCostPrice = parseInt(document.getElementById('otherCostPrice').value) || 0;
  const hasGift = document.getElementById('otherHasGift').checked;
  const giftQty = hasGift ? (parseInt(document.getElementById('otherGiftQty').value) || 0) : 0;
  const giftType = hasGift ? document.getElementById('otherGiftType').value : '';
  if(!type) { alert('أضف منتجاً من تبويب المنتجات أولاً'); return; }
  if(enteredQty <= 0) return;
  const prod = otherTypes.find(t => t.name === type);
  const packetsPerCarton = prod ? (prod.packetsPerCarton || 0) : 0;
  const cartonPieces = otherCartonPieces(prod);
  const qty = cartonPieces > 0 ? Math.round(enteredQty * cartonPieces) : enteredQty; // للتقارير/احتياجات الشراء
  const totalCost = enteredQty * unitCostPrice;
  const totalRevenue = enteredQty * unitSellPrice;
  const totalProfit = totalRevenue - totalCost;
  const qtyLabel = formatCartonQtyLabel(enteredQty, packetsPerCarton);
  currentItems.push({ 
    category: 'منتج إضافي', type: type, qty: qty,
    costPrice: qty > 0 ? Math.round(totalCost / qty) : unitCostPrice,
    sellPrice: qty > 0 ? Math.round(totalRevenue / qty) : unitSellPrice,
    cost: totalCost, revenue: totalRevenue, profit: totalProfit,
    hasGift: hasGift && giftQty > 0, giftQty: giftQty, giftType: giftType,
    giftCost: hasGift && giftQty > 0 ? giftQty * (qty > 0 ? Math.round(totalCost / qty) : unitCostPrice) : 0,
    unit: 'carton', cartonQty: enteredQty, packetsPerCarton: packetsPerCarton,
    unitNote: qtyLabel.text, qtyLabel: qtyLabel.text, qtyLabelHtml: qtyLabel.html
  });
  document.getElementById('otherHasGift').checked = false;
  document.getElementById('otherGiftQty').value = 0;
  document.getElementById('otherGiftRow').style.display = 'none';
  fillOtherDefaults();
  renderItemsList();
}
function removeItem(index) { currentItems.splice(index, 1); renderItemsList(); }

function renderItemsList() {
  const list = document.getElementById('itemsList');
  const summary = document.getElementById('orderSummary');
  const summaryContent = document.getElementById('summaryContent');
  if(currentItems.length === 0) { list.innerHTML = ''; summary.style.display = 'none'; return; }

  let html = '<h4 style="color:#1a5276;margin-bottom:8px;font-size:0.9rem;">📋 العناصر:</h4><table><tr><th>المنتج</th><th>النوع</th><th>الكمية</th><th>التكلفة</th><th>الإيراد</th><th>الربح</th><th>تعديل</th><th>حذف</th></tr>';
  let totalCost = 0, totalRevenue = 0, totalProfit = 0, totalGiftCost = 0;
  currentItems.forEach(function(item, i) {
    let icon = item.category === 'عصير' ? '🧃' : item.category === 'كب كيك' ? '🧁' : '📦';
    let giftTag = item.hasGift ? '<span class="item-gift-tag">🎁 ' + item.giftQty + '</span>' : '';
    let typeCell = item.type;
    let qtyCell = item.qtyLabelHtml || item.qty;
    html += '<tr><td>' + icon + ' ' + item.category + ' ' + giftTag + '</td><td>' + typeCell + '</td><td>' + qtyCell + '</td><td>' + item.cost.toLocaleString() + '</td><td>' + item.revenue.toLocaleString() + '</td><td class="' + (item.profit>=0?'profit-positive':'profit-negative') + '">' + item.profit.toLocaleString() + '</td><td><button class="btn-warning" onclick="openEditModal(' + i + ')">✏️</button></td><td><button class="btn-danger" onclick="removeItem(' + i + ')">❌</button></td></tr>';
    totalCost += item.cost; totalRevenue += item.revenue; totalProfit += item.profit;
    if(item.hasGift) totalGiftCost += item.giftCost;
  });
  totalCost += totalGiftCost;
  totalProfit -= totalGiftCost;
  html += '<tr style="background:#f8f9fa;font-weight:bold;"><td colspan="3">الإجمالي</td><td>' + totalCost.toLocaleString() + '</td><td>' + totalRevenue.toLocaleString() + '</td><td class="' + (totalProfit>=0?'profit-positive':'profit-negative') + '">' + totalProfit.toLocaleString() + '</td><td colspan="2"></td></tr></table>';
  list.innerHTML = html;
  let summaryHtml = '<div class="summary-item"><span>الأصناف:</span><span><strong>' + currentItems.length + '</strong></span></div>';
  summaryHtml += '<div class="summary-item"><span>التكلفة:</span><span><strong>' + totalCost.toLocaleString() + ' د.ع</strong></span></div>';
  summaryHtml += '<div class="summary-item"><span>الإيراد:</span><span><strong>' + totalRevenue.toLocaleString() + ' د.ع</strong></span></div>';
  if(totalGiftCost > 0) summaryHtml += '<div class="summary-item" style="color:#e67e22;"><span>تكلفة الهدايا:</span><span><strong>' + totalGiftCost.toLocaleString() + ' د.ع</strong></span></div>';
  summaryHtml += '<div class="summary-item" style="color:#1e8449;font-size:1rem;"><span>الربح الصافي:</span><span><strong>' + totalProfit.toLocaleString() + ' د.ع</strong></span></div>';
  summaryContent.innerHTML = summaryHtml;
  summary.style.display = 'block';
}

function openEditModal(index) {
  editIndex = index;
  const item = currentItems[index];
  const isJuice = item.category === 'عصير';
  const isCake = item.category === 'كب كيك';
  const isOther = item.category === 'منتج إضافي';

  let giftHtml = '';
  if(isJuice || isCake || isOther) {
    const giftOptions = isJuice 
      ? juiceTypes.map(t => '<option value="' + t.name + '">' + t.icon + ' ' + t.name + '</option>').join('')
      : isCake ? cakeTypes.map(t => '<option value="' + t.name + '">' + t.icon + ' ' + t.name + '</option>').join('')
      : otherTypes.map(t => '<option value="' + t.name + '">' + t.icon + ' ' + t.name + '</option>').join('');
    giftHtml = '<div class="checkbox-group"><input type="checkbox" id="editHasGift" ' + (item.hasGift?'checked':'') + '><label for="editHasGift" style="margin:0;">🎁 هل يتضمن هدية؟</label></div>' +
      '<div class="gift-row"><div class="two-col"><div class="form-group"><label>نوع الهدية</label><select id="editGiftType">' + giftOptions + '</select></div>' +
      '<div class="form-group"><label>عدد الهدايا</label><input type="number" id="editGiftQty" value="' + (item.giftQty || 0) + '" min="0"></div></div></div>';
  }

  document.getElementById('editModalContent').innerHTML = 
    '<div class="form-group"><label>المنتج</label><input type="text" value="' + item.category + '" readonly style="background:#f0f0f0;"></div>' +
    '<div class="form-group"><label>النوع</label><input type="text" id="editType" value="' + item.type + '"></div>' +
    '<div class="two-col"><div class="form-group"><label>الكمية</label><input type="number" id="editQty" value="' + item.qty + '" min="0"></div>' +
    '<div class="form-group"><label>تكلفة الوحدة</label><input type="number" id="editCostPrice" value="' + item.costPrice + '" min="0"></div></div>' +
    '<div class="form-group"><label>سعر البيع</label><input type="number" id="editSellPrice" value="' + item.sellPrice + '" min="0"></div>' +
    giftHtml + '<button class="btn" onclick="saveEditItem()">💾 حفظ</button>';
  document.getElementById('editModal').classList.add('active');
}
function closeEditModal() { document.getElementById('editModal').classList.remove('active'); editIndex = -1; }
function saveEditItem() {
  if(editIndex < 0) return;
  const item = currentItems[editIndex];
  const qty = parseInt(document.getElementById('editQty').value) || 0;
  const costPrice = parseInt(document.getElementById('editCostPrice').value) || 0;
  const sellPrice = parseInt(document.getElementById('editSellPrice').value) || 0;
  const type = document.getElementById('editType').value.trim();
  const hasGiftEl = document.getElementById('editHasGift');
  const hasGift = hasGiftEl ? hasGiftEl.checked : false;
  const giftQty = hasGift ? (parseInt(document.getElementById('editGiftQty').value) || 0) : 0;
  const giftTypeEl = document.getElementById('editGiftType');
  const giftNameEl = document.getElementById('editGiftName');
  const giftType = hasGift ? (giftTypeEl ? giftTypeEl.value : (giftNameEl ? giftNameEl.value : '')) : '';
  if(qty <= 0) { alert('الكمية يجب أن تكون أكبر من صفر'); return; }
  item.type = type || item.type; item.qty = qty; item.costPrice = costPrice; item.sellPrice = sellPrice;
  item.cost = qty * costPrice; item.revenue = qty * sellPrice; item.profit = qty * (sellPrice - costPrice);
  item.hasGift = hasGift && giftQty > 0;
  item.giftQty = giftQty;
  item.giftType = giftType;
  item.giftCost = hasGift && giftQty > 0 ? giftQty * costPrice : 0;
  closeEditModal(); renderItemsList();
}

// ===== حفظ الطلب =====
function addOrder() {
  const shopId = document.getElementById('shopSelect').value;
  const repName = document.getElementById('repSelect').value;
  const dateVal = document.getElementById('orderDate').value;
  const notes = document.getElementById('orderNotes').value.trim();
  if(!shopId) { alert('اختر المحل'); return; }
  if(currentItems.length === 0) { alert('أضف منتج واحد على الأقل'); return; }
  const shop = shops.find(s => s.id == shopId);
  const date = dateVal || getTodayString();
  let totalCost = 0, totalRevenue = 0, totalProfit = 0;
  currentItems.forEach(function(item) { 
    totalCost += item.cost; totalRevenue += item.revenue; totalProfit += item.profit;
    if(item.hasGift) totalCost += item.giftCost;
    if(item.hasGift) totalProfit -= item.giftCost;
  });
  if(editOrderId > 0) {
    const existing = orders.find(o => o.id === editOrderId);
    if(existing) {
      existing.shopId = shop.id; existing.shopName = shop.name; existing.repName = repName || 'غير محدد';
      existing.date = date; existing.items = JSON.parse(JSON.stringify(currentItems));
      existing.notes = notes; existing.totalCost = totalCost; existing.totalRevenue = totalRevenue; existing.totalProfit = totalProfit;
      saveOrders();
      alert('✅ تم تحديث الطلب! الربح: ' + totalProfit.toLocaleString() + ' د.ع');
    }
    editOrderId = -1;
    document.getElementById('saveOrderBtn').textContent = '💾 حفظ الطلب';
  } else {
    const order = {
      id: Date.now(), shopId: shop.id, shopName: shop.name, repName: repName || 'غير محدد',
      date: date, time: getNowString(),
      items: JSON.parse(JSON.stringify(currentItems)),
      notes: notes, totalCost: totalCost, totalRevenue: totalRevenue, totalProfit: totalProfit,
      status: 'pending', deliveryDate: null
    };
    orders.push(order);
    saveOrders();
    alert('✅ تم الحفظ! الربح: ' + totalProfit.toLocaleString() + ' د.ع');
  }
  currentItems = [];
  document.getElementById('orderNotes').value = '';
  document.getElementById('itemsList').innerHTML = '';
  document.getElementById('orderSummary').style.display = 'none';
  updateStats(); showTab('orders');
}
function openOrderEditModal(id) {
  const order = orders.find(o => o.id === id);
  if(!order) return;
  editOrderId = id;
  currentItems = JSON.parse(JSON.stringify(order.items));
  showTab('newOrder');
  document.getElementById('shopSelect').value = order.shopId;
  document.getElementById('repSelect').value = order.repName;
  document.getElementById('orderDate').value = order.date;
  document.getElementById('orderNotes').value = order.notes || '';
  document.getElementById('saveOrderBtn').textContent = '💾 تحديث الطلب';
  renderItemsList();
}

function renderOrders() {
  const list = document.getElementById('ordersList');
  const term = document.getElementById('searchOrders').value.trim().toLowerCase();
  const today = getTodayString();
  let todayOrders = orders.filter(o => o.date === today && o.status !== 'returned');
  if(term) todayOrders = todayOrders.filter(o => o.shopName.toLowerCase().includes(term));
  if(todayOrders.length === 0) { list.innerHTML = '<div class="empty-state">لا توجد طلبات اليوم.</div>'; return; }
  let html = '';
  todayOrders.reverse().forEach(o => {
    const statusBadge = o.status === 'delivered' ? '<span class="status-delivered">✅ مستلم</span>' : '<span class="status-pending">⏳ قيد التوصيل</span>';
    html += renderOrderCard(o, statusBadge, true);
  });
  list.innerHTML = html;
}
function renderHistory() {
  const list = document.getElementById('historyList');
  const term = document.getElementById('searchHistory').value.trim().toLowerCase();
  let filtered = term ? orders.filter(o => o.shopName.toLowerCase().includes(term) || o.date.includes(term)) : [...orders];
  if(filtered.length === 0) { list.innerHTML = '<div class="empty-state">لا توجد طلبات.</div>'; return; }
  const grouped = {};
  filtered.forEach(o => { if(!grouped[o.date]) grouped[o.date] = []; grouped[o.date].push(o); });
  const sortedDates = Object.keys(grouped).sort((a,b) => new Date(b) - new Date(a));
  let html = '';
  sortedDates.forEach(date => {
    const dayOrders = grouped[date];
    const dayRevenue = dayOrders.reduce((s,o) => s + o.totalRevenue, 0);
    const dayCost = dayOrders.reduce((s,o) => s + o.totalCost, 0);
    const dayProfit = dayOrders.reduce((s,o) => s + o.totalProfit, 0);
    const isToday = date === getTodayString();
    html += '<div class="day-header"><span>📅 ' + (isToday ? 'اليوم' : date) + '</span><span class="day-stats">' + dayOrders.length + ' طلب | ربح: ' + dayProfit.toLocaleString() + ' د.ع</span></div>';
    dayOrders.reverse().forEach(o => {
      let statusBadge = '';
      if(o.status === 'delivered') statusBadge = '<span class="status-delivered">✅ مستلم</span>';
      else if(o.status === 'returned') statusBadge = '<span class="status-returned">🔄 راجع</span>';
      else statusBadge = '<span class="status-pending">⏳ قيد التوصيل</span>';
      html += renderOrderCard(o, statusBadge, true);
    });
  });
  list.innerHTML = html;
}
function renderReturns() {
  const list = document.getElementById('returnsList');
  const returns = orders.filter(o => o.status === 'returned');
  const pending = orders.filter(o => o.status === 'pending');
  if(returns.length === 0 && pending.length === 0) { list.innerHTML = '<div class="empty-state">لا توجد طلبات راجعة أو قيد التوصيل.</div>'; return; }
  let html = '';
  if(pending.length > 0) {
    html += '<h3 style="color:#e67e22;margin-bottom:10px;">⏳ قيد التوصيل</h3>';
    pending.forEach(o => { html += renderOrderCard(o, '<span class="status-pending">⏳ قيد التوصيل</span>', true); });
  }
  if(returns.length > 0) {
    html += '<h3 style="color:#e74c3c;margin:15px 0 10px;">🔄 طلبات راجعة</h3>';
    returns.forEach(o => { html += renderOrderCard(o, '<span class="status-returned">🔄 راجع</span>', true); });
  }
  list.innerHTML = html;
}
function renderOrderCard(o, statusBadge, showActions) {
  const profitClass = o.totalProfit >= 0 ? 'profit-positive' : 'profit-negative';
  let itemsDetails = '';
  o.items.forEach(item => {
    let icon = item.category === 'عصير' ? '🧃' : item.category === 'كب كيك' ? '🧁' : '📦';
    let giftInfo = item.hasGift ? '<span style="color:#e67e22;font-size:0.7rem;"> (🎁 ' + item.giftQty + ' ' + item.giftType + ')</span>' : '';
    itemsDetails += '<div style="font-size:0.78rem;padding:2px 0;">' + icon + ' ' + item.type + ': ' + item.qty + ' × ' + item.sellPrice.toLocaleString() + ' = ' + item.revenue.toLocaleString() + giftInfo + '</div>';
  });
  let actions = '';
  if(showActions) {
    actions = '<div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap;">';
    if(o.status === 'pending') {
      actions += '<button class="btn-small" style="background:#27ae60;" onclick="markDelivered(' + o.id + ')">✅ تسليم</button>';
      actions += '<button class="btn-small" style="background:#e74c3c;" onclick="markReturned(' + o.id + ')">🔄 راجع</button>';
    } else if(o.status === 'returned') {
      actions += '<button class="btn-small" style="background:#27ae60;" onclick="markDelivered(' + o.id + ')">✅ تسليم</button>';
    } else if(o.status === 'delivered') {
      actions += '<button class="btn-small" style="background:#e74c3c;" onclick="markReturned(' + o.id + ')">🔄 راجع</button>';
    }
    actions += '<button class="btn-warning" onclick="openOrderEditModal(' + o.id + ')">✏️ تعديل</button>';
    actions += '<button class="btn-danger" onclick="deleteOrder(' + o.id + ')">🗑️ حذف</button>';
    actions += '</div>';
  }
  return '<div class="card" style="margin-bottom:8px;padding:10px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
    '<strong style="color:#1a5276;font-size:0.9rem;">🏪 ' + o.shopName + '</strong>' +
    '<div>' + statusBadge + '</div></div>' +
    '<div style="font-size:0.75rem;color:#888;margin-bottom:6px;">📅 ' + o.date + ' ' + (o.time ? '⏰ ' + o.time : '') + ' ' + (o.repName ? '👤 ' + o.repName : '') + '</div>' +
    '<div style="margin-bottom:6px;">' + itemsDetails + '</div>' +
    '<div style="display:flex;justify-content:space-between;font-size:0.82rem;">' +
    '<span>💰 تكلفة: <strong>' + o.totalCost.toLocaleString() + '</strong> | إيراد: <strong>' + o.totalRevenue.toLocaleString() + '</strong></span>' +
    '<span class="' + profitClass + '">ربح: ' + o.totalProfit.toLocaleString() + '</span></div>' +
    (o.notes ? '<div style="font-size:0.75rem;color:#666;margin-top:4px;">📝 ' + o.notes + '</div>' : '') + actions + '</div>';
}
function markDelivered(id) {
  const order = orders.find(o => o.id === id);
  if(order) { order.status = 'delivered'; order.deliveryDate = getTodayString(); saveOrders(); updateStats(); renderReturns(); renderOrders(); renderHistory(); }
}
function markReturned(id) {
  if(!confirm('تأكيد: تحويل الطلب إلى راجع؟')) return;
  const order = orders.find(o => o.id === id);
  if(order) { order.status = 'returned'; saveOrders(); updateStats(); renderReturns(); renderOrders(); renderHistory(); }
}
function deleteOrder(id) {
  if(!confirm('حذف الطلب؟')) return;
  orders = orders.filter(o => o.id !== id);
  saveOrders();
  updateStats(); renderOrders(); renderHistory(); renderReturns();
}

// ===== التقارير =====
function generateDailyReport() {
  const date = document.getElementById('reportDate').value;
  if(!date) return;
  const dayOrders = orders.filter(o => o.date === date);
  const div = document.getElementById('dailyReport');
  if(dayOrders.length === 0) { div.innerHTML = '<div class="empty-state">لا توجد طلبات بهذا التاريخ.</div>'; return; }
  const totalCost = dayOrders.reduce((s,o) => s + o.totalCost, 0);
  const totalRevenue = dayOrders.reduce((s,o) => s + o.totalRevenue, 0);
  const totalProfit = dayOrders.reduce((s,o) => s + o.totalProfit, 0);
  const delivered = dayOrders.filter(o => o.status === 'delivered').length;
  const pending = dayOrders.filter(o => o.status === 'pending').length;
  const returned = dayOrders.filter(o => o.status === 'returned').length;
  div.innerHTML = '<table style="margin-top:10px;"><tr><th>البند</th><th>القيمة</th></tr>' +
    '<tr><td>📦 عدد الطلبات</td><td><strong>' + dayOrders.length + '</strong></td></tr>' +
    '<tr><td>✅ مستلمة</td><td><strong>' + delivered + '</strong></td></tr>' +
    '<tr><td>⏳ قيد التوصيل</td><td><strong>' + pending + '</strong></td></tr>' +
    '<tr><td>🔄 راجعة</td><td><strong>' + returned + '</strong></td></tr>' +
    '<tr><td>💰 التكلفة</td><td><strong>' + totalCost.toLocaleString() + ' د.ع</strong></td></tr>' +
    '<tr><td>💵 الإيراد</td><td><strong>' + totalRevenue.toLocaleString() + ' د.ع</strong></td></tr>' +
    '<tr><td style="color:#27ae60;font-weight:bold;">📈 الربح</td><td style="color:#27ae60;font-weight:bold;"><strong>' + totalProfit.toLocaleString() + ' د.ع</strong></td></tr></table>';
}
function generateMonthlyReport() {
  const month = document.getElementById('reportMonth').value;
  const year = document.getElementById('reportYear').value;
  if(!month || !year) return;
  const monthOrders = orders.filter(o => o.date.startsWith(year + '-' + month));
  const div = document.getElementById('monthlyReport');
  if(monthOrders.length === 0) { div.innerHTML = '<div class="empty-state">لا توجد طلبات بهذا الشهر.</div>'; return; }
  const totalCost = monthOrders.reduce((s,o) => s + o.totalCost, 0);
  const totalRevenue = monthOrders.reduce((s,o) => s + o.totalRevenue, 0);
  const totalProfit = monthOrders.reduce((s,o) => s + o.totalProfit, 0);
  const delivered = monthOrders.filter(o => o.status === 'delivered').length;
  const returned = monthOrders.filter(o => o.status === 'returned').length;
  const shopStats = {};
  monthOrders.forEach(o => {
    if(!shopStats[o.shopName]) shopStats[o.shopName] = { orders: 0, profit: 0 };
    shopStats[o.shopName].orders++;
    shopStats[o.shopName].profit += o.totalProfit;
  });
  let shopHtml = '';
  Object.entries(shopStats).sort((a,b) => b[1].profit - a[1].profit).forEach(([name, stat]) => {
    shopHtml += '<div style="font-size:0.82rem;padding:3px 0;">🏪 ' + name + ': ' + stat.orders + ' طلب | ربح: ' + stat.profit.toLocaleString() + ' د.ع</div>';
  });
  div.innerHTML = '<table style="margin-top:10px;"><tr><th>البند</th><th>القيمة</th></tr>' +
    '<tr><td>📦 إجمالي الطلبات</td><td><strong>' + monthOrders.length + '</strong></td></tr>' +
    '<tr><td>✅ مستلمة</td><td><strong>' + delivered + '</strong></td></tr>' +
    '<tr><td>🔄 راجعة</td><td><strong>' + returned + '</strong></td></tr>' +
    '<tr><td>💰 إجمالي التكلفة</td><td><strong>' + totalCost.toLocaleString() + ' د.ع</strong></td></tr>' +
    '<tr><td>💵 إجمالي الإيراد</td><td><strong>' + totalRevenue.toLocaleString() + ' د.ع</strong></td></tr>' +
    '<tr><td style="color:#27ae60;font-weight:bold;">📈 إجمالي الربح</td><td style="color:#27ae60;font-weight:bold;"><strong>' + totalProfit.toLocaleString() + ' د.ع</strong></td></tr></table>' +
    '<div style="margin-top:12px;"><h4 style="color:#1a5276;font-size:0.9rem;margin-bottom:8px;">🏪 تفاصيل المحلات:</h4>' + shopHtml + '</div>';
}
function generateNightReport() {
  const today = getTodayString();
  const dayOrders = orders.filter(o => o.date === today);
  const div = document.getElementById('nightReport');
  if(dayOrders.length === 0) { div.innerHTML = '<div class="empty-state">لا توجد طلبات اليوم.</div>'; return; }
  const totalCost = dayOrders.reduce((s,o) => s + o.totalCost, 0);
  const totalRevenue = dayOrders.reduce((s,o) => s + o.totalRevenue, 0);
  const totalProfit = dayOrders.reduce((s,o) => s + o.totalProfit, 0);
  div.innerHTML = '<div style="background:#1a5276;color:white;padding:15px;border-radius:10px;text-align:center;">' +
    '<h3 style="margin-bottom:10px;">📊 تقرير يوم ' + today + '</h3>' +
    '<div style="font-size:1.3rem;font-weight:bold;margin-bottom:5px;">الربح: ' + totalProfit.toLocaleString() + ' د.ع</div>' +
    '<div style="font-size:0.9rem;opacity:0.9;">طلبات: ' + dayOrders.length + ' | تكلفة: ' + totalCost.toLocaleString() + ' | إيراد: ' + totalRevenue.toLocaleString() + '</div>' +
    '<div style="font-size:0.8rem;margin-top:8px;opacity:0.8;">⏰ الساعة 9:00 مساءً - توقيت الموصل</div></div>';
}

// ===== الفواتير =====
function previewInvoice() {
  const shopId = document.getElementById('invoiceShop').value;
  const dateVal = document.getElementById('invoiceDate').value;
  const div = document.getElementById('invoicePreview');
  if(!shopId) { div.innerHTML = ''; return; }
  const shop = shops.find(s => s.id == shopId);
  let shopOrders = orders.filter(o => o.shopId == shopId && o.status !== 'returned');
  if(dateVal) shopOrders = shopOrders.filter(o => o.date === dateVal);
  if(shopOrders.length === 0) { div.innerHTML = '<div class="empty-state">لا توجد طلبات لهذا المحل.</div>'; return; }

  let itemsList = [];
  shopOrders.forEach(o => {
    o.items.forEach(item => {
      const existing = itemsList.find(i => i.type === item.type && i.sellPrice === item.sellPrice);
      if(existing) {
        existing.qty += item.qty; existing.total += item.revenue;
        if(item.category === 'منتج إضافي') existing.cartonQty = (existing.cartonQty || 0) + (item.cartonQty || 0);
      }
      else itemsList.push({
        category: item.category, type: item.type, qty: item.qty, sellPrice: item.sellPrice, total: item.revenue,
        cartonQty: item.category === 'منتج إضافي' ? (item.cartonQty || 0) : 0,
        packetsPerCarton: item.packetsPerCarton || 0
      });
    });
  });

  const grandTotal = itemsList.reduce((s,i) => s + i.total, 0);
  let totalGifts = 0;
  let giftDetails = [];
  shopOrders.forEach(o => {
    o.items.forEach(item => {
      if(item.hasGift) {
        totalGifts += item.giftQty;
        const existing = giftDetails.find(g => g.type === item.giftType);
        if(existing) existing.qty += item.giftQty;
        else giftDetails.push({ type: item.giftType, qty: item.giftQty });
      }
    });
  });

  let itemsHtml = '';
  itemsList.forEach((item, idx) => {
    const qtyDisplay = (item.category === 'منتج إضافي' && item.cartonQty > 0)
      ? formatCartonQtyLabel(item.cartonQty, item.packetsPerCarton).html
      : item.qty;
    itemsHtml += '<tr><td>' + (idx+1) + '</td><td>' + item.type + '</td><td>' + qtyDisplay + '</td><td>' + item.sellPrice.toLocaleString() + '</td><td>' + item.total.toLocaleString() + '</td></tr>';
  });
  let giftHtml = '';
  if(totalGifts > 0) {
    giftDetails.forEach(g => {
      giftHtml += '<tr><td colspan="2">هدية: ' + g.type + '</td><td>' + g.qty + '</td><td>مجاني</td><td>0</td></tr>';
    });
  }

  const invoiceNum = getInvoiceNumber(shopId, dateVal);
  const invoiceNo = invoiceNum ? ('INV-' + String(invoiceNum).padStart(5, '0')) : 'جارِ التوليد...';

  div.innerHTML = '<div class="invoice-preview" id="printInvoice">' +
    '<div class="invoice-accent"></div>' +
    '<div class="invoice-body">' +
    '<div class="invoice-topbar">' +
      '<div class="invoice-title">فاتورة</div>' +
      '<div class="invoice-badge ltr-num">' + invoiceNo + '</div>' +
    '</div>' +
    '<div class="invoice-details">' +
      '<div>' +
        '<span class="invoice-label">إلى</span>' +
        '<div class="invoice-value">' + shop.name + '</div>' +
        '<div class="invoice-sub">' + (shop.area || '-') + '</div>' +
        (shop.phone ? '<div class="invoice-sub ltr-num">' + shop.phone + '</div>' : '') +
      '</div>' +
      '<div>' +
        '<span class="invoice-label">التاريخ</span>' +
        '<div class="invoice-value">' + (dateVal || 'جميع التواريخ') + '</div>' +
        '<span class="invoice-label" style="margin-top:8px;">المندوب</span>' +
        '<div class="invoice-value">' + (shopOrders[0] ? shopOrders[0].repName : 'غير محدد') + '</div>' +
      '</div>' +
    '</div>' +
    '<table class="invoice-table">' +
    '<tr><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر القطعة</th><th>الإجمالي</th></tr>' +
    itemsHtml + giftHtml + '</table>' +
    (totalGifts > 0 ? '<div class="invoice-gift-line">الهدايا: ' + totalGifts + ' (' + giftDetails.map(g => g.qty + ' ' + g.type).join(' + ') + ')</div>' : '') +
    '<div class="invoice-grand-box"><span>الإجمالي</span><span>' + grandTotal.toLocaleString() + ' د.ع</span></div>' +
    '<div class="invoice-footer">شكراً لتعاملكم معنا</div>' +
    '</div></div>' +
    '<button class="btn btn-print" onclick="printInvoice()" style="margin-top:10px;"' + (invoiceNum ? '' : ' disabled') + '>طباعة الفاتورة</button>';
}
function printInvoice() {
  const content = document.getElementById('printInvoice').innerHTML;
  const win = window.open('', '_blank');
  win.document.write('<html dir="rtl"><head><title>فاتورة</title><style>' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;padding:0;margin:0;background:#eef0f3;color:#1a1f36;}' +
    '.invoice-preview{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.06);overflow:hidden;max-width:640px;margin:20px auto;}' +
    '.invoice-accent{height:6px;background:#1a1f36;}' +
    '.invoice-body{padding:28px;}' +
    '.invoice-topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;}' +
    '.invoice-title{font-size:1.05rem;font-weight:800;color:#1a1f36;}' +
    '.invoice-badge{background:#1a1f36;color:#fff;font-size:0.62rem;padding:4px 10px;border-radius:20px;font-weight:600;}' +
    '.ltr-num{direction:ltr;unicode-bidi:isolate;display:inline-block;}' +
    '.invoice-details{display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#f9fafb;border-radius:10px;padding:13px;margin-bottom:16px;}' +
    '.invoice-label{font-size:0.6rem;color:#99a1af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;display:block;}' +
    '.invoice-value{font-size:0.75rem;font-weight:600;color:#1a1f36;}' +
    '.invoice-sub{font-size:0.68rem;color:#666;margin-top:2px;}' +
    'table{width:100%;border-collapse:collapse;margin-bottom:14px;}' +
    'th{color:#99a1af;padding:6px;font-size:0.62rem;text-transform:uppercase;border-bottom:2px solid #1a1f36;}' +
    'td{padding:9px 6px;border-bottom:1px solid #eee;font-size:0.74rem;text-align:center;}' +
    '.invoice-gift-line{font-size:0.68rem;color:#99a1af;text-align:left;margin-bottom:8px;}' +
    '.invoice-grand-box{background:#1a1f36;color:#fff;border-radius:10px;padding:11px 15px;display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;font-weight:700;margin-bottom:6px;}' +
    '.invoice-footer{text-align:center;margin-top:18px;font-size:0.66rem;color:#99a1af;}' +
    '</style></head><body>' + content + '</body></html>');
  win.document.close();
  win.print();
}

// ===== الإحصائيات =====
function updateStats() {
  const today = getTodayString();
  const todayOrders = orders.filter(o => o.date === today);
  const todayRevenue = todayOrders.reduce((s, o) => s + o.totalRevenue, 0);
  const todayCost = todayOrders.reduce((s, o) => s + o.totalCost, 0);
  const todayProfit = todayOrders.reduce((s, o) => s + o.totalProfit, 0);
  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const allProfit = orders.reduce((s, o) => s + o.totalProfit, 0);
  document.getElementById('todayOrders').textContent = todayOrders.length;
  document.getElementById('todayRevenue').textContent = todayRevenue.toLocaleString();
  document.getElementById('todayCost').textContent = todayCost.toLocaleString();
  document.getElementById('todayProfit').textContent = todayProfit.toLocaleString();
  document.getElementById('todayProfitBox').className = 'stat-box ' + (todayProfit >= 0 ? 'green' : 'red');
  document.getElementById('pendingOrders').textContent = pendingCount;
  document.getElementById('allTimeProfit').textContent = allProfit.toLocaleString();
}

// ===== التهيئة =====
document.getElementById('orderDate').value = getTodayString();
checkLoginState();
updateShopSelect();
updateInvoiceShopSelect();
updateRepSelect();
updateJuiceTypeSelect();
updateCakeTypeSelect();
updateOtherTypeSelect();
const needsDateEl = document.getElementById('needsDate');
if(needsDateEl) needsDateEl.value = getTodayString();
updateStats();

// فحص الساعة 9 مساءً
setInterval(() => {
  const now = new Date();
  if(now.getHours() === 21 && now.getMinutes() === 0) {
    generateNightReport();
  }
}, 60000);
