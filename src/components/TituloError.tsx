// Primera línea de un mensaje de error: ícono de aviso + texto en negritas.
// Se usa dentro de una caja con la clase "caja-error" (ver src/app/globals.css).
// El ícono distingue los errores del rojo de marca de los botones.

export function IconoAlerta({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`inline-block h-6 w-6 shrink-0 ${className}`}
    >
      <path d="M10.3 3.9 1.8 18.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export default function TituloError({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 font-semibold">
      <IconoAlerta className="mt-0.5" />
      <span>
        <span className="sr-only">Error: </span>
        {children}
      </span>
    </p>
  );
}
