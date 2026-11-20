// Lector de CSV propio (sin librería). SOLO SERVIDOR: lo usan los scripts de
// scripts/etapa2/. Nunca se importa desde la app.
//
// Maneja lo que trae el paquete del SCA:
//   - BOM de UTF-8 al inicio (se quita).
//   - Saltos de línea de Windows (CRLF), de Unix (LF) o viejos de Mac (CR).
//   - Campos entre comillas que traen comas, saltos de línea o comillas dobles
//     escapadas ("" dentro de un campo entre comillas = una comilla).
// Nunca convierte valores: todo sale como TEXTO (así una clave nunca se vuelve
// número).

export type FilaCsv = {
  /** Número de renglón del archivo donde EMPIEZA la fila (1 = encabezados). */
  renglon: number;
  campos: string[];
};

export class ErrorCsv extends Error {
  renglon: number;
  constructor(mensaje: string, renglon: number) {
    super(`${mensaje} (renglón ${renglon})`);
    this.name = "ErrorCsv";
    this.renglon = renglon;
  }
}

export function leerCsv(texto: string): FilaCsv[] {
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);

  const filas: FilaCsv[] = [];
  let campos: string[] = [];
  let campo = "";
  let entreComillas = false;
  let campoConComillas = false; // el campo actual empezó con comilla
  let despuesDeComilla = false; // se cerró la comilla; solo puede seguir , o fin de línea
  let renglon = 1;
  let renglonInicio = 1;

  const cerrarCampo = () => {
    campos.push(campo);
    campo = "";
    campoConComillas = false;
    despuesDeComilla = false;
  };
  const cerrarFila = () => {
    cerrarCampo();
    // Una línea totalmente vacía (ej. la última del archivo) no es una fila.
    if (!(campos.length === 1 && campos[0] === "")) {
      filas.push({ renglon: renglonInicio, campos });
    }
    campos = [];
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreComillas = false;
          despuesDeComilla = true;
        }
      } else {
        if (c === "\n" || (c === "\r" && texto[i + 1] !== "\n")) renglon++;
        campo += c;
      }
      continue;
    }

    if (c === ",") {
      cerrarCampo();
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      cerrarFila();
      renglon++;
      renglonInicio = renglon;
    } else if (despuesDeComilla) {
      throw new ErrorCsv("Texto después de cerrar comillas", renglon);
    } else if (c === '"') {
      if (campo !== "" || campoConComillas) {
        throw new ErrorCsv("Comilla en medio de un campo sin comillas", renglon);
      }
      entreComillas = true;
      campoConComillas = true;
    } else {
      campo += c;
    }
  }

  if (entreComillas) throw new ErrorCsv("Comillas sin cerrar al final del archivo", renglonInicio);
  if (campo !== "" || campos.length > 0 || campoConComillas) cerrarFila();

  return filas;
}
