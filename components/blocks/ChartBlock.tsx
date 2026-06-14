"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  ComposedChart,
} from "recharts";
import {
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  AreaChart as AreaChartIcon,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Columns,
  ScatterChart as ScatterIcon,
  Radar as RadarIcon,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NoteBlock } from "@/lib/types";

interface ChartColumn {
  id: string;
  key: string;
  type: "text" | "number";
}

interface ChartRow {
  id: string;
  cells: { [key: string]: string | number };
}

type ChartType = "bar" | "line" | "pie" | "area" | "donut" | "scatter" | "radar" | "stackedBar" | "horizontalBar" | "combo";

interface ChartBlockProps {
  chartType: ChartType;
  chartTitle: string;
  chartColumns?: ChartColumn[];
  chartRows?: ChartRow[];
  chartXAxisKey?: string;
  chartSelectedSeries?: string[];
  chartSeriesColors?: { [key: string]: string };
  linkedTableId?: string; // For syncing data from a linked table
  blocks?: NoteBlock[]; // All blocks to find the linked table
  // Legacy support
  chartData?: { id: string; label: string; value: number; color: string }[];
  onUpdate: (updates: {
    chartType?: ChartType;
    chartTitle?: string;
    chartColumns?: ChartColumn[];
    chartRows?: ChartRow[];
    chartXAxisKey?: string;
    chartSelectedSeries?: string[];
    chartSeriesColors?: { [key: string]: string };
    chartData?: { id: string; label: string; value: number; color: string }[];
  }) => void;
}

const defaultColors = [
  "#3b82f6", "#22c55e", "#a855f7", "#f97316", "#ec4899",
  "#14b8a6", "#eab308", "#ef4444", "#6366f1", "#84cc16",
];

const chartTypes: { type: ChartType; label: string }[] = [
  { type: "bar", label: "Bar" },
  { type: "line", label: "Line" },
  { type: "area", label: "Area" },
  { type: "pie", label: "Pie" },
  { type: "donut", label: "Donut" },
  { type: "horizontalBar", label: "H. Bar" },
  { type: "combo", label: "Combo" },
  { type: "scatter", label: "Scatter" },
  { type: "radar", label: "Radar" },
  { type: "stackedBar", label: "Stacked" },
];

const ChartBlock = ({
  chartType,
  chartTitle,
  chartColumns,
  chartRows,
  chartXAxisKey,
  chartSelectedSeries,
  chartSeriesColors,
  linkedTableId,
  blocks,
  chartData,
  onUpdate,
}: ChartBlockProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [editingTitle, setEditingTitle] = useState(chartTitle);

  // Initialize or migrate from legacy format
  const [columns, setColumns] = useState<ChartColumn[]>(() => {
    if (chartColumns && chartColumns.length > 0) return chartColumns;
    // Migrate from legacy
    if (chartData && chartData.length > 0) {
      return [
        { id: "col-name", key: "name", type: "text" },
        { id: "col-value", key: "value", type: "number" },
      ];
    }
    return [
      { id: crypto.randomUUID(), key: "name", type: "text" },
      { id: crypto.randomUUID(), key: "value", type: "number" },
    ];
  });

  const [rows, setRows] = useState<ChartRow[]>(() => {
    if (chartRows && chartRows.length > 0) return chartRows;
    // Migrate from legacy
    if (chartData && chartData.length > 0) {
      return chartData.map((item) => ({
        id: item.id,
        cells: { name: item.label, value: item.value },
      }));
    }
    return [
      { id: crypto.randomUUID(), cells: { name: "Jan", value: 400 } },
      { id: crypto.randomUUID(), cells: { name: "Feb", value: 300 } },
      { id: crypto.randomUUID(), cells: { name: "Mar", value: 200 } },
      { id: crypto.randomUUID(), cells: { name: "Apr", value: 278 } },
      { id: crypto.randomUUID(), cells: { name: "May", value: 189 } },
    ];
  });

  const [xAxisKey, setXAxisKey] = useState<string>(
    chartXAxisKey || columns.find((c) => c.type === "text")?.key || "name"
  );

  const [selectedSeries, setSelectedSeries] = useState<string[]>(() => {
    if (chartSelectedSeries && chartSelectedSeries.length > 0) return chartSelectedSeries;
    return columns.filter((c) => c.type === "number").map((c) => c.key);
  });

  const [seriesColors, setSeriesColors] = useState<{ [key: string]: string }>(() => {
    if (chartSeriesColors) return chartSeriesColors;
    const colors: { [key: string]: string } = {};
    columns.filter((c) => c.type === "number").forEach((col, idx) => {
      colors[col.key] = defaultColors[idx % defaultColors.length];
    });
    return colors;
  });

  // Get numeric columns for series selection
  const numericColumns = columns.filter((c) => c.type === "number");
  const textColumns = columns.filter((c) => c.type === "text");

  // Sync data from linked table
  // Sync data from linked table
  const handleSyncFromTable = () => {
    if (!linkedTableId || !blocks) return;

    // Find the linked table block
    const tableBlock = blocks.find((b) => b.id === linkedTableId && b.type === "table");
    if (!tableBlock || !tableBlock.tableData) return;

    const tableData = tableBlock.tableData;

    // Helper method to strip rendering markup tokens
    const cleanText = (html: string) => {
      if (!html) return "";
      
      let txt = html;
      if (typeof window !== "undefined") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        txt = doc.body.textContent || doc.body.innerText || html;
      }
    
      txt = txt.replace(/<\/?(div|p)[^>]*>/gi, " ").replace(/<br\s*\/?>/gi, " ");
      txt = txt.replace(/<[^>]*>/g, "");
      
      return txt.replace(/[\u00A0\s]+/g, " ").trim();
    };

    // Clean structural headers
    const sanitizedHeaders = (tableData[0] || []).map((header, idx) => cleanText(header) || `col${idx}`);

    // Convert table data to chart format safely
    const newChartRows = tableData.slice(1).map((row) => ({
      id: crypto.randomUUID(),
      cells: row.reduce((acc, cell, idx) => {
        const cleanedCell = cleanText(cell);
        const key = sanitizedHeaders[idx];
        return {
          ...acc,
          [key]: isNaN(Number(cleanedCell)) || cleanedCell === "" ? cleanedCell : Number(cleanedCell),
        };
      }, {}),
    }));

    const newChartColumns = sanitizedHeaders.map((name, idx) => {
      const firstRowValue = cleanText(tableData[1]?.[idx] || "");
      return {
        id: `col${idx}`,
        key: name,
        type: (/^\d+(\.\d+)?$/.test(firstRowValue) ? "number" as const : "text" as const),
      };
    });

    // Update the chart state structures safely
    setColumns(newChartColumns);
    setRows(newChartRows);

    // Determine fallback keys if previous ones are invalidated
    const newXAxis = newChartColumns.find((c) => c.type === "text")?.key || newChartColumns[0]?.key || "name";
    setXAxisKey(newXAxis);

    // Update series colors for new columns
    const newColors: { [key: string]: string } = {};
    newChartColumns.filter((c) => c.type === "number").forEach((col, idx) => {
      newColors[col.key] = defaultColors[idx % defaultColors.length];
    });
    setSeriesColors(newColors);

    // Update selected series
    const newSelectedSeries = newChartColumns.filter((c) => c.type === "number").map((c) => c.key);
    setSelectedSeries(newSelectedSeries);

    // Save the changes
    onUpdate({
      chartColumns: newChartColumns,
      chartRows: newChartRows,
      chartXAxisKey: newXAxis,
      chartSeriesColors: newColors,
      chartSelectedSeries: newSelectedSeries,
    });
  };

  const handleAddColumn = () => {
    const newKey = `col${columns.length + 1}`;
    const newCol: ChartColumn = {
      id: crypto.randomUUID(),
      key: newKey,
      type: "number",
    };
    setColumns([...columns, newCol]);
    setSeriesColors({ ...seriesColors, [newKey]: defaultColors[columns.length % defaultColors.length] });
  };

  const handleDeleteColumn = (id: string) => {
    if (columns.length <= 2) return;
    const col = columns.find((c) => c.id === id);
    if (!col) return;

    setColumns(columns.filter((c) => c.id !== id));
    setRows(rows.map((row) => {
      const newCells = { ...row.cells };
      delete newCells[col.key];
      return { ...row, cells: newCells };
    }));
    setSelectedSeries(selectedSeries.filter((s) => s !== col.key));
    if (xAxisKey === col.key) {
      const newXAxis = columns.find((c) => c.id !== id && c.type === "text")?.key || columns[0].key;
      setXAxisKey(newXAxis);
    }
  };

  const handleUpdateColumnKey = (id: string, newKey: string) => {
    const col = columns.find((c) => c.id === id);
    if (!col || col.key === newKey) return;

    const oldKey = col.key;
    setColumns(columns.map((c) => (c.id === id ? { ...c, key: newKey } : c)));
    setRows(rows.map((row) => {
      const newCells = { ...row.cells };
      newCells[newKey] = newCells[oldKey];
      delete newCells[oldKey];
      return { ...row, cells: newCells };
    }));
    if (selectedSeries.includes(oldKey)) {
      setSelectedSeries(selectedSeries.map((s) => (s === oldKey ? newKey : s)));
    }
    if (xAxisKey === oldKey) setXAxisKey(newKey);
    if (seriesColors[oldKey]) {
      const newColors = { ...seriesColors, [newKey]: seriesColors[oldKey] };
      delete newColors[oldKey];
      setSeriesColors(newColors);
    }
  };

  const handleAddRow = () => {
    const newCells: { [key: string]: string | number } = {};
    columns.forEach((col) => {
      newCells[col.key] = col.type === "number" ? 0 : "";
    });
    setRows([...rows, { id: crypto.randomUUID(), cells: newCells }]);
  };

  const handleDeleteRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((r) => r.id !== id));
  };

  const handleUpdateCell = (rowId: string, key: string, value: string | number) => {
    setRows(rows.map((row) =>
      row.id === rowId ? { ...row, cells: { ...row.cells, [key]: value } } : row
    ));
  };

  const handleToggleSeries = (key: string) => {
    if (selectedSeries.includes(key)) {
      if (selectedSeries.length > 1) {
        setSelectedSeries(selectedSeries.filter((s) => s !== key));
      }
    } else {
      setSelectedSeries([...selectedSeries, key]);
    }
  };

  const handleSave = () => {
    onUpdate({
      chartTitle: editingTitle,
      chartColumns: columns,
      chartRows: rows,
      chartXAxisKey: xAxisKey,
      chartSelectedSeries: selectedSeries,
      chartSeriesColors: seriesColors,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditingTitle(chartTitle);
    if (chartColumns) setColumns(chartColumns);
    if (chartRows) setRows(chartRows);
    if (chartXAxisKey) setXAxisKey(chartXAxisKey);
    if (chartSelectedSeries) setSelectedSeries(chartSelectedSeries);
    if (chartSeriesColors) setSeriesColors(chartSeriesColors);
    setIsEditing(false);
  };

  const getChartData = () => {
    return rows.map((row) => {
      const item: { [key: string]: string | number } = {};
      columns.forEach((col) => {
        item[col.key] = row.cells[col.key] ?? (col.type === "number" ? 0 : "");
      });
      return item;
    });
  };

  const renderChart = () => {
    const data = getChartData();
    const activeSeries = selectedSeries.filter((s) => numericColumns.some((c) => c.key === s));

    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Bar key={key} dataKey={key} fill={seriesColors[key] || defaultColors[0]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "horizontalBar":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis dataKey={xAxisKey} type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Bar key={key} dataKey={key} fill={seriesColors[key] || defaultColors[0]} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "stackedBar":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Bar key={key} dataKey={key} stackId="a" fill={seriesColors[key] || defaultColors[0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Line key={key} type="monotone" dataKey={key} stroke={seriesColors[key] || defaultColors[0]} strokeWidth={2} dot={{ fill: seriesColors[key] || defaultColors[0] }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Area key={key} type="monotone" dataKey={key} stroke={seriesColors[key] || defaultColors[0]} fill={seriesColors[key] || defaultColors[0]} fillOpacity={0.3} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

        case "scatter":
          return (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                {/* Force numerical evaluation for coordinate mappings */}
                <XAxis 
                  type="number" 
                  dataKey={activeSeries[0] || "value"} 
                  name={activeSeries[0] || "X Axis"} 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  label={{ value: activeSeries[0], position: 'insideBottom', offset: -10, fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  type="number" 
                  dataKey={activeSeries[1] || activeSeries[0] || "value"} 
                  name={activeSeries[1] || activeSeries[0] || "Y Axis"} 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  label={{ value: activeSeries[1] || activeSeries[0], angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip 
                  cursor={{ strokeDasharray: "3 3" }} 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Legend />
                {/* Dynamic rendering: Loop through rows to treat each line item as its own distinct colored, labeled point */}
                {data.map((row, index) => (
                  <Scatter
                    key={row.id || index}
                    name={String(row[xAxisKey] || `Point ${index + 1}`)}
                    data={[row]}
                    fill={defaultColors[index % defaultColors.length]}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          );

      case "radar":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={data}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <PolarRadiusAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Radar key={key} name={key} dataKey={key} stroke={seriesColors[key] || defaultColors[0]} fill={seriesColors[key] || defaultColors[0]} fillOpacity={0.3} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        );

      case "combo":
        return (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key, idx) =>
                idx % 2 === 0 ? (
                  <Bar key={key} dataKey={key} fill={seriesColors[key] || defaultColors[idx]} radius={[4, 4, 0, 0]} />
                ) : (
                  <Line key={key} type="monotone" dataKey={key} stroke={seriesColors[key] || defaultColors[idx]} strokeWidth={2} />
                )
              )}
            </ComposedChart>
          </ResponsiveContainer>
        );

      case "pie":
      case "donut":
        const pieData = data.map((item) => ({
          name: item[xAxisKey],
          value: Number(item[activeSeries[0]] || 0),
        }));
        return (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={chartType === "donut" ? 60 : 0}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={defaultColors[index % defaultColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  // Render chart for enlarged view with bigger height
  const renderEnlargedChart = () => {
    const data = getChartData();
    const activeSeries = selectedSeries.filter((s) => numericColumns.some((c) => c.key === s));
    const enlargedHeight = 500;

    switch (chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={enlargedHeight}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Bar key={key} dataKey={key} fill={seriesColors[key] || defaultColors[0]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "horizontalBar":
        return (
          <ResponsiveContainer width="100%" height={enlargedHeight}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis dataKey={xAxisKey} type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Bar key={key} dataKey={key} fill={seriesColors[key] || defaultColors[0]} radius={[0, 4, 4, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "stackedBar":
        return (
          <ResponsiveContainer width="100%" height={enlargedHeight}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Bar key={key} dataKey={key} stackId="a" fill={seriesColors[key] || defaultColors[0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={enlargedHeight}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Line key={key} type="monotone" dataKey={key} stroke={seriesColors[key] || defaultColors[0]} strokeWidth={2} dot={{ fill: seriesColors[key] || defaultColors[0] }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={enlargedHeight}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Area key={key} type="monotone" dataKey={key} stroke={seriesColors[key] || defaultColors[0]} fill={seriesColors[key] || defaultColors[0]} fillOpacity={0.3} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

        case "scatter":
          return (
            <ResponsiveContainer width="100%" height={enlargedHeight}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  type="number" 
                  dataKey={activeSeries[0] || "value"} 
                  name={activeSeries[0] || "X Axis"} 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  label={{ value: activeSeries[0], position: 'insideBottom', offset: -10, fill: 'hsl(var(--muted-foreground))', fontSize: 14 }}
                />
                <YAxis 
                  type="number" 
                  dataKey={activeSeries[1] || activeSeries[0] || "value"} 
                  name={activeSeries[1] || activeSeries[0] || "Y Axis"} 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  label={{ value: activeSeries[1] || activeSeries[0], angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 14 }}
                />
                <Tooltip 
                  cursor={{ strokeDasharray: "3 3" }} 
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                />
                <Legend />
                {data.map((row, index) => (
                  <Scatter
                    key={row.id || index}
                    name={String(row[xAxisKey] || `Point ${index + 1}`)}
                    data={[row]}
                    fill={defaultColors[index % defaultColors.length]}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          );

      case "radar":
        return (
          <ResponsiveContainer width="100%" height={enlargedHeight}>
            <RadarChart data={data}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <PolarRadiusAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key) => (
                <Radar key={key} name={key} dataKey={key} stroke={seriesColors[key] || defaultColors[0]} fill={seriesColors[key] || defaultColors[0]} fillOpacity={0.3} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        );

      case "combo":
        return (
          <ResponsiveContainer width="100%" height={enlargedHeight}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey={xAxisKey} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
              {activeSeries.map((key, idx) =>
                idx % 2 === 0 ? (
                  <Bar key={key} dataKey={key} fill={seriesColors[key] || defaultColors[idx]} radius={[4, 4, 0, 0]} />
                ) : (
                  <Line key={key} type="monotone" dataKey={key} stroke={seriesColors[key] || defaultColors[idx]} strokeWidth={2} />
                )
              )}
            </ComposedChart>
          </ResponsiveContainer>
        );

      case "pie":
      case "donut":
        const pieData = data.map((item) => ({
          name: item[xAxisKey],
          value: Number(item[activeSeries[0]] || 0),
        }));
        return (
          <ResponsiveContainer width="100%" height={enlargedHeight}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={chartType === "donut" ? 100 : 0}
                outerRadius={180}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={defaultColors[index % defaultColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        {isEditing ? (
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            className="text-lg font-semibold bg-muted px-3 py-1.5 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Chart Title"
          />
        ) : (
          <h3 className="text-lg font-semibold text-foreground">{chartTitle}</h3>
        )}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <motion.button onClick={handleSave} className="p-2 rounded-lg bg-primary text-primary-foreground" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Check className="w-4 h-4" />
              </motion.button>
              <motion.button onClick={handleCancel} className="p-2 rounded-lg bg-muted hover:bg-muted/80" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <X className="w-4 h-4" />
              </motion.button>
            </>
          ) : (
            <>
              {linkedTableId && blocks && (
                <motion.button
                  onClick={handleSyncFromTable}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Sync data from linked table"
                >
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              )}
              <motion.button
                onClick={() => setIsEnlarged(true)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Enlarge chart"
              >
                <Maximize2 className="w-4 h-4 text-muted-foreground" />
              </motion.button>
              <motion.button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Edit chart"
              >
                <Edit3 className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Chart Type Selector */}
      <AnimatePresence>
        {isEditing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Chart Type</label>
              <div className="flex flex-wrap gap-2">
                {chartTypes.map((ct) => (
                  <motion.button
                    key={ct.type}
                    onClick={() => onUpdate({ chartType: ct.type })}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      chartType === ct.type ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:border-primary/50"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {ct.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* X-Axis Key Selector */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">X-Axis Key</label>
              <select
                value={xAxisKey}
                onChange={(e) => setXAxisKey(e.target.value)}
                className="w-full bg-muted px-3 py-2 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary/50"
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.key}>{col.key}</option>
                ))}
              </select>
            </div>

            {/* Series Selection */}
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Data Series to Display</label>
              <div className="flex flex-wrap gap-3">
                {numericColumns.map((col) => (
                  <label key={col.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedSeries.includes(col.key)}
                      onChange={() => handleToggleSeries(col.key)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-sm">{col.key}</span>
                    <input
                      type="color"
                      value={seriesColors[col.key] || defaultColors[0]}
                      onChange={(e) => setSeriesColors({ ...seriesColors, [col.key]: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border-0"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Data Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-muted-foreground">Data Editor</label>
                <motion.button
                  onClick={handleAddColumn}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Column
                </motion.button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Row</th>
                      {columns.map((col) => (
                        <th key={col.id} className="px-3 py-2 text-left font-medium">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={col.key}
                              onChange={(e) => handleUpdateColumnKey(col.id, e.target.value)}
                              className="bg-transparent border-b border-border outline-none focus:border-primary w-full"
                            />
                            {columns.length > 2 && (
                              <button onClick={() => handleDeleteColumn(col.id)} className="text-destructive hover:text-destructive/80">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.id} className="border-b border-border">
                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                        {columns.map((col) => (
                          <td key={col.id} className="px-3 py-2">
                            <input
                              type={col.type === "number" ? "number" : "text"}
                              value={row.cells[col.key] ?? ""}
                              onChange={(e) =>
                                handleUpdateCell(row.id, col.key, col.type === "number" ? Number(e.target.value) : e.target.value)
                              }
                              className="w-full bg-background px-2 py-1 rounded border border-border outline-none focus:ring-1 focus:ring-primary/50"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleDeleteRow(row.id)}
                            disabled={rows.length <= 1}
                            className="text-destructive hover:text-destructive/80 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <motion.button
                onClick={handleAddRow}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Plus className="w-4 h-4" />
                Add Row
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chart Display */}
      <div className="bg-muted/30 rounded-lg p-2">{renderChart()}</div>

      {/* Enlarged Chart Dialog */}
      <Dialog open={isEnlarged} onOpenChange={setIsEnlarged}>
        <DialogContent className="max-w-5xl! w-full p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">{chartTitle}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 bg-muted/30 rounded-lg p-4">
            {renderEnlargedChart()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChartBlock;
