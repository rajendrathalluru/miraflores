import type { Packet, Row } from './types';
export function salesRows(packet: Packet, version: Row) {
  const ev = new Map(packet.extracted_values.map((e) => [e.id, e]));
  return version.lines
    .filter((l: Row) => l.form === 'F8949' && l.rule === 'R-8949-LOT')
    .map((l: Row) => {
      const values = (l.sources || []).map((r: string) => ev.get(r)).filter(Boolean);
      const parse = (name: string) => {
        const source = values.find((e: Row) => e.field.endsWith('_' + name));
        if (source && typeof source.value === 'number') return source.value;
        const m = l.label.match(new RegExp(name + ' ([\\d,.-]+)', 'i'));
        return m ? Number(m[1].replace(/,/g, '')) : null;
      };
      return {
        ...l,
        proceeds: parse('proceeds'),
        basis: parse('basis'),
        sourceDocument: values[0]?.document_id || 'Unlinked',
        gain: l.value,
      };
    });
}
