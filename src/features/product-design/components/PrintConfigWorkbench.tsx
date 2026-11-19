import type { ReactNode } from "react";

/**
 * The working area under the page band. On a wide screen the file work sits in a narrow column on the left and the
 * model on the right; the model column stays in view while the left one scrolls (it scrolls inside itself when taller
 * than the screen), so what was read and the model are seen together. On a narrower screen it is one column, with the
 * model right after the file and the rest under it.
 *
 * The page scrolls inside `<main>` (`BackofficeShell`: `p-4`, under a `h-14` top bar): the model column sticks 1rem
 * below the top bar and is at most the screen minus the bar and both paddings.
 */
export function PrintConfigWorkbench({
  file,
  view,
  rest,
}: {
  /** The file card: choose, read, checks, what was read. */
  file: ReactNode;
  /** The model and its print sheets, or what to look at while there is no file. */
  view: ReactNode;
  /** The cards after the work: defaults, the saved configuration. */
  rest?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 [grid-template-areas:'file'_'view'_'rest'] xl:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:[grid-template-areas:'file_view'_'rest_view']">
      <div className="min-w-0 space-y-5 [grid-area:file]">{file}</div>
      <div className="min-w-0 [grid-area:view] xl:sticky xl:top-4 xl:max-h-[calc(100svh-(--spacing(22)))] xl:self-start xl:overflow-y-auto">
        {view}
      </div>
      {rest && <div className="min-w-0 space-y-5 self-start [grid-area:rest]">{rest}</div>}
    </div>
  );
}
