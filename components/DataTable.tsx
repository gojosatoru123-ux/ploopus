"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  X,
  Bold,
  Italic,
  Palette,
  Link2,
  BarChart3,
  Copy,
  ChevronDown,
} from "lucide-react";
import { NoteBlock } from "@/lib/types";

interface CellFormatting {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  bgColor?: string;
}

interface CellData {
  value: string;
  formatting?: CellFormatting;
}

interface DataTableProps {
  block: NoteBlock;
  onUpdate: (updates: Partial<NoteBlock>) => void;
  onCreateChart?: (tableId: string, columns: string[]) => void;
}

const colorOptions = [
  { name: "Default", value: "" },
  { name: "Red", value: "#ef4444" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Yellow", value: "#eab308" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
];

const DataTable = ({ block, onUpdate, onCreateChart }: DataTableProps) => {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<{ top: number; left: number } | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [openColorMenu, setOpenColorMenu] = useState<"text" | "bg" | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Compatibility: convert old tableData to new cellData format if needed
  const tableData = block.tableData || [["Name", "Value"], ["", ""]];
  const cellFormattingMap = (block.cellFormattingMap as Record<string, CellFormatting>) || {};

  const getCellKey = (row: number, col: number) => `${row}-${col}`;
  const getCellFormatting = (row: number, col: number) => cellFormattingMap[getCellKey(row, col)];

  // Calculate max width needed for each column based on content
  const getColumnWidth = (colIndex: number) => {
    const maxLength = Math.max(
      tableData[0]?.[colIndex]?.length || 0,
      ...tableData.slice(1).map((row) => row[colIndex]?.length || 0)
    );
    // Estimate: ~8 pixels per character + padding
    const baseWidth = Math.max(80, maxLength * 8 + 24);
    return `${baseWidth}px`;
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const newTableData = tableData.map((row, rIdx) =>
      row.map((cell, cIdx) => (rIdx === rowIndex && cIdx === colIndex ? value : cell))
    );
    onUpdate({ tableData: newTableData });
  };

  const updateCellFormatting = (rowIndex: number, colIndex: number, formatting: Partial<CellFormatting>) => {
    const key = getCellKey(rowIndex, colIndex);
    const newMap = {
      ...cellFormattingMap,
      [key]: { ...getCellFormatting(rowIndex, colIndex), ...formatting },
    };
    onUpdate({ cellFormattingMap: newMap });
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
    if (tableData.length <= 2) return; // Keep at least header and one row
    const newTableData = tableData.filter((_, idx) => idx !== rowIndex);
    onUpdate({ tableData: newTableData });
  };

  const deleteColumn = (colIndex: number) => {
    if (tableData[0]?.length <= 1) return; // Keep at least one column
    const newTableData = tableData.map((row) => row.filter((_, idx) => idx !== colIndex));
    onUpdate({ tableData: newTableData });
  };

  const getCellStyle = (formatting?: CellFormatting) => ({
    fontWeight: formatting?.bold ? "600" : "400",
    fontStyle: formatting?.italic ? "italic" : "normal",
    color: formatting?.color || "inherit",
    backgroundColor: formatting?.bgColor || "transparent",
  });

  const getChartColumns = () => {
    const headers = tableData[0] || [];
    return headers.filter((_, idx) => idx > 0); // Skip first column (usually labels)
  };

  // Handle cell selection and show toolbar
  const handleCellClick = (e: React.MouseEvent<HTMLTableCellElement>, rowIndex: number, colIndex: number) => {
    // If clicking the same cell again, deselect it
    if (selectedCell?.row === rowIndex && selectedCell?.col === colIndex) {
      setSelectedCell(null);
      setToolbarVisible(false);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    setToolbarPosition({
      top: rect.top - 60,
      left: rect.left + rect.width / 2,
    });

    setSelectedCell({ row: rowIndex, col: colIndex });
    setOpenColorMenu(null);

    // Check visibility immediately
    checkToolbarVisibility(rowIndex, colIndex);
  };

  // Check if the selected cell is visible in the table container viewport
  const checkToolbarVisibility = (rowIndex: number, colIndex: number) => {
    if (!tableContainerRef.current) {
      setToolbarVisible(false);
      return;
    }

    try {
      // Find the selected cell element
      const rows = tableContainerRef.current.querySelectorAll("tbody tr");
      const targetRow = rows[rowIndex - 1];

      if (!targetRow) {
        setToolbarVisible(false);
        return;
      }

      const cells = targetRow.querySelectorAll("td");
      const cellInRow = cells[colIndex];

      if (!cellInRow) {
        setToolbarVisible(false);
        return;
      }

      const cellRect = (cellInRow as HTMLElement).getBoundingClientRect();
      const containerRect = tableContainerRef.current.getBoundingClientRect();

      // Check if cell is within the visible bounds of the table container
      // Use a small buffer to account for toolbar height
      const isVisible =
        cellRect.top >= containerRect.top - 70 &&
        cellRect.bottom <= containerRect.bottom &&
        cellRect.left >= containerRect.left &&
        cellRect.right <= containerRect.right;

      setToolbarVisible(isVisible);
    } catch (error) {
      setToolbarVisible(false);
    }
  };

  // Monitor scroll to hide/show toolbar and handle clicks outside
  useEffect(() => {
    if (!selectedCell) return;

    const handleScroll = () => {
      checkToolbarVisibility(selectedCell.row, selectedCell.col);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if click is on the toolbar or a table cell
      const isToolbarClick = toolbarRef.current?.contains(target);
      const isTableClick = tableContainerRef.current?.contains(target);

      // If clicked outside both toolbar and table, hide toolbar
      if (!isToolbarClick && !isTableClick) {
        setSelectedCell(null);
        setToolbarVisible(false);
      }
    };

    const container = tableContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      window.addEventListener("scroll", handleScroll);
      document.addEventListener("click", handleClickOutside);
    }

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [selectedCell]);

  return (
    <div className="py-3 space-y-3">
      {/* Table Container with Horizontal Scroll */}
      <div ref={tableContainerRef} className="border border-border rounded-lg overflow-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <table className="border-collapse w-full" style={{ tableLayout: "auto" }}>
          <thead>
            <tr className="bg-linear-to-r from-primary/10 to-primary/5 sticky top-0 z-10">
              {tableData[0]?.map((header, colIndex) => (
                <th
                  key={colIndex}
                  style={{ width: getColumnWidth(colIndex), minWidth: getColumnWidth(colIndex) }}
                  className="px-4 py-3 text-left text-sm font-bold border-r border-border last:border-r-0 group/col hover:bg-primary/10 transition-colors relative"
                  onClick={() => setSelectedCell({ row: 0, col: colIndex })}
                >
                  <input
                    type="text"
                    value={header}
                    onChange={(e) => updateCell(0, colIndex, e.target.value)}
                    style={getCellStyle(getCellFormatting(0, colIndex))}
                    className="w-full bg-transparent outline-none font-semibold"
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
                  const isSelected = selectedCell?.row === rowIndex + 1 && selectedCell?.col === colIndex;

                  return (
                    <td
                      key={colIndex}
                      style={{ width: getColumnWidth(colIndex), minWidth: getColumnWidth(colIndex) }}
                      className={`px-4 py-2 border-r border-border last:border-r-0 relative ${
                        isSelected ? "bg-primary/10 ring-2 ring-primary" : ""
                      }`}
                      onClick={(e) => handleCellClick(e, rowIndex + 1, colIndex)}
                    >
                      <input
                        type="text"
                        value={cell}
                        onChange={(e) => updateCell(rowIndex + 1, colIndex, e.target.value)}
                        style={getCellStyle(formatting)}
                        className="w-full bg-transparent outline-none text-sm py-1 px-1 rounded"
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

      {/* Floating Cell Formatting Toolbar */}
      <AnimatePresence>
        {selectedCell && toolbarPosition && toolbarVisible && (
          <motion.div
            ref={toolbarRef}
            initial={{ opacity: 0, scale: 0.8, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 5 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "fixed",
              top: `${Math.max(10, toolbarPosition.top)}px`,
              left: `${toolbarPosition.left}px`,
              zIndex: 50,
              transform: "translateX(-50%)",
              pointerEvents: "auto",
            }}
            className="bg-foreground text-background rounded-lg shadow-2xl py-1.5 px-1 flex items-center gap-0.5 backdrop-blur-sm border border-foreground/20"
          >
            {/* Bold Button */}
            <button
              onClick={() =>
                updateCellFormatting(
                  selectedCell.row,
                  selectedCell.col,
                  { bold: !getCellFormatting(selectedCell.row, selectedCell.col)?.bold }
                )
              }
              title="Bold (Cmd+B)"
              className={`flex items-center justify-center p-1.5 rounded transition-all ${
                getCellFormatting(selectedCell.row, selectedCell.col)?.bold
                  ? "bg-background text-foreground"
                  : "hover:bg-white/20"
              }`}
            >
              <Bold className="w-4 h-4" />
            </button>

            {/* Italic Button */}
            <button
              onClick={() =>
                updateCellFormatting(
                  selectedCell.row,
                  selectedCell.col,
                  { italic: !getCellFormatting(selectedCell.row, selectedCell.col)?.italic }
                )
              }
              title="Italic (Cmd+I)"
              className={`flex items-center justify-center p-1.5 rounded transition-all ${
                getCellFormatting(selectedCell.row, selectedCell.col)?.italic
                  ? "bg-background text-foreground"
                  : "hover:bg-white/20"
              }`}
            >
              <Italic className="w-4 h-4" />
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-white/20 mx-0.5" />

            {/* Text Color Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenColorMenu(openColorMenu === "text" ? null : "text")}
                title="Text color"
                className="flex items-center justify-center p-1.5 rounded hover:bg-white/20 transition-all"
              >
                <Palette className="w-4 h-4" />
              </button>
              {openColorMenu === "text" && (
                <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 flex flex-col gap-1 bg-background border border-border rounded-lg shadow-lg p-1.5 z-50 whitespace-nowrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => {
                        updateCellFormatting(selectedCell.row, selectedCell.col, { color: color.value || undefined });
                        setOpenColorMenu(null);
                      }}
                      className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted rounded transition-colors text-left"
                    >
                      <div
                        className="w-3 h-3 rounded-full border border-border shrink-0"
                        style={{ backgroundColor: color.value || "#999" }}
                      />
                      {color.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Background Color Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenColorMenu(openColorMenu === "bg" ? null : "bg")}
                title="Highlight color"
                className="flex items-center justify-center p-1.5 rounded hover:bg-white/20 transition-all"
              >
                <div className="w-4 h-4 bg-current opacity-70" />
              </button>
              {openColorMenu === "bg" && (
                <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 flex flex-col gap-1 bg-background border border-border rounded-lg shadow-lg p-1.5 z-50 whitespace-nowrap">
                  {colorOptions.map((color) => (
                    <button
                      key={`bg-${color.value}`}
                      onClick={() => {
                        updateCellFormatting(selectedCell.row, selectedCell.col, { bgColor: color.value || undefined });
                        setOpenColorMenu(null);
                      }}
                      className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-muted rounded transition-colors text-left"
                    >
                      <div
                        className="w-3 h-3 rounded-full border border-border shrink-0"
                        style={{ backgroundColor: color.value || "#999" }}
                      />
                      Highlight
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            onClick={() => {
              if (onCreateChart) {
                onCreateChart(block.id, getChartColumns());
              }
            }}
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