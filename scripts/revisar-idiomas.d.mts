// Tipos de scripts/revisar-idiomas.mjs (lo usa tests/idiomas.test.ts).
export interface Hallazgo { archivo: string; texto: string }
export interface Revision { nombre: string; total: number; faltan: Hallazgo[]; variables: Hallazgo[]; sueltos: Hallazgo[] }
export function revisar(): Revision[];
export function clavesDe(codigo: string): string[];
export function sinTraducir(codigo: string): { linea: number; texto: string }[];
