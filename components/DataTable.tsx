"use client";
import { useState, useRef, useEffect } from "react";
import { Plus, X, BarChart3 } from "lucide-react";
import { NoteBlock } from "@/lib/types";

interface CellFormatting {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  bgColor?: string;
}

interface DataTableProps {
  block: NoteBlock;
  onUpdate: (updates: Partial<NoteBlock>) => void;
  onCreateChart?: (tableId: string, columns: string[]) => void;
}

// contentEditable cell that syncs value in/out without fighting the cursor
const CellDiv = ({
  value,
  onCommit,
  onFocus,
  style,
  className,
  placeholder,
}: {
  value: string;
  onCommit: (html: string) => void;
  onFocus: () => void;
  style?: React.CSSProperties;
  className: string;
  placeholder: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (ref.current && !isFocused.current) {
      if (ref.current.innerHTML !== value) {
        ref.current.innerHTML = value;
      }
    }
  }, [value]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      style={style}
      onFocus={() => { isFocused.current = true; onFocus(); }}
      onBlur={(e) => { isFocused.current = false; onCommit(e.currentTarget.innerHTML); }}
      onInput={(e) => onCommit(e.currentTarget.innerHTML)}
      className={`${className} outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/30 empty:before:pointer-events-none`}
    />
  );
};

const DataTable = ({ block, onUpdate, onCreateChart }: DataTableProps) => {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const tableData = block.tableData || [["Name", "Value"], ["", ""]];
  const cellFormattingMap = (block.cellFormattingMap as Record<string, CellFormatting>) || {};

  const getCellKey = (row: number, col: number) => `${row}-${col}`;
  const getCellFormatting = (row: number, col: number) => cellFormattingMap[getCellKey(row, col)];

  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, "");

  const getColumnWidth = (colIndex: number) => {

    const getMaxLineLength = (html: string) => {

      if (!html) return 0;

      let text = html;

      // convert block elements to line breaks
      text = text.replace(/<\/?(div|p)[^>]*>/gi, "\n");
      text = text.replace(/<br\s*\/?>/gi, "\n");

      // remove remaining html
      text = stripHtml(text);

      // fix nbsp
      text = text.replace(/\u00A0/g, " ");

      const lines = text.split("\n");

      let longest = 0;

      for (const line of lines) {
        const len = line.trim().length;
        if (len > longest) longest = len;
      }

      return longest;
    };

    const maxLength = Math.max(
      getMaxLineLength(tableData[0]?.[colIndex] || ""),
      ...tableData.slice(1).map(row => getMaxLineLength(row[colIndex] || ""))
    );

    const baseWidth = Math.max(80, maxLength * 8 + 24);

    return `${baseWidth}px`;
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const newTableData = tableData.map((row, rIdx) =>
      row.map((cell, cIdx) => (rIdx === rowIndex && cIdx === colIndex ? value : cell))
    );
    onUpdate({ tableData: newTableData });
  };

  const addRow = () => {
    const newRow = Array(tableData[0]?.length || 3).fill("");
    const insertAfter = selectedCell ? selectedCell.row : tableData.length - 1;
    const insertAt = Math.max(1, insertAfter + 1);
    const newTableData = [
      ...tableData.slice(0, insertAt),
      newRow,
      ...tableData.slice(insertAt),
    ];
    onUpdate({ tableData: newTableData });
  };

  const addColumn = () => {
    const insertAfter = selectedCell ? selectedCell.col : (tableData[0]?.length ?? 1) - 1;
    const insertAt = insertAfter + 1;
    const newTableData = tableData.map((row) => [
      ...row.slice(0, insertAt),
      "",
      ...row.slice(insertAt),
    ]);
    onUpdate({ tableData: newTableData });
  };

  const deleteRow = (rowIndex: number) => {
    if (tableData.length <= 2) return;
    const newTableData = tableData.filter((_, idx) => idx !== rowIndex);
    onUpdate({ tableData: newTableData });
  };

  const deleteColumn = (colIndex: number) => {
    if (tableData[0]?.length <= 1) return;
    const newTableData = tableData.map((row) => row.filter((_, idx) => idx !== colIndex));
    onUpdate({ tableData: newTableData });
  };

  const getCellStyle = (formatting?: CellFormatting): React.CSSProperties => ({
    fontWeight: formatting?.bold ? "600" : "400",
    fontStyle: formatting?.italic ? "italic" : "normal",
    color: formatting?.color || "inherit",
    backgroundColor: formatting?.bgColor || "transparent",
  });

  const getChartColumns = () => {
    const headers = tableData[0] || [];
    return headers.filter((_, idx) => idx > 0);
  };

  return (
    <div className="py-3 space-y-3">
      <div
        ref={tableContainerRef}
        className="border border-border rounded-lg overflow-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      >
        <table className="border-collapse w-full" style={{ tableLayout: "auto" }}>
          <thead>
            <tr className="bg-linear-to-r from-primary/10 to-primary/5 sticky top-0 z-10">
              {tableData[0]?.map((header, colIndex) => (
                <th
                  key={colIndex}
                  style={{ width: getColumnWidth(colIndex), minWidth: getColumnWidth(colIndex) }}
                  className="px-4 py-3 text-left text-sm font-bold border-r border-border last:border-r-0 group/col hover:bg-primary/10 transition-colors relative"
                >
                  <CellDiv
                    value={header}
                    onCommit={(val) => updateCell(0, colIndex, val)}
                    onFocus={() => setSelectedCell({ row: 0, col: colIndex })}
                    style={getCellStyle(getCellFormatting(0, colIndex))}
                    className="w-full bg-transparent font-semibold text-sm"
                    placeholder="Column..."
                  />
                  {tableData[0].length > 1 && (
                    <button
                      onClick={() => deleteColumn(colIndex)}
                      className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/col:opacity-100 p-1 bg-background rounded-full border border-border hover:bg-destructive/10 transition-all"
                    >
                      <X className="w-3 h-3 text-destructive" />
                    </button>
                  )}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {tableData.slice(1).map((row, rowIndex) => (
              <tr
                key={rowIndex + 1}
                className="border-t border-border hover:bg-muted/30 transition-colors group/row"
              >
                {row.map((cell, colIndex) => {
                  const formatting = getCellFormatting(rowIndex + 1, colIndex);
                  const isSelected =
                    selectedCell?.row === rowIndex + 1 && selectedCell?.col === colIndex;

                  return (
                    <td
                      key={colIndex}
                      style={{ width: getColumnWidth(colIndex), minWidth: getColumnWidth(colIndex) }}
                      className={`px-4 py-2 border-r border-border last:border-r-0 relative ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary" : ""
                        }`}
                    >
                      <CellDiv
                        value={cell}
                        onCommit={(val) => updateCell(rowIndex + 1, colIndex, val)}
                        onFocus={() => setSelectedCell({ row: rowIndex + 1, col: colIndex })}
                        style={getCellStyle(formatting)}
                        className="w-full bg-transparent text-sm py-1 px-1 rounded"
                        placeholder="..."
                      />
                    </td>
                  );
                })}
                <td className="opacity-0 group-hover/row:opacity-100 transition-opacity">
                  <button
                    onClick={() => deleteRow(rowIndex + 1)}
                    className="p-1 hover:bg-destructive/10 rounded"
                  >
                    <X className="w-3 h-3 text-destructive" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={addRow}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add row
        </button>
        <button
          onClick={addColumn}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add column
        </button>
        {tableData.length > 1 && getChartColumns().length > 0 && (
          <button
            onClick={() => { if (onCreateChart) onCreateChart(block.id, getChartColumns()); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors ml-auto"
          >
            <BarChart3 className="w-3 h-3" />
            Link to chart
          </button>
        )}
      </div>
    </div>
  );
};

export default DataTable;