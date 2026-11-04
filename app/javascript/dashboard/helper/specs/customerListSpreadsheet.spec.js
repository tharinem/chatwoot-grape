import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  buildNotFoundCsv,
  extractCustomerRows,
  extractPhones,
  normalizeCode,
  parseCsv,
  parseXlsx,
  readCustomerList,
  slugifyLabel,
} from '../customerListSpreadsheet';

const fixture = name => {
  const file = readFileSync(resolve(__dirname, 'fixtures', name));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
};

const fakeFile = (name, content) => ({
  name,
  arrayBuffer: () =>
    Promise.resolve(
      typeof content === 'string'
        ? new TextEncoder().encode(content).buffer
        : content
    ),
});

describe('customerListSpreadsheet', () => {
  describe('normalizeCode', () => {
    it('normalizes numeric codes coming from spreadsheets', () => {
      expect(normalizeCode('1234.0')).toBe('1234');
      expect(normalizeCode(1234)).toBe('1234');
      expect(normalizeCode('0077')).toBe('77');
      expect(normalizeCode('continuação')).toBe('');
    });
  });

  describe('extractPhones', () => {
    it('keeps only digits and splits multiple numbers in one cell', () => {
      expect(extractPhones('(11) 98765-4321 / (11) 3333-4444')).toEqual([
        '11987654321',
        '1133334444',
      ]);
      expect(extractPhones('1.1987654321E10')).toEqual(['11987654321']);
      expect(extractPhones('123')).toEqual([]);
    });
  });

  describe('parseXlsx + extractCustomerRows', () => {
    it('reads the ERP "Clientes e Fornecedores - Simples" report', async () => {
      const rows = await parseXlsx(fixture('erp-clientes-simples.xlsx'));
      const result = extractCustomerRows(rows);

      expect(result.codeColumn).toBe(0);
      expect(result.phoneColumns).toEqual([5, 6]);
      expect(result.customers).toEqual([
        { code: '1234', phones: ['11987654321'] },
        { code: '77', phones: ['4733334444', '47933335555'] },
        { code: '501', phones: [] },
      ]);
    });

    it('reads a headerless sheet (code, name, CPF, phone) ignoring the CPF', async () => {
      const rows = await parseXlsx(fixture('sem-cabecalho.xlsx'));
      const result = extractCustomerRows(rows);

      expect(result.codeColumn).toBe(0);
      expect(result.phoneColumns).toEqual([3]);
      expect(result.customers).toEqual([
        { code: '10', phones: ['11987650001'] },
        { code: '11', phones: ['21998760002'] },
        { code: '12', phones: ['48999990003'] },
      ]);
    });

    it('detects sparse phone columns mixed with fragments in a headerless sheet', async () => {
      // Shaped like the real "LDN" export: phones spread over columns 4, 6 and 7,
      // mixed with 1/2/4/9 digit fragments, next to a CPF/CNPJ column.
      const rows = await parseXlsx(
        fixture('sem-cabecalho-telefones-esparsos.xlsx')
      );
      const result = extractCustomerRows(rows);

      expect(result.codeColumn).toBe(0);
      expect(result.phoneColumns).toEqual([4, 6, 7]);
      expect(result.customers).toHaveLength(60);
      const withPhone = result.customers.filter(c => c.phones.length);
      expect(withPhone).toHaveLength(40);
      result.customers
        .flatMap(c => c.phones)
        .forEach(phone => {
          expect(phone.length).toBeGreaterThanOrEqual(10);
          expect(phone.length).toBeLessThanOrEqual(13);
        });
    });

    it('never returns names or documents', async () => {
      const rows = await parseXlsx(fixture('erp-clientes-simples.xlsx'));
      const serialized = JSON.stringify(extractCustomerRows(rows).customers);

      expect(serialized).not.toContain('Cliente');
      expect(serialized).not.toContain('123.456.789');
      expect(serialized).not.toContain('12345678909');
    });
  });

  describe('parseCsv', () => {
    it('parses a semicolon CSV with header codigo/telefone', () => {
      const csv =
        'Código;Nome;Telefone\n"1234";"Silva; Maria";(11) 98765-4321\n55;João;\n';
      const result = extractCustomerRows(parseCsv(csv));

      expect(result.customers).toEqual([
        { code: '1234', phones: ['11987654321'] },
        { code: '55', phones: [] },
      ]);
      expect(result.withCode).toBe(2);
    });

    it('accepts a phone-only CSV', () => {
      const csv = 'nome,telefone\nAna,11987654321\nBia,+55 48 99999-0000\n';
      const result = extractCustomerRows(parseCsv(csv));

      expect(result.customers).toEqual([
        { code: '', phones: ['11987654321'] },
        { code: '', phones: ['5548999990000'] },
      ]);
      expect(result.phoneOnly).toBe(2);
    });
  });

  describe('readCustomerList', () => {
    it('handles .csv files encoded in windows-1252', async () => {
      const bytes = new Uint8Array([
        ...new TextEncoder().encode('C'),
        0xf3, // ó in windows-1252
        ...new TextEncoder().encode('digo;Telefone\n42;11987654321\n'),
      ]);
      const result = await readCustomerList(
        fakeFile('lista.csv', bytes.buffer)
      );

      expect(result.customers).toEqual([
        { code: '42', phones: ['11987654321'] },
      ]);
    });

    it('handles .xlsx files', async () => {
      const result = await readCustomerList(
        fakeFile('Lista.XLSX', fixture('sem-cabecalho.xlsx'))
      );

      expect(result.customers).toHaveLength(3);
    });

    it('rejects other formats', async () => {
      await expect(readCustomerList(fakeFile('lista.xls', ''))).rejects.toThrow(
        'UNSUPPORTED_FORMAT'
      );
    });
  });

  describe('slugifyLabel', () => {
    it('builds a lowercase hyphenated label', () => {
      expect(slugifyLabel('  Lista da Semana Março ')).toBe(
        'lista-da-semana-marco'
      );
      expect(slugifyLabel('cliente_antigo')).toBe('cliente_antigo');
    });
  });

  describe('buildNotFoundCsv', () => {
    it('lists the codes not found', () => {
      expect(buildNotFoundCsv(['12', '11999990000'])).toBe(
        'codigo_ou_telefone\n"12"\n"11999990000"'
      );
    });
  });
});
