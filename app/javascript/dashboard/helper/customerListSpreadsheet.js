// Reads a customer list exported from an ERP (.xlsx or .csv) entirely in the
// browser and keeps only what is needed to find the contacts: the customer code
// and the phone numbers. Names, documents (CPF/CNPJ) and anything else never
// leave the browser (LGPD).

const HEADER_SCAN_LIMIT = 30;
const SAMPLE_SIZE = 50;
const CODE_REGEX = /^\d{1,9}(\.0+)?$/;
const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 13;

export const normalizeHeader = value =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const toText = value => {
  const text = String(value ?? '').trim();
  // Large numbers written by spreadsheets in scientific notation (1.19E+10)
  if (/^\d+(\.\d+)?e\+?\d+$/i.test(text)) return Number(text).toFixed(0);
  return text;
};

export const normalizeCode = value => {
  const text = toText(value).replace(/\.0+$/, '');
  return /^\d+$/.test(text) ? text.replace(/^0+(?=\d)/, '') : '';
};

const isCode = value => CODE_REGEX.test(toText(value));

export const extractPhones = value =>
  toText(value)
    .split(/[/;,|]| e /)
    .map(part => part.replace(/\D/g, ''))
    .filter(
      digits =>
        digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS
    );

const isCpf = digits => {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const check = length => {
    const sum = digits
      .slice(0, length)
      .split('')
      .reduce(
        (acc, digit, index) => acc + Number(digit) * (length + 1 - index),
        0
      );
    const rest = (sum * 10) % 11;
    return (rest === 10 ? 0 : rest) === Number(digits[length]);
  };
  return check(9) && check(10);
};

const looksLikePhone = value => {
  const text = toText(value);
  // Documents usually keep their punctuation (123.456.789-00, 12.345.678/0001-90)
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{2}\.\d{3}\.\d{3}\//.test(text)) {
    return false;
  }
  const digits = text.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13 && !isCpf(digits);
};

const majority = (values, predicate) => {
  const filled = values.filter(value => toText(value) !== '');
  if (!filled.length) return false;
  return filled.filter(predicate).length / filled.length >= 0.6;
};

const columnValues = (rows, index) =>
  rows.slice(0, SAMPLE_SIZE).map(row => row[index]);

const HEADER_CODE = /^(cod|codigo)( (do )?cliente)?$|^codigo$/;
// Short header cells only, so a title row like "Fone: (11) 3333-4444" is not taken as the header.
const HEADER_PHONE =
  /^(fone|telefone|tel|celular|cel|whatsapp|whats)( [a-z]+)?( \d)?$/;

const findHeader = rows => {
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
  for (let index = 0; index < limit; index += 1) {
    const headers = rows[index].map(normalizeHeader);
    const codeColumn = headers.findIndex(header => HEADER_CODE.test(header));
    const phoneColumns = headers
      .map((header, column) => (HEADER_PHONE.test(header) ? column : -1))
      .filter(column => column >= 0);
    if (codeColumn >= 0 || phoneColumns.length) {
      return { index, codeColumn, phoneColumns };
    }
  }
  return null;
};

const detectColumns = rows => {
  const width = Math.max(0, ...rows.slice(0, SAMPLE_SIZE).map(r => r.length));
  let codeColumn = -1;
  const phoneColumns = [];
  for (let column = 0; column < width; column += 1) {
    const values = columnValues(rows, column);
    if (codeColumn < 0 && majority(values, isCode)) {
      codeColumn = column;
    } else if (majority(values, looksLikePhone)) {
      phoneColumns.push(column);
    }
  }
  return { codeColumn, phoneColumns };
};

/**
 * Turns the raw rows of a spreadsheet into [{ code, phones }].
 * Supports the ERP report (title rows + header starting with "Código"), a
 * headerless sheet (code, name, CPF, phone) and a simple CSV with a header.
 */
export const extractCustomerRows = rawRows => {
  const rows = rawRows.filter(row => row.some(cell => toText(cell) !== ''));
  const header = findHeader(rows);
  const dataRows = header ? rows.slice(header.index + 1) : rows;
  const columns = header || detectColumns(dataRows);
  const { codeColumn, phoneColumns } = columns;

  const customers = [];
  const seen = new Set();
  dataRows.forEach(row => {
    const hasCodeColumn = codeColumn >= 0;
    // ERP reports wrap long records onto extra rows that have no code: skip them.
    if (hasCodeColumn && !isCode(row[codeColumn])) return;

    const code = hasCodeColumn ? normalizeCode(row[codeColumn]) : '';
    const phones = [
      ...new Set(phoneColumns.flatMap(column => extractPhones(row[column]))),
    ];
    if (!code && !phones.length) return;

    const key = code || phones.join(',');
    if (seen.has(key)) return;
    seen.add(key);
    customers.push({ code, phones });
  });

  return {
    customers,
    codeColumn,
    phoneColumns,
    withCode: customers.filter(customer => customer.code).length,
    phoneOnly: customers.filter(customer => !customer.code).length,
  };
};

// ---------- CSV ----------

const decodeText = buffer => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
};

export const parseCsv = text => {
  const content = text.replace(/^\uFEFF/, '');
  const firstLine = content.split(/\r?\n/, 1)[0] || '';
  const delimiter = [';', '\t', ','].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length
      ? candidate
      : best
  );

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    if (quoted) {
      if (char === '"' && content[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};

// ---------- XLSX (zip + XML, no external dependency) ----------

const readStream = async stream => {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const output = new Uint8Array(total);
  let offset = 0;
  chunks.forEach(chunk => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
};

const inflateRaw = data => {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  return readStream(source.pipeThrough(new DecompressionStream('deflate-raw')));
};

export const unzip = async buffer => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error('INVALID_FILE');

  const entries = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  const files = {};
  const decoder = new TextDecoder();
  for (let entry = 0; entry < entries; entry += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) break;
    const method = view.getUint16(pointer + 10, true);
    const size = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);
    const name = decoder.decode(
      bytes.subarray(pointer + 46, pointer + 46 + nameLength)
    );
    const dataStart =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    files[name] = { method, data: bytes.subarray(dataStart, dataStart + size) };
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return async name => {
    const file = files[name];
    if (!file) return null;
    const content = file.method === 0 ? file.data : await inflateRaw(file.data);
    return decoder.decode(content);
  };
};

const parseXml = text =>
  new DOMParser().parseFromString(text, 'application/xml');
const byTag = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag));
const textOf = node =>
  byTag(node, 't')
    .map(t => t.textContent)
    .join('');

const columnIndex = reference => {
  const letters = (reference || '').replace(/[^A-Z]/gi, '').toUpperCase();
  return (
    letters
      .split('')
      .reduce((acc, letter) => acc * 26 + letter.charCodeAt(0) - 64, 0) - 1
  );
};

const firstSheetPath = async readFile => {
  const workbook = await readFile('xl/workbook.xml');
  const rels = await readFile('xl/_rels/workbook.xml.rels');
  if (workbook && rels) {
    const sheet = byTag(parseXml(workbook), 'sheet')[0];
    const relId =
      sheet?.getAttribute('r:id') ||
      sheet?.getAttributeNS(
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'id'
      );
    const target = byTag(parseXml(rels), 'Relationship')
      .find(rel => rel.getAttribute('Id') === relId)
      ?.getAttribute('Target');
    if (target) {
      return target.startsWith('/')
        ? target.slice(1)
        : `xl/${target.replace(/^\.\//, '')}`;
    }
  }
  return 'xl/worksheets/sheet1.xml';
};

export const parseXlsx = async buffer => {
  const readFile = await unzip(buffer);
  const sharedXml = await readFile('xl/sharedStrings.xml');
  const shared = sharedXml ? byTag(parseXml(sharedXml), 'si').map(textOf) : [];
  const sheetXml = await readFile(await firstSheetPath(readFile));
  if (!sheetXml) throw new Error('INVALID_FILE');

  return byTag(parseXml(sheetXml), 'row').map(rowNode => {
    const row = [];
    byTag(rowNode, 'c').forEach(cellNode => {
      const reference = cellNode.getAttribute('r');
      const index = reference ? columnIndex(reference) : row.length;
      const type = cellNode.getAttribute('t');
      const raw = byTag(cellNode, 'v')[0]?.textContent ?? '';
      let value = raw;
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textOf(cellNode);
      row[index] = value;
    });
    return Array.from(row, cell => cell ?? '');
  });
};

const readAsArrayBuffer = file =>
  file.arrayBuffer
    ? file.arrayBuffer()
    : new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });

/** Reads a File (.xlsx or .csv) and returns the customers found in it. */
export const readCustomerList = async file => {
  const name = (file.name || '').toLowerCase();
  const buffer = await readAsArrayBuffer(file);
  let rows;
  if (name.endsWith('.xlsx')) {
    rows = await parseXlsx(buffer);
  } else if (name.endsWith('.csv') || name.endsWith('.txt')) {
    rows = parseCsv(decodeText(buffer));
  } else {
    throw new Error('UNSUPPORTED_FORMAT');
  }
  return extractCustomerRows(rows);
};

export const slugifyLabel = value =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const buildNotFoundCsv = codes =>
  ['codigo_ou_telefone', ...codes.map(code => `"${String(code)}"`)].join('\n');
