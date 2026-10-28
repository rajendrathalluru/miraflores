import { workingValue, type Packet, type Row, type WorkState } from './types';
import { workingReference } from './review';
export function salesRows(packet: Packet, version: Row, state?: WorkState) {
  const ev = new Map(packet.extracted_values.map((e) => [e.id, e]));
  return version.lines
    .filter((l: Row) => l.form === 'F8949' && l.rule === 'R-8949-LOT')
    .map((l: Row) => {
      const values = (l.sources || []).map((r: string) => ev.get(r)).filter(Boolean);
      const parse = (name: string) => {
        const source = values.find((e: Row) => e.field.endsWith('_' + name));
        if (source) {
          const value = state
            ? workingReference(source.value, source.id, state, version.version)
            : source.value;
          return typeof value === 'number' ? value : null;
        }
        const m = l.label.match(new RegExp(name + ' ([\\d,.-]+)', 'i'));
        return m ? Number(m[1].replace(/,/g, '')) : null;
      };
      return {
        ...l,
        proceeds: parse('proceeds'),
        proceedsRef: values.find((e: Row) => e.field.endsWith('_proceeds'))?.id,
        basisRef: values.find((e: Row) => e.field.endsWith('_basis'))?.id,
        basis: parse('basis'),
        sourceDocument: values[0]?.document_id || 'Unlinked',
        gain: state ? workingValue(l, state, version.version) : l.value,
      };
    });
}
